import dotenv from "dotenv";
import { eq } from "ponder";
import {
    dailyBuckets,
    fiveMinuteBuckets,
    hourBuckets,
    orderBookTrades,
    orderHistory,
    orders,
    pools,
    thirtyMinuteBuckets,
    trades,
    minuteBuckets
} from "ponder:schema";
import { updateCandlestickBucket } from "../utils/candlestick";
import { ORDER_STATUS, TIME_INTERVALS } from "../utils/constants";
import { DepthManager } from "../utils/depthManager";
import { getDepth } from "../utils/getDepth";
import { getPoolTokenDecimals } from "../utils/getPoolTokenDecimals";
import { getPoolTradingPair } from "../utils/getPoolTradingPair";
import { createOrderHistoryId, createOrderId, createPoolId, createTradeId } from "../utils/hash";
import { pushDepth, pushMiniTicker, pushTrade } from "../websocket/broadcaster";
import { pushExecutionReport } from "../utils/pushExecutionReport";

dotenv.config();

const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === 'true';

export async function handleOrderPlaced({ event, context }: any) {
    try {
        const chainId = context.network.chainId;
        const symbol = (await getPoolTradingPair(context, event.log.address!, chainId)).toUpperCase();
        const id = createOrderId(BigInt(event.args.orderId!), event.log.address!, chainId);
        const side = event.args.side ? "Sell" : "Buy";
        const price = BigInt(event.args.price);
        const timestamp = Number(event.block.timestamp);

        await context.db
            .insert(orders)
            .values({
                id: id,
                chainId: chainId,
                user: event.args.user,
                poolId: event.log.address!,
                orderId: BigInt(event.args.orderId!),
                side: side,
                timestamp: timestamp,
                price: price,
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
                orderId: event.args.orderId.toString(),
                poolId: event.log.address!,
                timestamp: timestamp,
                quantity: BigInt(event.args.quantity),
                filled: BigInt(0),
                status: ORDER_STATUS[Number(event.args.status)],
            })
            .onConflictDoUpdate((row: any) => ({
                timestamp: timestamp,
                quantity: BigInt(event.args.quantity),
                filled: BigInt(0),
                status: ORDER_STATUS[Number(event.args.status)],
            }));

        await DepthManager.updateOrderBookDepth(
            context,
            event.log.address!,
            chainId,
            timestamp
        );

        if (ENABLED_WEBSOCKET) {
            const order = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];
            pushExecutionReport(symbol.toLowerCase(), order.user, order, "NEW", "NEW", BigInt(0), BigInt(0), timestamp * 1000);

            const latestDepth = await getDepth(event.log.address!, context, chainId);
            pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
        }
    } catch (e) {
        console.log("Error in OrderPlaced", e);
    }
}

