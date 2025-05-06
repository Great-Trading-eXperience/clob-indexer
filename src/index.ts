import { createHash } from "crypto";
import { ponder } from "ponder:registry";
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
import { minuteBuckets } from "../ponder.schema";

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
  quantity: BigInt,
  timestamp: number,
  context: any,
  event: any,
  isTakerBuy: boolean,
  baseDecimals: number = 18,
  quoteDecimals: number = 6
) {
  const openTime = Math.floor(timestamp / intervalInSeconds) * intervalInSeconds;
  const closeTime = openTime + intervalInSeconds - 1;
  
  const bucketId = createHash("sha256")
    .update(`${event.log.address!}-${openTime}`)
    .digest("hex");

  const priceDecimal = Number(price) / (10 ** quoteDecimals);
  
  const baseVolume = Number(quantity) / (10 ** baseDecimals);
  const quoteVolume = Number(Number(quantity) * Number(price)) / (10 ** (baseDecimals + quoteDecimals));
  
  const takerBuyBaseVolume = isTakerBuy ? baseVolume : 0;
  const takerBuyQuoteVolume = isTakerBuy ? quoteVolume : 0;

  return context.db
    .insert(bucketTable)
    .values({
      id: bucketId,
      openTime: openTime,
      closeTime: closeTime,
      open: priceDecimal,
      close: priceDecimal,
      low: priceDecimal,
      high: priceDecimal,
      average: priceDecimal,
      volume: baseVolume,
      quoteVolume: quoteVolume,
      count: 1,
      takerBuyBaseVolume: takerBuyBaseVolume,
      takerBuyQuoteVolume: takerBuyQuoteVolume,
      poolId: event.log.address!,
    })
    .onConflictDoUpdate((row: any) => ({
      close: priceDecimal,
      low: Math.min(Number(row.low), priceDecimal),
      high: Math.max(Number(row.high), priceDecimal),
      average:
        (Number(row.average) * Number(row.count) + priceDecimal) /
        (Number(row.count) + 1),
      count: row.count + 1,
      volume: Number(row.volume) + baseVolume,
      quoteVolume: Number(row.quoteVolume) + quoteVolume,
      takerBuyBaseVolume: Number(row.takerBuyBaseVolume) + takerBuyBaseVolume,
      takerBuyQuoteVolume: Number(row.takerBuyQuoteVolume) + takerBuyQuoteVolume,
    }));
}

ponder.on("OrderBook:OrderPlaced" as any, async ({ event, context }: any) => {
  try {
    const id = createHash("sha256")
      .update(`${BigInt(event.args.orderId!)}-${event.log.address!}`)
      .digest("hex");

    await context.db
      .insert(orders)
      .values({
        id: id,
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
        status: orderStatus[Number(event.args.status)],
        expiry: Number(event.args.expiry),
      })
      .onConflictDoNothing();

    await context.db
      .insert(orderHistory)
      .values({
        id: event.transaction.hash.toString(),
        orderId: event.args.orderId.toString(),
        poolId: event.log.address!,
        timestamp: Number(event.block.timestamp),
        quantity: BigInt(event.args.quantity),
        filled: BigInt(0),
        status: orderStatus[Number(event.args.status)],
      })
      .onConflictDoUpdate((row: any) => ({
        timestamp: Number(event.block.timestamp),
        quantity: BigInt(event.args.quantity),
        filled: BigInt(0),
        status: orderStatus[Number(event.args.status)],
      }));
  } catch (e) {
    console.log("Error in OrderPlaced", e);
  }
});

