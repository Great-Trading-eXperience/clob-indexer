import dotenv from "dotenv";
import { orders } from "ponder:schema";
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

dotenv.config();

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
}

export async function handleOrderCancelled({ event, context }: any) {
	const db = context.db;
	const chainId = context.network.chainId;

	const hashedOrderId = createOrderId(chainId, BigInt(event.args.orderId!), event.log.address!);
	const timestamp = Number(event.args.timestamp);

	await updateOrderStatusAndTimestamp(db, chainId, hashedOrderId, event, timestamp);

	await upsertOrderBookDepthOnCancel(db, chainId, hashedOrderId, event, timestamp);
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
}