export async function handleOrderMatched({ event, context }: any) {
    const chainId = context.network.chainId;
    const symbol = (await getPoolTradingPair(context, event.log.address!, chainId)).toUpperCase();
    const timestamp = Number(event.args.timestamp);

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
        timestamp: timestamp,
        transactionId: event.transaction.hash,
        side: event.args.side ? "Sell" : "Buy",
        poolId: event.log.address!,
    });

    const poolId = createPoolId(chainId, event.log.address!);

    await context.db.update(pools, {
        id: poolId
    }).set((row: any) => {
        const executedQuantity = BigInt(event.args.executedQuantity);
        const executionPrice = BigInt(event.args.executionPrice);
        const baseDecimals = BigInt(row.baseDecimals);

        const quoteVolume = (executedQuantity * executionPrice) / (10n ** baseDecimals);

        return {
            price: BigInt(event.args.executionPrice),
            volume: BigInt(row.volume) + executedQuantity,
            volumeInQuote: BigInt(row.volumeInQuote) + quoteVolume,
            timestamp: timestamp
        };
    });

    const buyOrderId = createOrderId(BigInt(event.args.buyOrderId!), event.log.address!, chainId);

    await context.db
        .insert(trades)
        .values({
            id: tradeId,
            chainId: chainId,
            transactionId: event.transaction.hash,
            orderId: buyOrderId,
            timestamp: timestamp,
            price: BigInt(event.args.executionPrice),
            quantity: BigInt(event.args.executedQuantity),
            poolId: event.log.address!,
        })
        .onConflictDoNothing();

    await context.db.update(orders, {
        id: buyOrderId,
        chainId: chainId
    }).set((row: any) => ({
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

    const sellOrderId = createOrderId(BigInt(event.args.sellOrderId!), event.log.address!, chainId);

    await context.db
        .insert(trades)
        .values({
            id: oppositeId,
            chainId: chainId,
            transactionId: event.transaction.hash,
            orderId: sellOrderId,
            timestamp: timestamp,
            price: BigInt(event.args.executionPrice),
            quantity: BigInt(event.args.executedQuantity),
            poolId: event.log.address!,
        })
        .onConflictDoNothing();

    await context.db.update(orders, {
        id: sellOrderId,
        chainId: chainId
    }).set((row: any) => ({
        filled: row.filled + BigInt(event.args.executedQuantity),
        status:
            row.filled + BigInt(event.args.executedQuantity) === row.quantity
                ? "FILLED"
                : "PARTIALLY_FILLED",
    }));

    await DepthManager.updateOrderBookDepth(
        context,
        event.log.address!,
        chainId,
        timestamp
    );

    const isTakerBuy = !event.args.side;

    let baseDecimals = 18;
    let quoteDecimals = 6;

    try {
        const decimals = await getPoolTokenDecimals(event.log.address, chainId, context);
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
            Number(event.block.timestamp),
            context,
            event,
            isTakerBuy,
            chainId,
            baseDecimals,
            quoteDecimals
        );
    }

    if (ENABLED_WEBSOCKET) {
        pushTrade(symbol.toLowerCase(), event.transaction.hash, event.args.executionPrice.toString(), event.args.executedQuantity.toString(), !!event.args.side, timestamp * 1000);

        const buyRow = (await context.db.sql.select().from(orders).where(eq(orders.orderId, BigInt(event.args.buyOrderId!))).execute())[0];
        const sellRow = (await context.db.sql.select().from(orders).where(eq(orders.orderId, BigInt(event.args.sellOrderId!))).execute())[0];

        if (buyRow) pushExecutionReport(symbol.toLowerCase(), buyRow.user, buyRow, "TRADE", buyRow.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), timestamp * 1000);
        if (sellRow) pushExecutionReport(symbol.toLowerCase(), sellRow.user, sellRow, "TRADE", sellRow.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), timestamp * 1000);

        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);

        // Broadcast a mini‑ticker so front‑ends get last price/volume widgets
        pushMiniTicker(
            symbol.toLowerCase(),
            event.args.executionPrice.toString(), // close / last price
            event.args.executionPrice.toString(), // high (stub)
            event.args.executionPrice.toString(), // low  (stub)
            event.args.executedQuantity.toString() // volume (stub)
        );
    }
}

export async function handleOrderCancelled({ event, context }: any) {
    const chainId = context.network.chainId;
    const symbol = (await getPoolTradingPair(context, event.log.address!, chainId)).toUpperCase();
    const id = createOrderId(BigInt(event.args.orderId!), event.log.address!, chainId);
    const timestamp = Number(event.args.timestamp);

    await context.db.update(orders, {
        id: id,
        chainId: chainId
    }).set((row: any) => ({
        status: ORDER_STATUS[Number(event.args.status)],
        timestamp: timestamp,
    }));

    await DepthManager.updateOrderBookDepth(
        context,
        event.log.address!,
        chainId,
        timestamp
    );

    if (ENABLED_WEBSOCKET) {
        const row = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];

        if (!row) return;

        pushExecutionReport(symbol.toLowerCase(), row.user, row, "CANCELED", "CANCELED", BigInt(0), BigInt(0), timestamp);
        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
    }
}

export async function handleUpdateOrder({ event, context }: any) {
    const chainId = context.network.chainId;
    const symbol = (await getPoolTradingPair(context, event.log.address!, chainId)).toUpperCase();
    const timestamp = Number(event.args.timestamp);

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
        orderId: event.args.orderId.toString(),
        timestamp: timestamp,
        filled: BigInt(event.args.filled),
        status: ORDER_STATUS[Number(event.args.status)],
        poolId: event.log.address!,
    });

    const id = createOrderId(BigInt(event.args.orderId!), event.log.address!, chainId);

    await context.db.update(orders, {
        id: id,
        chainId: chainId
    }).set((row: any) => ({
        status: ORDER_STATUS[Number(event.args.status)],
        timestamp: timestamp,
    }));

    await DepthManager.updateOrderBookDepth(
        context,
        event.log.address!,
        chainId,
        timestamp
    );

    if (ENABLED_WEBSOCKET) {
        const row = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];

        if (!row) return;

        pushExecutionReport(symbol.toLowerCase(), row.user, row, "TRADE", row.status, BigInt(event.args.filled), row.price, timestamp * 1000);
        const latestDepth = await getDepth(event.log.address!, context, chainId);
        pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
    }
}