ponder.on("OrderBook:OrderMatched" as any, async ({ event, context }: any) => {
  await context.db.insert(orderBookTrades).values({
    id: createHash("sha256")
      .update(
        `${event.transaction.hash}-${event.args.user}-buy-${event.args.buyOrderId}-${event.args.sellOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`
      )
      .digest("hex"),
    price: BigInt(event.args.executionPrice),
    quantity: BigInt(event.args.executedQuantity),
    timestamp: Number(event.args.timestamp),
    transactionId: event.transaction.hash,
    side: event.args.side ? "Sell" : "Buy",
    poolId: event.log.address!,
  });

  const id = createHash("sha256")
    .update(
      `${event.transaction.hash}-${event.args.user}-buy-${event.args.buyOrderId}-${event.args.sellOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`
    )
    .digest("hex");
    
  const buyOrderId = createHash("sha256")
    .update(`${BigInt(event.args.buyOrderId!)}-${event.log.address!}`)
    .digest("hex");

  await context.db
    .insert(trades)
    .values({
      id: id,
      transactionId: event.transaction.hash,
      orderId: buyOrderId,
      timestamp: Number(event.args.timestamp),
      price: BigInt(event.args.executionPrice),
      quantity: BigInt(event.args.executedQuantity),
      poolId: event.log.address!,
    })
    .onConflictDoNothing();

  await context.db.update(orders, { id: buyOrderId }).set((row: any) => ({
    filled: row.filled + BigInt(event.args.executedQuantity),
    status:
      row.filled + BigInt(event.args.executedQuantity) === row.quantity
        ? "FILLED"
        : "PARTIALLY_FILLED",
  }));

  const oppositeId = createHash("sha256")
    .update(
      `${event.transaction.hash}-${event.args.user}-sell-${event.args.sellOrderId}-${event.args.buyOrderId}-${event.args.executionPrice}-${event.args.executedQuantity}`
    )
    .digest("hex");

  const sellOrderId = createHash("sha256")
    .update(`${BigInt(event.args.sellOrderId!)}-${event.log.address!}`)
    .digest("hex");

  await context.db
    .insert(trades)
    .values({
      id: oppositeId,
      transactionId: event.transaction.hash,
      orderId: sellOrderId,
      timestamp: Number(event.args.timestamp),
      price: BigInt(event.args.executionPrice),
      quantity: BigInt(event.args.executedQuantity),
      poolId: event.log.address!,
    })
    .onConflictDoNothing();

  await context.db.update(orders, { id: sellOrderId }).set((row: any) => ({
    filled: row.filled + BigInt(event.args.executedQuantity),
    status:
      row.filled + BigInt(event.args.executedQuantity) === row.quantity
        ? "FILLED"
        : "PARTIALLY_FILLED",
  }));

  const isTakerBuy = !event.args.side;

  const intervals = {
    minute: 60,
    fiveMinutes: 300,
    thirtyMinutes: 1800,
    hour: 3600,
    day: 86400,
  };

  async function getPoolTokenDecimals(poolId: string, context: any) {
    try {
      const poolResult = await context.db
        .select({
			'id': poolId
		})
        .from(pools)
        .execute();
      
      if (poolResult && poolResult.length > 0) {
        const pool = poolResult[0];
        
        return {
          baseDecimals: pool.baseDecimals || 18,
          quoteDecimals: pool.quoteDecimals || 6
        };
      }
      
      return { baseDecimals: 18, quoteDecimals: 6 };
    } catch (error) {
      console.log(`Error getting token decimals: ${error}`);
      return { baseDecimals: 18, quoteDecimals: 6 };
    }
  }
  
  let baseDecimals = 18;
  let quoteDecimals = 6;
  
  try {
    const decimals = await getPoolTokenDecimals(event.log.address, context);
    baseDecimals = decimals.baseDecimals;
    quoteDecimals = decimals.quoteDecimals;
  } catch (error) {
    console.log(`Using default decimals due to error: ${error}`);
  }

  for (const [table, seconds] of [
    [minuteBuckets, intervals.minute],
    [fiveMinuteBuckets, intervals.fiveMinutes],
    [thirtyMinuteBuckets, intervals.thirtyMinutes],
    [hourBuckets, intervals.hour],
    [dailyBuckets, intervals.day],
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
      baseDecimals,
      quoteDecimals
    );
  }
});

ponder.on(
  "OrderBook:OrderCancelled" as any,
  async ({ event, context }: any) => {
    const id = createHash("sha256")
      .update(`${BigInt(event.args.orderId!)}-${event.log.address!}`)
      .digest("hex");
    await context.db.update(orders, { id: id }).set((row: any) => ({
      status: orderStatus[Number(event.args.status)],
      timestamp: event.args.timestamp,
    }));
  }
);

ponder.on("OrderBook:UpdateOrder" as any, async ({ event, context }: any) => {
  const orderHistoryId = createHash("sha256")
    .update(`${event.transaction.hash}-${event.args.filled}`)
    .digest("hex");
  await context.db.insert(orderHistory).values({
    id: orderHistoryId,
    orderId: event.args.orderId.toString(),
    timestamp: Number(event.args.timestamp),
    filled: BigInt(event.args.filled),
    status: orderStatus[Number(event.args.status)],
    poolId: event.log.address!,
  });

  const id = createHash("sha256")
    .update(`${BigInt(event.args.orderId!)}-${event.log.address!}`)
    .digest("hex");

  await context.db.update(orders, { id: id }).set((row: any) => ({
    status: orderStatus[Number(event.args.status)],
    timestamp: event.args.timestamp,
  }));
});