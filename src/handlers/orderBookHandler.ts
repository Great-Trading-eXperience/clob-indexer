import dotenv from "dotenv";
import { orders, pools } from "ponder:schema";
import {
	createDepthData,
	createOrderData,
	createOrderHistoryId,
	createOrderId,
	createPoolId,
	createTradeId,
	getOppositeSide,
	getSide,
	insertOrder,
	insertOrderBookDepth,
	insertOrderBookTrades,
	insertTrade,
	ORDER_STATUS,
	OrderSide,
	updateCandlestickBuckets,
	updateOrder,
	updateOrderStatusAndTimestamp,
	updatePoolVolume,
	upsertOrderBookDepth,
	upsertOrderBookDepthOnCancel,
	upsertOrderHistory,
} from "@/utils";
import { OrderMatchedEventArgs, OrderPlacedEventArgs } from "@/types";
import { pushExecutionReport } from "@/utils/pushExecutionReport";
import { pushDepth, pushMiniTicker, pushTrade } from "@/websocket/broadcaster";

dotenv.config();

const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === "true";
const START_WEBSOCKET_BLOCK = process.env.START_WEBSOCKET_BLOCK ? parseInt(process.env.START_WEBSOCKET_BLOCK) : 0;

export async function handleOrderPlaced({ event, context }: any) {
	const args = event.args as OrderPlacedEventArgs;
	const db = context.db;
	const chainId = context.network.chainId;
	const txHash = event.transaction.hash;

	const filled = BigInt(0);
	const orderId = BigInt(args.orderId!);
	const poolAddress = event.log.address!;
	const price = BigInt(args.price);
	const quantity = BigInt(args.quantity);
	const side = getSide(args.side);
	const status = ORDER_STATUS[Number(args.status)];
	const timestamp = Number(event.block.timestamp);

	const orderData = createOrderData(chainId, args, poolAddress, side, timestamp);
	await insertOrder(db, orderData);

	const historyId = createOrderHistoryId(chainId, txHash, filled, poolAddress, orderId.toString());
	const historyData = { id: historyId, chainId, orderId, poolId: poolAddress, timestamp, quantity, filled, status };
	await upsertOrderHistory(db, historyData);

	const depthId = `${poolAddress}-${side.toLowerCase()}-${price.toString()}`;
	const depthData = createDepthData(chainId, depthId, poolAddress, side, price, quantity, timestamp);
	await insertOrderBookDepth(db, depthData);

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		try {
			const symbol = (await getPoolTradingPair(context, poolAddress, chainId)).toUpperCase();
			const id = createOrderId(chainId, orderId, poolAddress);
			const order = await db.find(orders, { id });

			pushExecutionReport(
				symbol.toLowerCase(),
				order.user,
				order,
				"NEW",
				"NEW",
				BigInt(0),
				BigInt(0),
				timestamp * 1000
			);

			const latestDepth = await getDepth(poolAddress, context, chainId);
			pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
		} catch (e) {
			console.log("Error in WebSocket broadcast for OrderPlaced", e);
		}
	}
}

export async function handleOrderMatched({ event, context }: any) {
	const args = event.args as OrderMatchedEventArgs;
	const db = context.db;
	const chainId = context.network.chainId;
	const txHash = event.transaction.hash;

	const poolAddress = event.log.address!;
	const poolId = createPoolId(chainId, poolAddress);
	const price = BigInt(args.executionPrice);
	const quantity = BigInt(args.executedQuantity);
	const timestamp = Number(args.timestamp);

	await updatePoolVolume(db, poolId, quantity, price, timestamp);

	const tradeId = createTradeId(chainId, txHash, args.user, getSide(args.side), args);
	await insertOrderBookTrades(db, chainId, tradeId, txHash, poolAddress, args);

	const buyTradeId = createTradeId(chainId, txHash, args.user, OrderSide.BUY, args);
	const buyOrderId = createOrderId(chainId, BigInt(args.buyOrderId), poolAddress);
	await insertTrade(db, chainId, buyTradeId, buyOrderId, price, quantity, event);
	await updateOrder(db, chainId, buyOrderId, quantity);

	const sellTradeId = createTradeId(chainId, txHash, args.user, OrderSide.SELL, args);
	const sellOrderId = createOrderId(chainId, BigInt(args.sellOrderId), poolAddress);
	await insertTrade(db, chainId, sellTradeId, sellOrderId, price, quantity, event);
	await updateOrder(db, chainId, sellOrderId, quantity);

	await upsertOrderBookDepth(db, chainId, poolAddress, getSide(args.side), price, quantity, timestamp);
	await upsertOrderBookDepth(db, chainId, poolAddress, getOppositeSide(args.side), price, quantity, timestamp);

	await updateCandlestickBuckets(db, chainId, poolId, price, quantity, event, args);

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		try {
			const symbol = (await getPoolTradingPair(context, poolAddress, chainId)).toUpperCase();

			pushTrade(symbol.toLowerCase(), txHash, price.toString(), quantity.toString(), !!args.side, timestamp * 1000);

			const buyRow = await db.find(orders, { id: buyOrderId });
			const sellRow = await db.find(orders, { id: sellOrderId });

			if (buyRow)
				pushExecutionReport(
					symbol.toLowerCase(),
					buyRow.user,
					buyRow,
					"TRADE",
					buyRow.status,
					quantity,
					price,
					timestamp * 1000
				);
			if (sellRow)
				pushExecutionReport(
					symbol.toLowerCase(),
					sellRow.user,
					sellRow,
					"TRADE",
					sellRow.status,
					quantity,
					price,
					timestamp * 1000
				);

			const latestDepth = await getDepth(poolAddress, context, chainId);
			pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);

			// Broadcast a mini-ticker so front-ends get last price/volume widgets
			pushMiniTicker(symbol.toLowerCase(), price.toString(), price.toString(), price.toString(), quantity.toString());
		} catch (e) {
			console.log("Error in WebSocket broadcast for OrderMatched", e);
		}
	}
}

