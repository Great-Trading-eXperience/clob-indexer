import { and, eq, or } from "ponder";
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
} from "ponder:schema";
import { minuteBuckets } from "../../ponder.schema";
import { updateCandlestickBucket } from "../utils/candlestick";
import { ORDER_STATUS, TIME_INTERVALS } from "../utils/constants";
import { getPoolTokenDecimals } from "../utils/getPoolTokenDecimals";
import { createOrderHistoryId, createOrderId, createPoolId, createTradeId } from "../utils/hash";
import { pushDepth, pushExecutionReport, pushTrade, pushMiniTicker } from "../websocket/broadcaster";
import dotenv from "dotenv";

dotenv.config();

const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === 'true';

const symbolFromPool = async (context: any, pool: string, chainId: string) => {
    const poolData = (await context.db.sql.select().from(pools).where(eq(pools.orderBook, pool), eq(pools.chainId, chainId)).execute())[0];
    return poolData.coin.replace('/', '').toLowerCase();
};

async function depth(pool: string, ctx: any) {
    const bids = await ctx.db.sql.select().from(orders).where(and(eq(orders.poolId, pool), eq(orders.side, "Buy"), or(eq(orders.status, "OPEN"), eq(orders.status, "PARTIALLY_FILLED")))).orderBy(orders.price, "desc").limit(50).execute();
    const asks = await ctx.db.sql.select().from(orders).where(and(eq(orders.poolId, pool), eq(orders.side, "Sell"), or(eq(orders.status, "OPEN"), eq(orders.status, "PARTIALLY_FILLED")))).orderBy(orders.price, "asc").limit(50).execute();
    return {
        bids: bids.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()]),
        asks: asks.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()])
    };
}

function exec(symbol: string, user: string, order: any, execType: string, status: string, lastQty: bigint, lastPrice: bigint, ts: number) {
    pushExecutionReport(user, {
        e: "executionReport",
        E: ts,
        s: symbol,
        i: order.orderId.toString(),
        S: order.side.toUpperCase(),
        o: order.type.toUpperCase(),
        X: status,
        x: execType,
        q: order.quantity.toString(),
        z: order.filled.toString(),
        l: lastQty.toString(),
        p: order.price.toString(),
        L: lastPrice.toString(),
        T: ts
    });
}

export async function handleOrderPlaced({ event, context }: any) {
    try {
        const chainId = context.network.chainId;
        const symbol = (await symbolFromPool(context, event.log.address!, chainId)).toUpperCase();
        const id = createOrderId(BigInt(event.args.orderId!), event.log.address!, chainId);

        await context.db
            .insert(orders)
            .values({
                id: id,
                chainId: chainId,
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
                orderId: event.args.orderId.toString(),
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

        if (ENABLED_WEBSOCKET) {
            const order = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];
            exec(symbol.toLowerCase(), order.user, order, "NEW", "NEW", BigInt(0), BigInt(0), Number(event.block.timestamp));

            const latestDepth = await depth(event.log.address!, context);
            pushDepth(symbol.toLowerCase(), latestDepth.bids as any, latestDepth.asks as any);
        }
    } catch (e) {
        console.log("Error in OrderPlaced", e);
    }
}

export async function handleOrderMatched({ event, context }: any) {
    const chainId = context.network.chainId;
    const symbol = (await symbolFromPool(context, event.log.address!, chainId)).toUpperCase();

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

    const poolId = createPoolId(chainId, event.log.address!);

    await context.db.update(pools, {
        id: poolId
    }).set((row: any) => ({
        price: BigInt(event.args.executionPrice),
        volume: BigInt(Number(row.volume)) + BigInt(Number(event.args.executedQuantity)),
        volumeInQuote: BigInt(Number(row.volumeInQuote)) + BigInt((Number(event.args.executedQuantity) / Number(10 ** row.baseDecimals) * Number(event.args.executionPrice))),
        timestamp: Number(event.args.timestamp)
    }));

    const buyOrderId = createOrderId(BigInt(event.args.buyOrderId!), event.log.address!, chainId);

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
            timestamp: Number(event.args.timestamp),
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
        pushTrade(symbol, Number(event.args.timestamp), event.args.executionPrice.toString(), event.args.executedQuantity.toString(), !!event.args.side, Number(event.args.timestamp));

        const buyRow = (await context.db.sql.select().from(orders).where(eq(orders.orderId, BigInt(event.args.buyOrderId!))).execute())[0];
        const sellRow = (await context.db.sql.select().from(orders).where(eq(orders.orderId, BigInt(event.args.sellOrderId!))).execute())[0];

        if (buyRow) exec(symbol, buyRow.user, buyRow, "TRADE", buyRow.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), Number(event.args.timestamp));
        if (sellRow) exec(symbol, sellRow.user, sellRow, "TRADE", sellRow.status, BigInt(event.args.executedQuantity), BigInt(event.args.executionPrice), Number(event.args.timestamp));

        const latestDepth = await depth(event.log.address!, context);
        pushDepth(symbol, latestDepth.bids as any, latestDepth.asks as any);

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
    const symbol = (await symbolFromPool(context, event.log.address!, chainId)).toUpperCase();
    const id = createOrderId(BigInt(event.args.orderId!), event.log.address!, chainId);

    await context.db.update(orders, {
        id: id,
        chainId: chainId
    }).set((row: any) => ({
        status: ORDER_STATUS[Number(event.args.status)],
        timestamp: event.args.timestamp,
    }));

    if (ENABLED_WEBSOCKET) {
        const row = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];

        if (!row) return;

        exec(symbol, row.user, row, "CANCELED", "CANCELED", BigInt(0), BigInt(0), Number(event.args.timestamp));
        const latestDepth = await depth(event.log.address!, context);
        pushDepth(symbol, latestDepth.bids as any, latestDepth.asks as any);
    }
}

export async function handleUpdateOrder({ event, context }: any) {
    const chainId = context.network.chainId;
    const symbol = (await symbolFromPool(context, event.log.address!, chainId)).toUpperCase();
    
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
        timestamp: Number(event.args.timestamp),
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
        timestamp: event.args.timestamp,
    }));

    if (ENABLED_WEBSOCKET) {
        const row = (await context.db.sql.select().from(orders).where(eq(orders.id, id)).execute())[0];

        if (!row) return;

        exec(symbol, row.user, row, "TRADE", row.status, BigInt(event.args.filled), row.price, Number(event.args.timestamp));
        const latestDepth = await depth(event.log.address!, context);
        pushDepth(symbol, latestDepth.bids as any, latestDepth.asks as any);
    }
}