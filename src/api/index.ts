import { Hono } from "hono";
import { and, client, desc, eq, graphql, gt, gte, lte, or, sql } from "ponder";
import { db } from "ponder:api";
import schema, {
	balances,
	currencies,
	dailyBuckets,
	fiveMinuteBuckets,
	hourBuckets,
	minuteBuckets,
	orderBookDepth,
	orderBookTrades,
	orders,
	pools,
	thirtyMinuteBuckets,
} from "ponder:schema";
import { bootstrapGateway } from "@/websocket/websocket-server";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

type BinanceKlineData = [
	number, // Open time
	string, // Open price
	string, // High price
	string, // Low price
	string, // Close price
	string, // Volume (base asset)
	number, // Close time
	string, // Quote asset volume
	number, // Number of trades
	string, // Taker buy base asset volume
	string, // Taker buy quote asset volume
	string, // Unused field (ignored)
];

// Interface for our bucket data
interface BucketData {
	id: string;
	openTime: number;
	closeTime: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	quoteVolume: number;
	average: number;
	count: number;
	takerBuyBaseVolume: number;
	takerBuyQuoteVolume: number;
	poolId: string;
}

type IntervalType = "1m" | "5m" | "30m" | "1h" | "1d";

app.get("/api/kline/mocks", async c => {
	const symbol = c.req.query("symbol");
	const interval = c.req.query("interval") || "1m";
	const startTime = parseInt(c.req.query("startTime") || "0");
	const endTime = parseInt(c.req.query("endTime") || Date.now().toString());
	const limit = parseInt(c.req.query("limit") || "1000");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	const mockData = generateMockKlineData(symbol, interval, startTime, endTime, limit);
	return c.json(mockData);
});

app.get("/api/kline", async c => {
	const symbol = c.req.query("symbol");
	const interval = c.req.query("interval") || "1m";
	const startTime = parseInt(c.req.query("startTime") || "0");
	const endTime = parseInt(c.req.query("endTime") || Date.now().toString());
	const limit = parseInt(c.req.query("limit") || "1000");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

	if (!queriedPools || queriedPools.length === 0) {
		return c.json({ error: "Pool not found" }, 404);
	}

	const intervalTableMap = {
		"1m": minuteBuckets,
		"5m": fiveMinuteBuckets,
		"30m": thirtyMinuteBuckets,
		"1h": hourBuckets,
		"1d": dailyBuckets,
	};

	const bucketTable = intervalTableMap[interval as IntervalType] || minuteBuckets;

	try {
		const poolId = queriedPools[0]!.orderBook;

		const klineData = await db
			.select()
			.from(bucketTable)
			.where(
				and(
					eq(bucketTable.poolId, poolId),
					gte(bucketTable.openTime, Math.floor(startTime / 1000)),
					lte(bucketTable.openTime, Math.floor(endTime / 1000))
				)
			)
			.orderBy(bucketTable.openTime)
			.limit(limit)
			.execute();

		const formattedData = klineData.map((bucket: BucketData) => formatKlineData(bucket));

		return c.json(formattedData);
	} catch (error) {
		return c.json({ error: `Failed to fetch kline data: ${error}` }, 500);
	}
});

app.get("/api/depth", async c => {
	const symbol = c.req.query("symbol");
	const limit = parseInt(c.req.query("limit") || "100");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	try {
		const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

		if (!queriedPools || queriedPools.length === 0) {
			return c.json({ error: "Pool not found" }, 404);
		}

		const poolId = queriedPools[0]!.orderBook;
		const chainId = queriedPools[0]!.chainId;

		if (!poolId) {
			return c.json({ error: "Pool order book address not found" }, 404);
		}

		const bids = await db
			.select()
			.from(orderBookDepth)
			.where(
				and(
					eq(orderBookDepth.poolId, poolId),
					eq(orderBookDepth.chainId, chainId),
					eq(orderBookDepth.side, "Buy"),
					gt(orderBookDepth.quantity, BigInt(0))
				)
			)
			.orderBy(desc(orderBookDepth.price))
			.limit(limit)
			.execute();

		const asks = await db
			.select()
			.from(orderBookDepth)
			.where(
				and(
					eq(orderBookDepth.poolId, poolId),
					eq(orderBookDepth.chainId, chainId),
					eq(orderBookDepth.side, "Sell"),
					gt(orderBookDepth.quantity, BigInt(0))
				)
			)
			.orderBy(orderBookDepth.price)
			.limit(limit)
			.execute();

		const response = {
			lastUpdateId: Date.now(),
			bids: bids.map(bid => [bid.price.toString(), bid.quantity.toString()]),
			asks: asks.map(ask => [ask.price.toString(), ask.quantity.toString()]),
		};

		return c.json(response);
	} catch (error) {
		return c.json({ error: `Failed to fetch depth data: ${error}` }, 500);
	}
});