export async function handleOrderCancelled({ event, context }: any) {
	const db = context.db;
	const chainId = context.network.chainId;

	const hashedOrderId = createOrderId(chainId, BigInt(event.args.orderId!), event.log.address!);
	const timestamp = Number(event.args.timestamp);

	await updateOrderStatusAndTimestamp(db, chainId, hashedOrderId, event, timestamp);

	await upsertOrderBookDepthOnCancel(db, chainId, hashedOrderId, event, timestamp);

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		try {
			const poolAddress = event.log.address!;
			const symbol = (await getPoolTradingPair(context, poolAddress, chainId)).toUpperCase();

			const row = await db.find(orders, { id: hashedOrderId });

			if (row) {
				pushExecutionReport(
					symbol.toLowerCase(),
					row.user,
					row,
					"CANCELED",
					"CANCELED",
					BigInt(0),
					BigInt(0),
					timestamp * 1000
				);
				const latestDepth = await getDepth(poolAddress, context, chainId);
				pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
			}
		} catch (e) {
			console.log("Error in WebSocket broadcast for OrderCancelled", e);
		}
	}
}

export async function handleUpdateOrder({ event, context }: any) {
	const db = context.db;
	const chainId = context.network.chainId;

	const filled = BigInt(event.args.filled);
	const orderId = BigInt(event.args.orderId);
	const poolAddress = event.log.address!;
	const status = ORDER_STATUS[Number(event.args.status)];
	const timestamp = Number(event.args.timestamp);

	const hashedOrderId = createOrderId(chainId, orderId, poolAddress);
	const orderHistoryId = createOrderHistoryId(chainId, event.transaction.hash, filled, poolAddress, orderId.toString());

	const historyData = {
		id: orderHistoryId,
		chainId,
		orderId: orderId.toString(),
		poolId: poolAddress,
		timestamp,
		filled,
		status,
	};
	await upsertOrderHistory(db, historyData);

	await updateOrderStatusAndTimestamp(db, chainId, hashedOrderId, event, timestamp);

	const isExpired = ORDER_STATUS[5];

	if (event.args.status == isExpired) {
		const order = await db.find(orders, { id: hashedOrderId });
		const price = BigInt(order.price);
		await upsertOrderBookDepth(
			db,
			chainId,
			poolAddress,
			getSide(event.args.side),
			price,
			BigInt(order.quantity),
			timestamp,
			false
		);
	}

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		try {
			const symbol = (await getPoolTradingPair(context, poolAddress, chainId)).toUpperCase();

			const row = await db.find(orders, { id: hashedOrderId });

			if (row) {
				pushExecutionReport(
					symbol.toLowerCase(),
					row.user,
					row,
					"TRADE",
					row.status,
					filled,
					row.price,
					timestamp * 1000
				);
				const latestDepth = await getDepth(poolAddress, context, chainId);
				pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
			}
		} catch (e) {
			console.log("Error in WebSocket broadcast for UpdateOrder", e);
		}
	}
}

async function getPoolTradingPair(context: any, poolAddress: string, chainId: number): Promise<string> {
	const poolId = createPoolId(chainId, poolAddress);
	const pool = await context.db.find(pools, { id: poolId });

	if (!pool || !pool.symbol) {
		throw new Error(`Pool not found or missing symbol for address ${poolAddress} on chain ${chainId}`);
	}

	return pool.symbol;
}

export async function getDepth(pool: `0x${string}`, context: any, chainId: number) {
	try {
		const bids = await context.db.findMany(orders, {
			where: {
				poolId: pool,
				side: "Buy",
				status: { in: ["OPEN", "PARTIALLY_FILLED"] },
			},
			orderBy: [{ price: "desc" }],
			limit: 50,
		});

		const asks = await context.db.findMany(orders, {
			where: {
				poolId: pool,
				side: "Sell",
				status: { in: ["OPEN", "PARTIALLY_FILLED"] },
			},
			orderBy: [{ price: "asc" }],
			limit: 50,
		});

		return {
			bids: bids.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()]),
			asks: asks.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()]),
		};
	} catch (error) {
		console.error("Error getting depth data:", error);
		return { bids: [], asks: [] };
	}
}
