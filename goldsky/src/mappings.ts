import { Address, BigDecimal, BigInt, Bytes, crypto } from '@graphprotocol/graph-ts';
import {
  PoolCreated
} from '../generated/PoolManager/PoolManager';
import {
  Balance,
  DailyBucket,
  FiveMinuteBucket,
  HourBucket,
  MinuteBucket,
  Order,
  OrderBookTrade,
  OrderHistory,
  Pool,
  ThirtyMinuteBucket,
  Trade
} from '../generated/schema';
import { OrderBook } from '../generated/templates';
import {
  OrderCancelled,
  OrderMatched,
  OrderPlaced,
  UpdateOrder
} from '../generated/templates/OrderBook/OrderBook';
import { Deposit, TransferFrom, Withdrawal } from '../generated/BalanceManager/BalanceManager';

const ORDER_STATUS = [
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'EXPIRED'
];

function getIntervalSeconds(interval: string): BigInt {
  if (interval == '1m') return BigInt.fromI32(60);
  if (interval == '5m') return BigInt.fromI32(300);
  if (interval == '30m') return BigInt.fromI32(1800);
  if (interval == '1h') return BigInt.fromI32(3600);
  if (interval == '1d') return BigInt.fromI32(86400);
  return BigInt.fromI32(60);
}

function createBucketId(poolAddress: string, timestamp: BigInt, interval: string): string {
  return crypto.keccak256(
    Bytes.fromUTF8(`${poolAddress}-${timestamp.toString()}-${interval}`)
  ).toHexString();
}

const bucketNames = ['MinuteBucket', 'FiveMinuteBucket', 'ThirtyMinuteBucket', 'HourBucket', 'DailyBucket'];
const bucketIntervals = [60, 300, 1800, 3600, 86400];