app.get("/api/trades", async c => {
	const symbol = c.req.query("symbol");
	const limit = parseInt(c.req.query("limit") || "500");
	const user = c.req.query("user");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	try {
		const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

		if (!queriedPools || queriedPools.length === 0) {
			return c.json({ error: "Pool not found" }, 404);
		}

		const poolId = queriedPools[0]!.orderBook;

		if (!poolId) {
			return c.json({ error: "Pool order book address not found" }, 404);
		}

		let recentTrades;

		if (user) {
			const userTrades = await db
				.select({
					trade: orderBookTrades,
					order: orders,
				})
				.from(orderBookTrades)
				.innerJoin(orders, eq(orderBookTrades.poolId, orders.poolId))
				.where(and(eq(orderBookTrades.poolId, poolId), eq(orders.user, user.toLowerCase())))
				.orderBy(desc(orderBookTrades.timestamp))
				.limit(limit)
				.execute();

			recentTrades = userTrades.map(result => result.trade);
		} else {
			recentTrades = await db
				.select()
				.from(orderBookTrades)
				.where(eq(orderBookTrades.poolId, poolId))
				.orderBy(desc(orderBookTrades.timestamp))
				.limit(limit)
				.execute();
		}

		const formattedTrades = recentTrades.map(trade => ({
			id: trade.id || "",
			price: trade.price ? trade.price.toString() : "0",
			qty: trade.quantity ? trade.quantity.toString() : "0",
			time: trade.timestamp ? trade.timestamp * 1000 : Date.now(),
			isBuyerMaker: trade.side === "Sell",
			isBestMatch: true,
		}));

		return c.json(formattedTrades);
	} catch (error) {
		return c.json({ error: `Failed to fetch trades data: ${error}` }, 500);
	}
});

app.get("/api/ticker/24hr", async c => {
	const symbol = c.req.query("symbol");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	try {
		const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

		if (!queriedPools || queriedPools.length === 0) {
			return c.json({ error: "Pool not found" }, 404);
		}

		const poolId = queriedPools[0]!.orderBook;

		if (!poolId) {
			return c.json({ error: "Pool order book address not found" }, 404);
		}

		const now = Math.floor(Date.now() / 1000);
		const oneDayAgo = now - 86400;

		const dailyStats = await db
			.select()
			.from(dailyBuckets)
			.where(and(eq(dailyBuckets.poolId, poolId), gte(dailyBuckets.openTime, oneDayAgo)))
			.orderBy(desc(dailyBuckets.openTime))
			.limit(1)
			.execute();

		const latestTrade = await db
			.select()
			.from(orderBookTrades)
			.where(eq(orderBookTrades.poolId, poolId))
			.orderBy(desc(orderBookTrades.timestamp))
			.limit(1)
			.execute();

		const bestBids = await db
			.select()
			.from(orderBookDepth)
			.where(and(eq(orderBookDepth.poolId, poolId), eq(orderBookDepth.side, "Buy")))
			.orderBy(desc(orderBookDepth.price))
			.limit(1)
			.execute();

		const bestAsks = await db
			.select()
			.from(orderBookDepth)
			.where(and(eq(orderBookDepth.poolId, poolId), eq(orderBookDepth.side, "Sell")))
			.orderBy(orderBookDepth.price)
			.limit(1)
			.execute();

		interface DailyStats {
			open?: bigint | null;
			high?: bigint | null;
			low?: bigint | null;
			volume?: bigint | null;
			quoteVolume?: bigint | null;
			openTime?: number | null;
			count?: number | null;
			average?: bigint | null;
		}

		const stats = (dailyStats[0] || {}) as DailyStats;
		const lastPrice = latestTrade[0]?.price?.toString() || "0";

		const openPrice = stats.open?.toString() ?? "0";
		const highPrice = stats.high?.toString() ?? "0";
		const lowPrice = stats.low?.toString() ?? "0";
		const volumeValue = stats.volume?.toString() ?? "0";
		const quoteVolumeValue = stats.quoteVolume?.toString() ?? "0";
		const openTimeValue = stats.openTime ? stats.openTime * 1000 : oneDayAgo * 1000;
		const countValue = stats.count ?? 0;
		const averageValue = stats.average?.toString() ?? "0";

		const prevClosePrice = openPrice || lastPrice;

		const priceChange = (parseFloat(lastPrice) - parseFloat(prevClosePrice)).toString();
		const priceChangePercent =
			parseFloat(prevClosePrice) > 0
				? (((parseFloat(lastPrice) - parseFloat(prevClosePrice)) / parseFloat(prevClosePrice)) * 100).toFixed(2)
				: "0.00";

		const response = {
			symbol: symbol,
			priceChange: priceChange,
			priceChangePercent: priceChangePercent,
			weightedAvgPrice: averageValue,
			prevClosePrice: prevClosePrice,
			lastPrice: lastPrice,
			lastQty: latestTrade[0]?.quantity?.toString() || "0",
			bidPrice: bestBids[0]?.price?.toString() || "0",
			askPrice: bestAsks[0]?.price?.toString() || "0",
			openPrice: openPrice,
			highPrice: highPrice,
			lowPrice: lowPrice,
			volume: volumeValue,
			quoteVolume: quoteVolumeValue,
			openTime: openTimeValue,
			closeTime: now * 1000,
			firstId: "0",
			lastId: latestTrade[0]?.id || "0",
			count: countValue,
		};

		return c.json(response);
	} catch (error) {
		return c.json({ error: `Failed to fetch 24hr ticker data: ${error}` }, 500);
	}
});

