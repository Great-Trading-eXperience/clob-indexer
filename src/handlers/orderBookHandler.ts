import {
	dailyBuckets,
	fiveMinuteBuckets,
	hourBuckets,
	orderBookTrades,
	orderHistory,
	orders,
	thirtyMinuteBuckets,
	trades,
} from "ponder:schema";
import { minuteBuckets } from "../../ponder.schema";
import { ORDER_STATUS, TIME_INTERVALS } from "../utils/constants";
import {
	createOrderHistoryId,
	createOrderId,
	createTradeId,
} from "../utils/hash";
import { updateCandlestickBucket } from "../utils/candlestick";
import { getPoolTokenDecimals } from "../utils/getPoolTokenDecimals";

export async function handleOrderPlaced({ event, context }: any) {
	try {
		const chainId = context.network.chainId;
		const id = createOrderId(
			BigInt(event.args.orderId!),
			event.log.address!,
			chainId
		);

		await context.db
			.insert(orders)
			.values({
				id: id,
				chainId: chainId,
				transactionId: event.transaction.hash.toString(),
				user: event.args.user,
				poolId: event.log.address!,
				orderId: BigInt(event.args.orderId!),
				side: event.args.side ? "Sell" : "Buy",
				timestamp: Number(event.block.timestamp),
				price: BigInt(event.args.price),
				quantity: BigInt(event.args.quantity),
				orderValue: BigInt(event.args.price) * BigInt(event.args.quantity),
				filled: BigInt(0),
				type: event.args.isMarketOrder ? "Market" : "Limit",
				status: ORDER_STATUS[Number(event.args.status)],
				expiry: Number(event.args.expiry),
			})
			.onConflictDoNothing();

		const orderHistoryId = createOrderHistoryId(
			event.transaction.hash.toString(),
			BigInt(0),
			chainId,
			event.log.address!,
			event.args.orderId.toString()
		);

		await context.db
			.insert(orderHistory)
			.values({
				id: orderHistoryId,
				chainId: chainId,
				transactionId: event.transaction.hash.toString(),
				orderId: BigInt(event.args.orderId!),
				poolId: event.log.address!,
				timestamp: Number(event.block.timestamp),
				quantity: BigInt(event.args.quantity),
				filled: BigInt(0),
				status: ORDER_STATUS[Number(event.args.status)],
			})
			.onConflictDoUpdate((row: any) => ({
				timestamp: Number(event.block.timestamp),
				quantity: BigInt(event.args.quantity),
				filled: BigInt(0),
				status: ORDER_STATUS[Number(event.args.status)],
			}));
	} catch (e) {
		console.log("Error in OrderPlaced", e);
	}
}