function updateBucket(
  entity: string,
  poolAddress: string,
  price: BigInt,
  timestamp: BigInt,
  intervalSeconds: number
): void {
  const timestampId = timestamp
    .div(BigInt.fromI32(intervalSeconds as i32))
    .times(BigInt.fromI32(intervalSeconds as i32));
  
  const bucketId = poolAddress
    .concat('-')
    .concat(timestampId.toString());

  const priceDecimal = price.toBigDecimal();
  
  if (entity == 'MinuteBucket') {
    let bucket = MinuteBucket.load(bucketId);
    if (!bucket) {
      bucket = new MinuteBucket(bucketId);
      bucket.pool = poolAddress;
      bucket.timestamp = timestampId;
      bucket.open = priceDecimal;
      bucket.high = priceDecimal;
      bucket.low = priceDecimal;
      bucket.close = priceDecimal;
      bucket.average = priceDecimal;
      bucket.count = 1;
    } else {
      bucket.high = priceDecimal.gt(bucket.high) ? priceDecimal : bucket.high;
      bucket.low = priceDecimal.lt(bucket.low) ? priceDecimal : bucket.low;
      bucket.close = priceDecimal;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(priceDecimal)
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count = bucket.count + 1;
    }
    bucket.save();
  } else if (entity == 'FiveMinuteBucket') {
    let bucket = FiveMinuteBucket.load(bucketId);
    if (!bucket) {
      bucket = new FiveMinuteBucket(bucketId);
      bucket.pool = poolAddress;
      bucket.timestamp = timestampId;
      bucket.open = priceDecimal;
      bucket.high = priceDecimal;
      bucket.low = priceDecimal;
      bucket.close = priceDecimal;
      bucket.average = priceDecimal;
      bucket.count = 1;
    } else {
      bucket.high = priceDecimal.gt(bucket.high) ? priceDecimal : bucket.high;
      bucket.low = priceDecimal.lt(bucket.low) ? priceDecimal : bucket.low;
      bucket.close = priceDecimal;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(priceDecimal)
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count = bucket.count + 1;
    }
    bucket.save();
  } else if (entity == 'ThirtyMinuteBucket') {
    let bucket = ThirtyMinuteBucket.load(bucketId);
    if (!bucket) {
      bucket = new ThirtyMinuteBucket(bucketId);
      bucket.pool = poolAddress;
      bucket.timestamp = timestampId;
      bucket.open = priceDecimal;
      bucket.high = priceDecimal;
      bucket.low = priceDecimal;
      bucket.close = priceDecimal;
      bucket.average = priceDecimal;
      bucket.count = 1;
    } else {
      bucket.high = priceDecimal.gt(bucket.high) ? priceDecimal : bucket.high;
      bucket.low = priceDecimal.lt(bucket.low) ? priceDecimal : bucket.low;
      bucket.close = priceDecimal;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(priceDecimal)
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count = bucket.count + 1;
    }
    bucket.save();
  } else if (entity == 'HourBucket') {
    let bucket = HourBucket.load(bucketId);
    if (!bucket) {
      bucket = new HourBucket(bucketId);
      bucket.pool = poolAddress;
      bucket.timestamp = timestampId;
      bucket.open = priceDecimal;
      bucket.high = priceDecimal;
      bucket.low = priceDecimal;
      bucket.close = priceDecimal;
      bucket.average = priceDecimal;
      bucket.count = 1;
    } else {
      bucket.high = priceDecimal.gt(bucket.high) ? priceDecimal : bucket.high;
      bucket.low = priceDecimal.lt(bucket.low) ? priceDecimal : bucket.low;
      bucket.close = priceDecimal;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(priceDecimal)
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count = bucket.count + 1;
    }
    bucket.save();
  } else if (entity == 'DailyBucket') {
    let bucket = DailyBucket.load(bucketId);
    if (!bucket) {
      bucket = new DailyBucket(bucketId);
      bucket.pool = poolAddress;
      bucket.timestamp = timestampId;
      bucket.open = priceDecimal;
      bucket.high = priceDecimal;
      bucket.low = priceDecimal;
      bucket.close = priceDecimal;
      bucket.average = priceDecimal;
      bucket.count = 1;
    } else {
      bucket.high = priceDecimal.gt(bucket.high) ? priceDecimal : bucket.high;
      bucket.low = priceDecimal.lt(bucket.low) ? priceDecimal : bucket.low;
      bucket.close = priceDecimal;
      bucket.average = bucket.average
        .times(BigDecimal.fromString(bucket.count.toString()))
        .plus(priceDecimal)
        .div(BigDecimal.fromString((bucket.count + 1).toString()));
      bucket.count = bucket.count + 1;
    }
    bucket.save();
  }
}

export function handleOrderPlaced(event: OrderPlaced): void {
  const id = crypto.keccak256(
    Bytes.fromUTF8(`${event.params.orderId.toString()}-${event.address.toHexString()}`)
  ).toHexString();

  let order = new Order(id);
  order.pool = event.address.toHexString();
  order.orderId = event.params.orderId;
  order.user = event.params.user;
  order.side = event.params.side ? 'Sell' : 'Buy';
  order.timestamp = event.block.timestamp;
  order.price = event.params.price;
  order.quantity = event.params.quantity;
  order.orderValue = event.params.price.times(event.params.quantity);
  order.filled = BigInt.fromI32(0);
  order.type = event.params.isMarketOrder ? 'Market' : 'Limit';
  order.status = ORDER_STATUS[event.params.status];
  order.expiry = event.params.expiry;
  order.save();

  let history = new OrderHistory(event.transaction.hash.toHexString());
  history.pool = event.address.toHexString();
  history.order = id;
  history.orderId = event.params.orderId.toString();
  history.timestamp = event.block.timestamp;
  history.quantity = event.params.quantity;
  history.filled = BigInt.fromI32(0);
  history.status = ORDER_STATUS[event.params.status];
  history.save();
}