app.get("/api/ticker/price", async c => {
	const symbol = c.req.query("symbol");

	if (!symbol) {
		return c.json({ error: "Symbol parameter is required" }, 400);
	}

	try {
		const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

		if (!queriedPools || queriedPools.length === 0) {
			return c.json({ error: "Pool not found" }, 404);
		}

		const poolId = queriedPools[0]!.orderBook;

		if (!poolId) {
			return c.json({ error: "Pool order book address not found" }, 404);
		}

		const latestTrade = await db
			.select()
			.from(orderBookTrades)
			.where(eq(orderBookTrades.poolId, poolId))
			.orderBy(desc(orderBookTrades.timestamp))
			.limit(1)
			.execute();

		let price = "0";
		if (latestTrade.length > 0 && latestTrade[0]?.price) {
			price = latestTrade[0].price.toString();
		} else if (queriedPools[0]?.price) {
			price = queriedPools[0].price.toString();
		}

		const response = {
			symbol: symbol,
			price: price,
		};

		return c.json(response);
	} catch (error) {
		return c.json({ error: `Failed to fetch price data: ${error}` }, 500);
	}
});

app.get("/api/allOrders", async c => {
	const symbol = c.req.query("symbol");
	const limit = parseInt(c.req.query("limit") || "500");
	const address = c.req.query("address");

	if (!address) {
		return c.json({ error: "Address parameter is required" }, 400);
	}

	try {
		const baseQuery = db.select().from(orders);
		let query = baseQuery.where(eq(orders.user, address as `0x${string}`));

		if (symbol) {
			const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

			if (!queriedPools || queriedPools.length === 0) {
				return c.json({ error: "Pool not found" }, 404);
			}

			const poolId = queriedPools[0]!.orderBook;
			if (poolId) {
				query = query.where(eq(orders.poolId, poolId));
			}
		}

		const userOrders = await query.orderBy(desc(orders.timestamp)).limit(limit).execute();

		const formattedOrders = await Promise.all(
			userOrders.map(async order => {
				let decimals = 18;

				if (order.poolId) {
					const poolInfo = await db
						.select()
						.from(pools)
						.where(eq(pools.orderBook, order.poolId as `0x${string}`))
						.execute();
					if (poolInfo.length > 0 && poolInfo[0]?.quoteDecimals) {
						decimals = Number(poolInfo[0].quoteDecimals);
					}
				}

				return {
					symbol: symbol || "UNKNOWN",
					orderId: order.orderId.toString(),
					orderListId: -1,
					clientOrderId: order.id,
					price: order.price.toString(),
					origQty: order.quantity.toString(),
					executedQty: order.filled.toString(),
					cummulativeQuoteQty:
						order.filled && order.price
							? ((BigInt(order.filled) * BigInt(order.price)) / BigInt(10 ** decimals)).toString()
							: "0",
					status: order.status,
					timeInForce: "GTC",
					type: order.type,
					side: order.side.toUpperCase(),
					stopPrice: "0",
					icebergQty: "0",
					time: Number(order.timestamp) * 1000,
					updateTime: Number(order.timestamp) * 1000,
					isWorking: order.status === "NEW" || order.status === "PARTIALLY_FILLED",
					origQuoteOrderQty: "0",
				};
			})
		);

		return c.json(formattedOrders);
	} catch (error) {
		return c.json({ error: `Failed to fetch orders: ${error}` }, 500);
	}
});

