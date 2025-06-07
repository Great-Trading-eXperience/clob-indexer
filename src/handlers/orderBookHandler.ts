import dotenv from "dotenv";
import {
    dailyBuckets,
    fiveMinuteBuckets,
    hourBuckets,
    minuteBuckets,
    orderBookTrades,
    orderHistory,
    orders,
    pools,
    thirtyMinuteBuckets,
    trades
} from "ponder:schema";
import { and, desc, eq, gte } from "ponder";
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

    await executeIfInSync(Number(event.block.number), async () => {
        const order = await context.db.find(orders, { id: id });
        pushExecutionReport(symbol.toLowerCase(), order.user, order, "NEW", "NEW", BigInt(0), BigInt(0), timestamp * 1000);

        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
    });
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

    await executeIfInSync(Number(event.block.number), async () => {
        const symbolLower = symbol.toLowerCase();
        const txHash = event.transaction.hash;
        const price = event.args.executionPrice.toString();
        const quantity = event.args.executedQuantity.toString();
        const isBuyerMaker = !!event.args.side;
        const tradeTime = timestamp * 1000;

        pushTrade(symbolLower, txHash, price, quantity, isBuyerMaker, tradeTime);

        if (buyRow) pushExecutionReport(symbol.toLowerCase(), buyRow.user, buyRow, "TRADE", buyRow.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), timestamp * 1000);
        if (sellRowById) pushExecutionReport(symbol.toLowerCase(), sellRowById.user, sellRowById, "TRADE", sellRowById.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), timestamp * 1000);

        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);

        const timeIntervals = [
            { table: minuteBuckets, interval: '1m', seconds: TIME_INTERVALS.minute },
            { table: fiveMinuteBuckets, interval: '5m', seconds: TIME_INTERVALS.fiveMinutes },
            { table: thirtyMinuteBuckets, interval: '30m', seconds: TIME_INTERVALS.thirtyMinutes },
            { table: hourBuckets, interval: '1h', seconds: TIME_INTERVALS.hour }
        ];

        const currentTimestamp = Number(event.block.timestamp);

        for (const { table, interval, seconds } of timeIntervals) {
            const openTime = Math.floor(currentTimestamp / seconds) * seconds;

            const klineData = await context.db.sql
                .select()
                .from(table)
                .where(
                    and(
                        eq(table.poolId, event.log.address!),
                        eq(table.openTime, openTime)
                    )
                )
                .execute();

            if (klineData.length > 0) {
                const kline = klineData[0];
                const klinePayload = {
                    t: kline.openTime * 1000,
                    T: kline.closeTime * 1000,
                    s: symbol.toUpperCase(),
                    i: interval,
                    o: kline.open.toString(),
                    c: kline.close.toString(),
                    h: kline.high.toString(),
                    l: kline.low.toString(),
                    v: kline.volume.toString(),
                    n: kline.count,
                    x: false,
                    q: kline.quoteVolume.toString(),
                    V: kline.takerBuyBaseVolume.toString(),
                    Q: kline.takerBuyQuoteVolume.toString()
                };

                pushKline(symbol.toLowerCase(), interval, klinePayload);
            }
        }

        const now = Math.floor(Date.now() / 1000);
        const oneDayAgo = now - 86400;

        const dailyStats = await context.db.sql
            .select()
            .from(dailyBuckets)
            .where(
                and(
                    eq(dailyBuckets.poolId, event.log.address!),
                    gte(dailyBuckets.openTime, oneDayAgo)
                )
            )
            .orderBy(desc(dailyBuckets.openTime))
            .limit(1)
            .execute();

        const closePrice = event.args.executionPrice.toString();
        const highPrice = dailyStats.length > 0 ? dailyStats[0].high.toString() : closePrice;
        const lowPrice = dailyStats.length > 0 ? dailyStats[0].low.toString() : closePrice;
        const volume = dailyStats.length > 0 ? dailyStats[0].quoteVolume.toString() : (BigInt(event.args.executedQuantity) * BigInt(event.args.executionPrice)).toString();

        pushMiniTicker(
            symbol.toLowerCase(),
            closePrice,
            highPrice,
            lowPrice,
            volume
        );
    });
}

export async function handleOrderCancelled({ event, context }: any) {
	const db = context.db;
	const chainId = context.network.chainId;

	const hashedOrderId = createOrderId(chainId, BigInt(event.args.orderId!), event.log.address!);
	const timestamp = Number(event.args.timestamp);

	await updateOrderStatusAndTimestamp(db, chainId, hashedOrderId, event, timestamp);

	await upsertOrderBookDepthOnCancel(db, chainId, hashedOrderId, event, timestamp);

    await executeIfInSync(Number(event.block.number), async () => {
        const row = await context.db.find(orders, { id: id });

        if (!row) return;

        pushExecutionReport(symbol.toLowerCase(), row.user, row, "CANCELED", "CANCELED", BigInt(0), BigInt(0), timestamp);
        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
    });
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
	});

    await executeIfInSync(Number(event.block.number), async () => {
        const row = await context.db.find(orders, { id: id });

        if (!row) return;

        pushExecutionReport(symbol.toLowerCase(), row.user, row, "TRADE", row.status, BigInt(event.args.filled), row.price, timestamp * 1000);
        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
    });
}