export function handleOrderMatched(event: OrderMatched): void {
  // Create OrderBookTrade
  const tradeId = crypto.keccak256(
    Bytes.fromUTF8(
      `${event.transaction.hash.toHexString()}-${event.params.user.toHexString()}-${event.params.buyOrderId.toString()}-${event.params.sellOrderId.toString()}-${event.params.executionPrice.toString()}-${event.params.executedQuantity.toString()}`
    )
  ).toHexString();

  let orderBookTrade = new OrderBookTrade(tradeId);
  orderBookTrade.price = event.params.executionPrice;
  orderBookTrade.quantity = event.params.executedQuantity;
  orderBookTrade.timestamp = event.params.timestamp;
  orderBookTrade.transactionId = event.transaction.hash.toHexString();
  orderBookTrade.side = event.params.side ? 'Sell' : 'Buy';
  orderBookTrade.pool = event.address.toHexString();
  orderBookTrade.save();

  // Create Trade for buy order
  const buyOrderId = crypto.keccak256(
    Bytes.fromUTF8(`${event.params.buyOrderId.toString()}-${event.address.toHexString()}`)
  ).toHexString();

  let buyTrade = new Trade(
    crypto.keccak256(
      Bytes.fromUTF8(
        `${event.transaction.hash.toHexString()}-buy-${event.params.buyOrderId.toString()}-${event.params.sellOrderId.toString()}`
      )
    ).toHexString()
  );
  buyTrade.transactionId = event.transaction.hash.toHexString();
  buyTrade.order = buyOrderId;
  buyTrade.pool = event.address.toHexString();
  buyTrade.timestamp = event.block.timestamp;
  buyTrade.price = event.params.executionPrice;
  buyTrade.quantity = event.params.executedQuantity;
  buyTrade.save();

  // Update buy order
  let buyOrder = Order.load(buyOrderId);
  if (buyOrder) {
    const currentFilled = buyOrder.filled;
    const quantity = buyOrder.quantity;
    if (currentFilled && quantity) {
      const newFilled = currentFilled.plus(event.params.executedQuantity);
      buyOrder.filled = newFilled;
      buyOrder.status = newFilled.equals(quantity) ? 'FILLED' : 'PARTIALLY_FILLED';
      buyOrder.save();

      // Create order history
      let buyHistory = new OrderHistory(event.transaction.hash.toHexString().concat('-buy'));
      buyHistory.pool = event.address.toHexString();
      buyHistory.order = buyOrderId;
      buyHistory.orderId = event.params.buyOrderId.toString();
      buyHistory.timestamp = event.block.timestamp;
      buyHistory.quantity = quantity;
      buyHistory.filled = newFilled;
      buyHistory.status = buyOrder.status;
      buyHistory.save();
    }
  }

  // Create Trade for sell order
  const sellOrderId = crypto.keccak256(
    Bytes.fromUTF8(`${event.params.sellOrderId.toString()}-${event.address.toHexString()}`)
  ).toHexString();

  let sellTrade = new Trade(
    crypto.keccak256(
      Bytes.fromUTF8(
        `${event.transaction.hash.toHexString()}-sell-${event.params.sellOrderId.toString()}-${event.params.buyOrderId.toString()}`
      )
    ).toHexString()
  );
  sellTrade.transactionId = event.transaction.hash.toHexString();
  sellTrade.order = sellOrderId;
  sellTrade.pool = event.address.toHexString();
  sellTrade.timestamp = event.block.timestamp;
  sellTrade.price = event.params.executionPrice;
  sellTrade.quantity = event.params.executedQuantity;
  sellTrade.save();

  // Update sell order
  let sellOrder = Order.load(sellOrderId);
  if (sellOrder) {
    const currentFilled = sellOrder.filled;
    const quantity = sellOrder.quantity;
    if (currentFilled && quantity) {
      const newFilled = currentFilled.plus(event.params.executedQuantity);
      sellOrder.filled = newFilled;
      sellOrder.status = newFilled.equals(quantity) ? 'FILLED' : 'PARTIALLY_FILLED';
      sellOrder.save();

      // Create order history
      let sellHistory = new OrderHistory(event.transaction.hash.toHexString().concat('-sell'));
      sellHistory.pool = event.address.toHexString();
      sellHistory.order = sellOrderId;
      sellHistory.orderId = event.params.sellOrderId.toString();
      sellHistory.timestamp = event.block.timestamp;
      sellHistory.quantity = quantity;
      sellHistory.filled = newFilled;
      sellHistory.status = sellOrder.status;
      sellHistory.save();
    }
  }

  for (let i = 0; i < bucketNames.length; i++) {
    updateBucket(
      bucketNames[i],
      event.address.toHexString(),
      event.params.executionPrice,
      event.params.timestamp,
      bucketIntervals[i]
    );
  }
}