app.get("/api/openOrders", async c => {
	const symbol = c.req.query("symbol");
	const address = c.req.query("address");

	if (!address) {
		return c.json({ error: "Address parameter is required" }, 400);
	}

	try {
		const baseQuery = db.select().from(orders);
		let query = baseQuery.where(
			and(
				eq(orders.user, address as `0x${string}`),
				or(eq(orders.status, "NEW"), eq(orders.status, "PARTIALLY_FILLED"), eq(orders.status, "OPEN"))
			)
		);

		if (symbol) {
			const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

			if (!queriedPools || queriedPools.length === 0) {
				return c.json({ error: "Pool not found" }, 404);
			}

			const poolId = queriedPools[0]!.orderBook;
			if (poolId) {
				query = query.where(eq(orders.poolId, poolId));
			}
		}

		const openOrders = await query.orderBy(desc(orders.timestamp)).execute();

		const formattedOrders = await Promise.all(
			openOrders.map(async order => {
				let orderSymbol = symbol;
				let decimals = 18;

				if (order.poolId) {
					const pool = await db
						.select()
						.from(pools)
						.where(eq(pools.orderBook, order.poolId as `0x${string}`))
						.execute();

					orderSymbol = pool[0]?.coin || "UNKNOWN";

					if (pool.length > 0 && pool[0]?.quoteDecimals) {
						decimals = Number(pool[0].quoteDecimals);
					}
				}

				return {
					symbol: orderSymbol,
					orderId: order.orderId.toString(),
					orderListId: -1,
					clientOrderId: order.id,
					price: order.price.toString(),
					origQty: order.quantity.toString(),
					executedQty: order.filled.toString(),
					cummulativeQuoteQty:
						order.filled && order.price
							? ((BigInt(order.filled) * BigInt(order.price)) / BigInt(10 ** decimals)).toString()
							: "0",
					status: order.status,
					timeInForce: "GTC",
					type: order.type,
					side: order.side.toUpperCase(),
					stopPrice: "0",
					icebergQty: "0",
					time: Number(order.timestamp) * 1000,
					updateTime: Number(order.timestamp) * 1000,
					isWorking: true,
					origQuoteOrderQty: "0",
				};
			})
		);

		return c.json(formattedOrders);
	} catch (error) {
		return c.json({ error: `Failed to fetch open orders: ${error}` }, 500);
	}
});

app.get("/api/account", async c => {
	const address = c.req.query("address");

	if (!address) {
		return c.json({ error: "Address parameter is required" }, 400);
	}

	try {
		const userBalances = await db
			.select()
			.from(balances)
			.where(eq(balances.user, address as `0x${string}`))
			.execute();

		const balancesWithInfo = await Promise.all(
			userBalances.map(async balance => {
				const currency = await db
					.select()
					.from(currencies)
					.where(
						and(eq(currencies.address, balance.currency as `0x${string}`), eq(currencies.chainId, balance.chainId))
					)
					.execute();

				const symbol = currency[0]?.symbol || "UNKNOWN";

				const amount = BigInt(balance.amount || 0);
				const locked = BigInt(balance.lockedAmount || 0);
				const free = amount >= locked ? (amount - locked).toString() : "0";

				return {
					asset: symbol,
					free: free,
					locked: balance.lockedAmount?.toString() || "0",
				};
			})
		);

		const orderCount = await db
			.select({ count: sql`count(*)` })
			.from(orders)
			.where(eq(orders.user, address as `0x${string}`))
			.execute();

		const response = {
			makerCommission: 0,
			takerCommission: 0,
			buyerCommission: 0,
			sellerCommission: 0,
			canTrade: true,
			canWithdraw: true,
			canDeposit: true,
			updateTime: Date.now(),
			accountType: "SPOT",
			balances: balancesWithInfo,
			permissions: ["SPOT"],
		};

		return c.json(response);
	} catch (error) {
		return c.json({ error: `Failed to fetch account information: ${error}` }, 500);
	}
});

