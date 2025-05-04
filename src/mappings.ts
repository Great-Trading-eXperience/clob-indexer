import { BigInt } from "@graphprotocol/graph-ts";
import {
  Deposit as DepositEvent,
  TransferFrom as TransferFromEvent,
  Withdrawal as WithdrawalEvent,
} from "../generated/BalanceManager/BalanceManager";
import {
  PoolCreated as PoolCreatedEvent,
} from "../generated/PoolManager/PoolManager";
import {
  Balance,
  Order,
  Pool,
  Trade
} from "../generated/schema";
import { OrderBook } from "../generated/templates";
import {
  OrderCancelled as OrderCancelledEvent,
  OrderMatched as OrderMatchedEvent,
  OrderPlaced as OrderPlacedEvent,
  UpdateOrder as UpdateOrderEvent,
} from "../generated/templates/OrderBook/OrderBook";
import { Bucket } from "../goldsky/generated/schema";

export function handlePoolCreated(event: PoolCreatedEvent): void {
  const pool = new Pool(event.params.poolId.toHexString());
  pool.orderBook = event.params.orderBook;
  pool.baseCurrency = event.params.baseCurrency;
  pool.quoteCurrency = event.params.quoteCurrency;
  pool.timestamp = event.block.timestamp;
  pool.save();

  // Start indexing the new OrderBook contract
  OrderBook.create(event.params.orderBook);
}

export function handleDeposit(event: DepositEvent): void {
  const id = event.params.user.toHexString();
  let balance = Balance.load(id);
  if (!balance) {
    balance = new Balance(id);
    balance.user = event.params.user;
    balance.amount = BigInt.fromI32(0);
  }
  balance.amount = event.params.amount;
  balance.save();
}

export function handleWithdrawal(event: WithdrawalEvent): void {
  const id = event.params.user.toHexString();
  const balance = Balance.load(id);
  if (balance) {
    balance.amount = balance.amount.minus(event.params.amount);
    balance.save();
  }
}

export function handleTransferFrom(event: TransferFromEvent): void {
  const fromId = event.params.from.toHexString();
  const toId = event.params.to.toHexString();
  
  let fromBalance = Balance.load(fromId);
  if (fromBalance) {
    fromBalance.amount = fromBalance.amount.minus(event.params.amount);
    fromBalance.save();
  }
  
  let toBalance = Balance.load(toId);
  if (!toBalance) {
    toBalance = new Balance(toId);
    toBalance.user = event.params.to;
    toBalance.amount = BigInt.fromI32(0);
  }
  toBalance.amount = toBalance.amount.plus(event.params.amount);
  toBalance.save();
}

export function handleOrderPlaced(event: OrderPlacedEvent): void {
  const orderId = event.params.orderId.toString();
  const order = new Order(orderId);
  order.user = event.params.user;
  order.side = event.params.side == 0 ? "Buy" : "Sell";
  order.price = event.params.price;
  order.quantity = event.params.quantity;
  order.timestamp = event.block.timestamp;
  order.status = "OPEN";
  order.pool = event.address.toHexString();
  order.save();
}

// Helper function for bucket updates
function updateBuckets(event: OrderPlacedEvent, timestamp: BigInt): void {
  const intervals = [
    ['1m', 60],
    ['5m', 300],
    ['30m', 1800],
    ['1h', 3600],
    ['1d', 86400]
  ];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i][0];
    const seconds = intervals[i][1];
    // Your bucket update logic here
    const timestampId = timestamp.div(BigInt.fromI32(seconds as i32)).times(BigInt.fromI32(seconds as i32));
    const bucketId = crypto.keccak256(Bytes.fromUTF8(`${event.address.toHexString()}-${timestampId.toString()}-${interval}`)).toHexString();
    
    let bucket = Bucket.load(bucketId);
    if (!bucket) {
      bucket = new Bucket(bucketId);
      bucket.open = event.params.price.toBigDecimal();
      bucket.close = event.params.price.toBigDecimal(); 
      bucket.low = event.params.price.toBigDecimal();
      bucket.high = event.params.price.toBigDecimal();
      bucket.average = event.params.price.toBigDecimal();
      bucket.count = 1;
      bucket.pool = event.address.toHexString();
      bucket.timestamp = timestampId;
      bucket.interval = interval;
    } else {
      bucket.close = event.params.price.toBigDecimal();
      bucket.low = event.params.price.toBigDecimal().lt(bucket.low) ? event.params.price.toBigDecimal() : bucket.low;
      bucket.high = event.params.price.toBigDecimal().gt(bucket.high) ? event.params.price.toBigDecimal() : bucket.high;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(event.params.price.toBigDecimal())
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count += 1;
    }
    bucket.save();
  }
}

export function handleOrderMatched(event: OrderMatchedEvent): void {
  const tradeId = event.transaction.hash.toHexString();
  const trade = new Trade(tradeId);
  trade.order = event.params.orderId.toString();
  trade.price = event.params.price;
  trade.quantity = event.params.quantity;
  trade.timestamp = event.block.timestamp;
  trade.save();

  const order = Order.load(event.params.orderId.toString());
  if (order) {
    order.status = "FILLED";
    order.save();
  }

  // Call updateBuckets with the event timestamp
  updateBuckets(event);
}

export function handleOrderCancelled(event: OrderCancelledEvent): void {
  const order = Order.load(event.params.orderId.toString());
  if (order) {
    order.status = "CANCELLED";
    order.save();
  }
}

export function handleUpdateOrder(event: UpdateOrderEvent): void {
  const order = Order.load(event.params.orderId.toString());
  if (order) {
    order.status = "UPDATED";
    order.save();
  }
}

// Update buckets for different intervals
const intervalSeconds = [
  ['1m', 60],
  ['5m', 300],
  ['30m', 1800],
  ['1h', 3600],
  ['1d', 86400]
] as Array<string[]>;

for (let i = 0; i < intervalSeconds.length; i++) {
  const interval = intervalSeconds[i][0];
  const seconds = parseInt(intervalSeconds[i][1].toString()) as i32;
  // Your bucket update logic here
  const timestampId = event.block.timestamp
    .div(BigInt.fromI32(seconds))
    .times(BigInt.fromI32(seconds));

  const bucketId = crypto.keccak256(
    Bytes.fromUTF8(`${event.address.toHexString()}-${timestampId.toString()}-${interval}`)
  ).toHexString();

  let bucket = Bucket.load(bucketId);
  if (!bucket) {
    bucket = new Bucket(bucketId);
    bucket.open = event.params.price.toBigDecimal();
    bucket.close = event.params.price.toBigDecimal();
    bucket.low = event.params.price.toBigDecimal();
    bucket.high = event.params.price.toBigDecimal();
    bucket.average = event.params.price.toBigDecimal();
    bucket.count = 1;
    bucket.pool = event.address.toHexString();
    bucket.timestamp = timestampId;
    bucket.interval = interval;
  } else {
    bucket.close = event.params.price.toBigDecimal();
    bucket.low = event.params.price.toBigDecimal().lt(bucket.low) ? event.params.price.toBigDecimal() : bucket.low;
    bucket.high = event.params.price.toBigDecimal().gt(bucket.high) ? event.params.price.toBigDecimal() : bucket.high;
    bucket.average = bucket.average
      .times(BigDecimal.fromString(bucket.count.toString()))
      .plus(event.params.price.toBigDecimal())
      .div(BigDecimal.fromString((bucket.count + 1).toString()));
    bucket.count += 1;
  }

  bucket.save();
} 