export function handleOrderCancelled(event: OrderCancelled): void {
  const id = crypto.keccak256(
    Bytes.fromUTF8(`${event.params.orderId.toString()}-${event.address.toHexString()}`)
  ).toHexString();
  
  let order = Order.load(id);
  if (order) {
    order.status = ORDER_STATUS[event.params.status];
    order.timestamp = event.params.timestamp;
    order.save();
  }
}

export function handleUpdateOrder(event: UpdateOrder): void {
  const orderHistoryId = crypto.keccak256(
    Bytes.fromUTF8(`${event.transaction.hash.toHexString()}-${event.params.filled.toString()}`)
  ).toHexString();

  const orderId = crypto.keccak256(
    Bytes.fromUTF8(`${event.params.orderId.toString()}-${event.address.toHexString()}`)
  ).toHexString();

  let order = Order.load(orderId);
  if (order) {
    let history = new OrderHistory(orderHistoryId);
    history.pool = event.address.toHexString();
    history.order = orderId;
    history.orderId = event.params.orderId.toString();
    history.timestamp = event.params.timestamp;
    history.quantity = order.quantity;
    history.filled = event.params.filled;
    history.status = ORDER_STATUS[event.params.status];
    history.save();

    order.status = ORDER_STATUS[event.params.status];
    order.timestamp = event.params.timestamp;
    order.save();
  }
}

export function handlePoolCreated(event: PoolCreated): void {
  const poolId = event.params.poolId.toHexString();
  let pool = new Pool(poolId);
  pool.coin = `${event.params.baseCurrency}/${event.params.quoteCurrency}`;
  pool.orderBook = event.params.orderBook;
  pool.baseCurrency = event.params.baseCurrency;
  pool.quoteCurrency = event.params.quoteCurrency;
  pool.timestamp = event.block.timestamp;
  pool.save();

  // Create a new OrderBook template instance
  OrderBook.create(event.params.orderBook);
}

function fromId(id: BigInt): Bytes {
  let hexString = id.toHexString().slice(2) // Remove '0x' prefix
  while (hexString.length < 40) {
    hexString = "0" + hexString
  }
  return Bytes.fromHexString("0x" + hexString)
}

function getOrCreateBalance(user: Bytes): Balance {
  let balance = Balance.load(user.toHexString())
  if (balance == null) {
    balance = new Balance(user.toHexString())
    balance.user = user
    balance.amount = BigInt.fromI32(0)
    balance.lockedAmount = BigInt.fromI32(0)
    balance.name = ""
    balance.symbol = ""
  }
  return balance
}

export function handleDeposit(event: Deposit): void {
  let currency = fromId(event.params.id)
  
  let balance = getOrCreateBalance(event.params.user)
  balance.name = ""
  balance.symbol = ""
  balance.currency = currency
  balance.amount = balance.amount.plus(event.params.amount)
  balance.save()
}

export function handleWithdrawal(event: Withdrawal): void {
  let balance = getOrCreateBalance(event.params.user)
  balance.amount = balance.amount.minus(event.params.amount)
  balance.save()
}

export function handleTransferFrom(event: TransferFrom): void {
  let currency = fromId(event.params.id)
  let netAmount = event.params.amount.minus(event.params.feeAmount)
  
  // Update sender balance
  let senderBalance = getOrCreateBalance(event.params.sender)
  senderBalance.currency = currency
  senderBalance.amount = senderBalance.amount.minus(event.params.amount)
  senderBalance.save()
  
  // Update receiver balance
  let receiverBalance = getOrCreateBalance(event.params.receiver)
  receiverBalance.currency = currency
  receiverBalance.amount = receiverBalance.amount.plus(netAmount)
  receiverBalance.save()
  
  // Update operator balance  
  let operatorBalance = getOrCreateBalance(event.params.operator)
  operatorBalance.currency = currency
  operatorBalance.amount = operatorBalance.amount.plus(event.params.feeAmount)
  operatorBalance.save()
}