// Function to format our bucket data into Binance Kline format
function formatKlineData(bucket: BucketData): BinanceKlineData {
	// Binance Kline format is an array with specific index positions:
	// [
	//   0: openTime,
	//   1: open,
	//   2: high,
	//   3: low,
	//   4: close,
	//   5: volume,
	//   6: closeTime,
	//   7: quoteVolume,
	//   8: numberOfTrades,
	//   9: takerBuyBaseVolume,
	//   10: takerBuyQuoteVolume,
	//   11: ignored
	// ]

	return [
		bucket.openTime * 1000,
		bucket.open.toString(),
		bucket.high.toString(),
		bucket.low.toString(),
		bucket.close.toString(),
		bucket.volume.toString(),
		bucket.closeTime * 1000,
		bucket.quoteVolume.toString(),
		bucket.count,
		bucket.takerBuyBaseVolume.toString(),
		bucket.takerBuyQuoteVolume.toString(),
		"0",
	];
}

// Function to generate mock data when real data isn't available
function generateMockKlineData(
	symbol: string,
	interval: string,
	startTime: number,
	endTime: number,
	limit: number
): BinanceKlineData[] {
	const intervalInMs = getIntervalInMs(interval);
	const mockData: BinanceKlineData[] = [];

	// Determine how many data points to generate
	const timeRange = endTime - startTime;
	const numPoints = Math.min(limit, Math.ceil(timeRange / intervalInMs));

	// Generate a starting price based on the symbol (just for variety in mocks)
	const symbolHash = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
	let basePrice = 100 + (symbolHash % 900); // Price between 100 and 999

	// Generate the mock data points
	for (let i = 0; i < numPoints; i++) {
		const openTime = startTime + i * intervalInMs;
		const closeTime = openTime + intervalInMs - 1;

		// Create some price movement
		const priceChange = (Math.random() - 0.5) * 2; // Between -1 and 1
		const open = basePrice;
		const close = open * (1 + priceChange * 0.01); // Up to 1% change
		const high = Math.max(open, close) * (1 + Math.random() * 0.005); // Up to 0.5% higher
		const low = Math.min(open, close) * (1 - Math.random() * 0.005); // Up to 0.5% lower

		// Generate volume data
		const volume = 10 + Math.random() * 90; // Between 10 and 100
		const quoteVolume = volume * ((open + close) / 2);
		const count = Math.floor(10 + Math.random() * 90); // Between 10 and 100 trades

		// Taker volumes
		const takerBuyPercent = Math.random(); // Between 0 and 1
		const takerBuyBaseVolume = volume * takerBuyPercent;
		const takerBuyQuoteVolume = quoteVolume * takerBuyPercent;

		mockData.push([
			openTime, // Open time
			open.toFixed(8), // Open price
			high.toFixed(8), // High price
			low.toFixed(8), // Low price
			close.toFixed(8), // Close price
			volume.toFixed(8), // Volume
			closeTime, // Close time
			quoteVolume.toFixed(8), // Quote asset volume
			count, // Number of trades
			takerBuyBaseVolume.toFixed(8), // Taker buy base asset volume
			takerBuyQuoteVolume.toFixed(8), // Taker buy quote asset volume
			"0", // Unused field (ignored)
		]);

		// Update the base price for the next iteration
		basePrice = close;
	}

	return mockData;
}

// Helper function to convert interval strings to milliseconds
function getIntervalInMs(interval: string): number {
	const value = parseInt(interval);
	const unit = interval.slice(-1);

	switch (unit) {
		case "m":
			return value * 60 * 1000; // minutes
		case "h":
			return value * 60 * 60 * 1000; // hours
		case "d":
			return value * 24 * 60 * 60 * 1000; // days
		case "w":
			return value * 7 * 24 * 60 * 60 * 1000; // weeks
		case "M":
			return value * 30 * 24 * 60 * 60 * 1000; // months (approximate)
		default:
			return 60 * 1000; // default to 1 minute
	}
}

bootstrapGateway(app);

export default app;
