import { randomBytes } from "crypto";
import { Hono } from "hono";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { registerBroadcastFns } from "./broadcaster";

const { WebSocket, WebSocketServer } = require("ws");
import type { WebSocket as WSWebSocket } from "ws";

const ENABLED_WEBSOCKET_LOG = process.env.ENABLE_WEBSOCKET_LOG === "true";

interface BinanceControl {
	method?: "SUBSCRIBE" | "UNSUBSCRIBE" | "LIST_SUBSCRIPTIONS" | "PING" | "PONG";
	params?: string[];
	id?: number | string | null;
}

interface ClientState {
	streams: Set<string>;
	lastCtrl: number;
	isUser: boolean;
	userId?: string;
}

const clients = new Map<WSWebSocket, ClientState>();
const listenKeys = new Map<
	string,
	{
		userId: string;
		expireTs: number;
	}
>();
const ORDER_BOOKS: Record<
	string,
	{
		bids: [string, string][];
		asks: [string, string][];
		lastUpdateId: number;
	}
> = {};
const allowCtrl = (s: ClientState) => {
	const n = Date.now();
	if (n - s.lastCtrl < 200) return false;
	s.lastCtrl = n;
	return true;
};
const randomListenKey = () => randomBytes(16).toString("hex");
setInterval(() => {
	const n = Date.now();
	for (const [k, r] of listenKeys) if (r.expireTs < n) listenKeys.delete(k);
}, 60_000);

export function bootstrapGateway(app: Hono) {
	const http = createServer();
	const wss = new WebSocketServer({
		server: http,
	});

	wss.on("connection", (ws: any, req: any) => {
		const url = req.url || "/";
		const listenKey = url.startsWith("/ws/") ? url.slice(4) : undefined;
		const state: ClientState = {
			streams: new Set(),
			lastCtrl: 0,
			isUser: !!listenKey,
			userId: listenKey ? listenKey.toLowerCase() : undefined,
		};

		clients.set(ws, state);

		ws.on("message", (raw: any) => {
			let m: BinanceControl;
			try {
				m = JSON.parse(raw.toString());
			} catch {
				return;
			}
			if (!m.method || !allowCtrl(state)) return;
			switch (m.method) {
				case "SUBSCRIBE":
					(m.params || []).forEach(s => state.streams.add(s));
					ws.send(
						JSON.stringify({
							id: m.id ?? null,
							result: null,
						})
					);
					break;
				case "UNSUBSCRIBE":
					(m.params || []).forEach(s => state.streams.delete(s));
					ws.send(
						JSON.stringify({
							id: m.id ?? null,
							result: null,
						})
					);
					break;
				case "LIST_SUBSCRIPTIONS":
					ws.send(
						JSON.stringify({
							id: m.id ?? null,
							result: [...state.streams],
						})
					);
					break;
				case "PING":
					ws.send(
						JSON.stringify({
							method: "PONG",
						})
					);
					break;
			}
		});

		ws.on("close", () => clients.delete(ws));
	});

	const router = app;

	router.get("/api/v3/depth", c => {
		const u = new URL(c.req.url);
		const sym = (u.searchParams.get("symbol") || "").toLowerCase();
		const lim = Number(u.searchParams.get("limit") || 100);
		const ob = ORDER_BOOKS[sym];
		if (!ob)
			return c.json(
				{
					code: -1121,
					msg: "Unknown symbol",
				},
				400
			);
		return c.json({
			lastUpdateId: ob.lastUpdateId,
			bids: ob.bids.slice(0, lim),
			asks: ob.asks.slice(0, lim),
		});
	});

	http.on("request", (req: IncomingMessage, res: ServerResponse) => app.fetch(req as any, res));
	http.listen(parseInt(process.env.PORT || "42080"));
	if (ENABLED_WEBSOCKET_LOG) console.log(`Gateway listening on :${process.env.PORT || 42080}`);

	const emit = (stream: string, data: any) => {
		if (ENABLED_WEBSOCKET_LOG) console.log("[WS EMIT]", stream, JSON.stringify(data));
		const j = JSON.stringify({
			stream,
			data,
		});
		for (const [ws, s] of clients) if (ws.readyState === 1 && s.streams.has(stream)) ws.send(j);
	};

	const emitUser = (userId: string, p: any) => {
		if (ENABLED_WEBSOCKET_LOG) console.log("[WS EMIT USER]", userId, JSON.stringify(p));
		const j = JSON.stringify(p);
		for (const [ws, s] of clients) if (s.isUser && s.userId === userId && ws.readyState === 1) ws.send(j);
	};

	const fns = {
		pushTrade: (sym: string, id: number, p: string, q: string, m: boolean, ts: number) =>
			emit(`${sym}@trade`, {
				e: "trade",
				E: ts,
				s: sym.toUpperCase(),
				t: id,
				p,
				q,
				m,
			}),
		pushDepth: (sym: string, b: [string, string][], a: [string, string][]) => {
			const ob =
				ORDER_BOOKS[sym] ||
				(ORDER_BOOKS[sym] = {
					bids: [],
					asks: [],
					lastUpdateId: 1,
				});
			ob.lastUpdateId += 1;
			ob.bids = b;
			ob.asks = a;
			emit(`${sym}@depth`, {
				e: "depthUpdate",
				E: Date.now(),
				s: sym.toUpperCase(),
				U: ob.lastUpdateId,
				u: ob.lastUpdateId,
				b,
				a,
			});
		},
		pushKline: (sym: string, int: string, k: any) =>
			emit(`${sym}@kline_${int}`, {
				e: "kline",
				E: Date.now(),
				s: sym.toUpperCase(),
				k,
			}),
		pushMiniTicker: (sym: string, c: string, h: string, l: string, v: string) =>
			emit(`${sym}@miniTicker`, {
				e: "24hrMiniTicker",
				E: Date.now(),
				s: sym.toUpperCase(),
				c,
				h,
				l,
				v,
			}),
		pushExecutionReport: (u: string, r: any) => emitUser(u, r),
		pushBalanceUpdate: (u: string, b: any) => emitUser(u, b),
	} as const;

	registerBroadcastFns(fns);
}
