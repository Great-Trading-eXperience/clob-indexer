import { index, onchainTable, relations } from "ponder";

export const orders = onchainTable("orders", (t: any) => ({
  id: t.bigint().primaryKey(),
  user: t.hex(),
  coin: t.varchar(),
  side: t.varchar(),
  timestamp: t.integer(),
  price: t.bigint(),
  quantity: t.bigint(),
  filled: t.bigint(),
  type: t.varchar(),
  status: t.varchar(),
  expiry: t.integer(),
}), (table: any) => ({
  coinIdx: index().on(table.coin),
  userIdx: index().on(table.user),
  sideIdx: index().on(table.side),
  statusIdx: index().on(table.status),
}));

export const orderHistory = onchainTable("order_history", (t: any) => ({
  id: t.text().primaryKey(),
  orderId: t.bigint(),
  timestamp: t.integer(),
  filled: t.bigint(),
  status: t.varchar(),
}), (table: any) => ({
  orderIdx: index().on(table.orderId),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  orderHistory: many(orderHistory),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
  order: one(orders, { fields: [orderHistory.orderId], references: [orders.id] }),
}));

export const trades = onchainTable("trades", (t) => ({
  id: t.text().primaryKey(),
  transactionId: t.text(),
  orderId: t.bigint(),
  price: t.bigint(),
  quantity: t.bigint(),
  timestamp: t.integer(),
}),
  (table) => ({
    transactionIdx: index().on(table.transactionId),
  })
);

export const tradeRelations = relations(trades, ({ one }) => ({
  order: one(orders, { fields: [trades.orderId], references: [orders.id] }),
}));

export const orderBookTrades = onchainTable("order_book_trades", (t) => ({
  id: t.text().primaryKey(),
  price: t.bigint(),
  quantity: t.bigint(),
  timestamp: t.integer(),
  transactionId: t.text(),
  side: t.varchar(),
}),
  (table) => ({
    transactionIdx: index().on(table.transactionId),
  }));

export const hourBuckets = onchainTable("hour_buckets", (t) => ({
  id: t.integer().primaryKey(),
  open: t.real().notNull(),
  close: t.real().notNull(),
  low: t.real().notNull(),
  high: t.real().notNull(),
  average: t.real().notNull(),
  count: t.integer().notNull(),
}));

export const dailyBuckets = onchainTable("daily_buckets", (t) => ({
  id: t.integer().primaryKey(),
  open: t.real().notNull(),
  close: t.real().notNull(),
  low: t.real().notNull(),
  high: t.real().notNull(),
  average: t.real().notNull(),
  count: t.integer().notNull(),
}));