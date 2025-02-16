import { createHash } from "crypto";
import { ponder } from "ponder:registry";
import { hourBuckets, orderBookTrades, orderHistory, orders, trades } from "ponder:schema";

const orderStatus = [
    "OPEN",
    "PARTIALLY_FILLED",
    "FILLED",
    "CANCELLED",
    "EXPIRED",
];

function updateCandlestickBucket(
    bucketTable: any,
    intervalInSeconds: number,
    price: BigInt,
    timestamp: number,
    context: any
) {
    const bucketId = Math.floor(timestamp / intervalInSeconds) * intervalInSeconds;

    return context.db
        .insert(bucketTable)
        .values({
            id: bucketId,
            open: price,
            close: price,
            low: price,
            high: price,
            average: price,
            count: 1,
            timestamp: bucketId,
        })
        .onConflictDoUpdate((row: any) => ({
            close: price,
            low: Math.min(Number(row.low), Number(price)),
            high: Math.max(Number(row.high), Number(price)),
            average: (row.average * row.count + Number(price)) / (row.count + 1),
            count: row.count + 1,
            timestamp: bucketId,
        }));
}

ponder.on("OrderBook:OrderPlaced", async ({ event, context }) => {
    await context.db.insert(orders).values({
        id: BigInt(event.args.orderId),
        user: event.args.user,
        coin: "ETH/USDC", //TODO: Make configurable
        side: event.args.side ? 'Sell' : 'Buy',
        timestamp: Number(event.args.timestamp),
        price: BigInt(event.args.price),
        quantity: BigInt(event.args.quantity),
        orderValue: BigInt(event.args.price) * BigInt(event.args.quantity),
        filled: BigInt(0),
        type: event.args.isMarketOrder ? 'Market' : 'Limit',
        status: orderStatus[Number(event.args.status)],
        expiry: Number(event.args.expiry),
    }).onConflictDoNothing();

    await context.db.insert(orderHistory).values({
        id: event.transaction.hash,
        orderId: BigInt(event.args.orderId),
        timestamp: Number(event.args.timestamp),
        quantity: BigInt(event.args.quantity),
        filled: BigInt(0),
        status: orderStatus[Number(event.args.status)],
    });
});


ponder.on("OrderBook:OrderMatched", async ({ event, context }) => {
    await context.db.insert(orderBookTrades).values({
        id: createHash('sha256').update(`${event.transaction.hash}-${event.args.user}-buy-${event.args.buyOrderId}-${event.args.sellOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`).digest('hex'),
        price: BigInt(event.args.executionPrice),
        quantity: BigInt(event.args.executedQuantity),
        timestamp: Number(event.args.timestamp),
        transactionId: event.transaction.hash,
        side: event.args.side ? 'Sell' : 'Buy',
    });

    const id = createHash('sha256')
        .update(`${event.transaction.hash}-${event.args.user}-buy-${event.args.buyOrderId}-${event.args.sellOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`)
        .digest('hex');
    await context.db.insert(trades).values({
        id: id,
        transactionId: event.transaction.hash,
        orderId: BigInt(event.args.buyOrderId),
        timestamp: Number(event.args.timestamp),
        price: BigInt(event.args.executionPrice),
        quantity: BigInt(event.args.executedQuantity),
    }).onConflictDoNothing();

    await context.db.update(orders, { id: event.args.buyOrderId }).set((row: any) => ({
        filled: row.filled + BigInt(event.args.executedQuantity),
        status: row.filled + BigInt(event.args.executedQuantity) === row.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
    }));

    const oppositeId = createHash('sha256')
        .update(`${event.transaction.hash}-${event.args.user}-sell-${event.args.sellOrderId}-${event.args.buyOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`)
        .digest('hex');

    await context.db.insert(trades).values({
        id: oppositeId,
        transactionId: event.transaction.hash,
        orderId: BigInt(event.args.sellOrderId),
        timestamp: Number(event.args.timestamp),
        price: BigInt(event.args.executionPrice),
        quantity: BigInt(event.args.executedQuantity),
    }).onConflictDoNothing();

    await context.db.update(orders, { id: event.args.sellOrderId }).set((row: any) => ({
        filled: row.filled + BigInt(event.args.executedQuantity),
        status: row.filled + BigInt(event.args.executedQuantity) === row.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
    }));

    const hourlyBucketSeconds = 3600;
    await updateCandlestickBucket(hourBuckets, hourlyBucketSeconds, event.args.executionPrice, event.args.timestamp, context);
});

ponder.on("OrderBook:OrderCancelled", async ({ event, context }) => {
    await context.db
        .update(orders, { id: BigInt(event.args.orderId) })
        .set((row: any) => ({
            status: orderStatus[Number(event.args.status)],
            timestamp: event.args.timestamp
        }));
});

ponder.on("OrderBook:UpdateOrder", async ({ event, context }) => {
    const id = createHash('sha256').update(`${event.transaction.hash}-${event.args.filled}`).digest('hex');
    await context.db.insert(orderHistory).values({
        id: id,
        orderId: BigInt(event.args.orderId),
        timestamp: Number(event.args.timestamp),
        filled: BigInt(event.args.filled),
        status: orderStatus[Number(event.args.status)],
    });

    await context.db
        .update(orders, { id: BigInt(event.args.orderId) })
        .set((row: any) => ({
            status: orderStatus[Number(event.args.status)],
            timestamp: event.args.timestamp
        }));
});