export async function handleOrderMatched({ event, context }: any) {
	const chainId = context.network.chainId;

	const tradeId = createTradeId(
		event.transaction.hash,
		event.args.user,
		"buy",
		event.args.buyOrderId,
		event.args.sellOrderId,
		event.args.executionPrice,
		event.args.executedQuantity,
		chainId
	);

	await context.db.insert(orderBookTrades).values({
		id: tradeId,
		chainId: chainId,
		price: BigInt(event.args.executionPrice),
		quantity: BigInt(event.args.executedQuantity),
		timestamp: Number(event.args.timestamp),
		transactionId: event.transaction.hash,
		side: event.args.side ? "Sell" : "Buy",
		poolId: event.log.address!,
	});

	const buyOrderId = createOrderId(
		BigInt(event.args.buyOrderId!),
		event.log.address!,
		chainId
	);

	await context.db
		.insert(trades)
		.values({
			id: tradeId,
			chainId: chainId,
			transactionId: event.transaction.hash,
			orderId: buyOrderId,
			timestamp: Number(event.args.timestamp),
			price: BigInt(event.args.executionPrice),
			quantity: BigInt(event.args.executedQuantity),
			poolId: event.log.address!,
		})
		.onConflictDoNothing();

	await context.db
		.update(orders, {
			id: buyOrderId,
			chainId: chainId,
		})
		.set((row: any) => ({
			filled: row.filled + BigInt(event.args.executedQuantity),
			status:
				row.filled + BigInt(event.args.executedQuantity) === row.quantity
					? "FILLED"
					: "PARTIALLY_FILLED",
		}));

	const oppositeId = createTradeId(
		event.transaction.hash,
		event.args.user,
		"sell",
		event.args.buyOrderId,
		event.args.sellOrderId,
		event.args.executionPrice,
		event.args.executedQuantity,
		chainId
	);

	const sellOrderId = createOrderId(
		BigInt(event.args.sellOrderId!),
		event.log.address!,
		chainId
	);

	await context.db
		.insert(trades)
		.values({
			id: oppositeId,
			chainId: chainId,
			transactionId: event.transaction.hash,
			orderId: sellOrderId,
			timestamp: Number(event.args.timestamp),
			price: BigInt(event.args.executionPrice),
			quantity: BigInt(event.args.executedQuantity),
			poolId: event.log.address!,
		})
		.onConflictDoNothing();

	await context.db
		.update(orders, {
			id: sellOrderId,
			chainId: chainId,
		})
		.set((row: any) => ({
			filled: row.filled + BigInt(event.args.executedQuantity),
			status:
				row.filled + BigInt(event.args.executedQuantity) === row.quantity
					? "FILLED"
					: "PARTIALLY_FILLED",
		}));

	const isTakerBuy = !event.args.side;

	let baseDecimals = 18;
	let quoteDecimals = 6;

	try {
		const decimals = await getPoolTokenDecimals(
			event.log.address,
			chainId,
			context
		);
		baseDecimals = decimals.baseDecimals;
		quoteDecimals = decimals.quoteDecimals;
	} catch (error) {
		console.log(`Using default decimals due to error: ${error}`);
	}

	for (const [table, seconds] of [
		[minuteBuckets, TIME_INTERVALS.minute],
		[fiveMinuteBuckets, TIME_INTERVALS.fiveMinutes],
		[thirtyMinuteBuckets, TIME_INTERVALS.thirtyMinutes],
		[hourBuckets, TIME_INTERVALS.hour],
		[dailyBuckets, TIME_INTERVALS.day],
	] as const) {
		await updateCandlestickBucket(
			table,
			seconds,
			BigInt(event.args.executionPrice),
			BigInt(event.args.executedQuantity),
			Number(event.args.timestamp),
			context,
			event,
			isTakerBuy,
			chainId,
			baseDecimals,
			quoteDecimals
		);
	}
}

export async function handleOrderCancelled({ event, context }: any) {
	const chainId = context.network.chainId;
	const id = createOrderId(
		BigInt(event.args.orderId!),
		event.log.address!,
		chainId
	);

	await context.db
		.update(orders, {
			id: id,
			chainId: chainId,
		})
		.set((row: any) => ({
			status: ORDER_STATUS[Number(event.args.status)],
			timestamp: event.args.timestamp,
		}));
}

export async function handleUpdateOrder({ event, context }: any) {
	const chainId = context.network.chainId;
	const orderHistoryId = createOrderHistoryId(
		event.transaction.hash,
		event.args.filled,
		chainId,
		event.log.address!,
		event.args.orderId.toString()
	);

	await context.db.insert(orderHistory).values({
		id: orderHistoryId,
		chainId: chainId,
		transactionId: event.transaction.hash.toString(),
		orderId: event.args.orderId.toString(),
		timestamp: Number(event.args.timestamp),
		filled: BigInt(event.args.filled),
		status: ORDER_STATUS[Number(event.args.status)],
		poolId: event.log.address!,
	});

	const id = createOrderId(
		BigInt(event.args.orderId!),
		event.log.address!,
		chainId
	);

	await context.db
		.update(orders, {
			id: id,
			chainId: chainId,
		})
		.set((row: any) => ({
			status: ORDER_STATUS[Number(event.args.status)],
			timestamp: event.args.timestamp,
		}));
}
