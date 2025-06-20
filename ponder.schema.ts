import { index, onchainTable, relations } from "ponder";

export const pools = onchainTable(
	"pools",
	t => ({
		id: t.hex().primaryKey(),
		chainId: t.integer().notNull(),
		coin: t.varchar(),
		orderBook: t.hex(),
		baseCurrency: t.hex().notNull(),
		quoteCurrency: t.hex().notNull(),
		baseDecimals: t.integer(),
		quoteDecimals: t.integer(),
		volume: t.bigint(),
		volumeInQuote: t.bigint(),
		price: t.bigint(),
		timestamp: t.integer(),
	}),
	(table: any) => ({
		coinIdx: index().on(table.coin),
		chainIdIdx: index().on(table.chainId),
		orderBookIdx: index().on(table.orderBook),
	})
);

export const orders = onchainTable(
	"orders",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		poolId: t.hex().notNull(),
		orderId: t.bigint().notNull(),
		transactionId: t.text(),
		user: t.hex(),
		side: t.varchar(),
		timestamp: t.integer(),
		price: t.bigint(),
		quantity: t.bigint(),
		filled: t.bigint(),
		type: t.varchar(),
		status: t.varchar(),
		expiry: t.integer(),
	}),
	(table: any) => ({
		orderIdx: index().on(table.orderId),
		userIdx: index().on(table.user),
		sideIdx: index().on(table.side),
		statusIdx: index().on(table.status),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
		orderIdChainIdx: index().on(table.orderId, table.chainId),
		poolChainStatusIdx: index().on(table.poolId, table.chainId, table.status),
		poolChainSideIdx: index().on(table.poolId, table.chainId, table.side),
		userPoolIdx: index().on(table.user, table.poolId),
		timestampIdx: index().on(table.timestamp),
	})
);

export const orderHistory = onchainTable(
	"order_history",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		poolId: t.hex().notNull(),
		orderId: t.bigint().notNull(),
		transactionId: t.text(),
		timestamp: t.integer(),
		filled: t.bigint(),
		status: t.varchar(),
	}),
	(table: any) => ({
		orderIdx: index().on(table.orderId),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
		orderIdChainIdx: index().on(table.orderId, table.chainId),
		poolChainTimestampIdx: index().on(table.poolId, table.chainId, table.timestamp),
	})
);

export const orderBookDepth = onchainTable(
	"order_book_depth",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		poolId: t.hex().notNull(),
		side: t.varchar().notNull(),
		price: t.bigint().notNull(),
		quantity: t.bigint().notNull(),
		orderCount: t.integer().notNull(),
		lastUpdated: t.integer().notNull(),
	}),
	table => ({
		poolSideIdx: index().on(table.poolId, table.side),
		poolPriceIdx: index().on(table.poolId, table.price),
		chainIdIdx: index().on(table.chainId),
		lastUpdatedIdx: index().on(table.lastUpdated),
		poolChainSideIdx: index().on(table.poolId, table.chainId, table.side),
		poolChainSidePriceIdx: index().on(table.poolId, table.chainId, table.side, table.price), // Complete depth query coverage
		quantityIdx: index().on(table.quantity),
	})
);

export const orderBookDepthSnapshots = onchainTable(
	"order_book_depth_snapshots",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		poolId: t.hex().notNull(),
		timestamp: t.bigint().notNull(),
		snapshotData: t.text().notNull(),
		sequenceNumber: t.bigint().notNull(),
		changeCount: t.integer().notNull(),
	}),
	table => ({
		poolTimeIdx: index().on(table.poolId, table.timestamp),
		chainIdIdx: index().on(table.chainId),
		sequenceIdx: index().on(table.sequenceNumber),
		poolChainTimestampIdx: index().on(table.poolId, table.chainId, table.timestamp),
	})
);

export const ordersRelations = relations(orders, ({ many, one }) => ({
	orderHistory: many(orderHistory),
	pool: one(pools, {
		fields: [orders.poolId, orders.chainId],
		references: [pools.id, pools.chainId],
	}),
	user: one(balances, {
		fields: [orders.user, orders.chainId],
		references: [balances.user, balances.chainId],
	}),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
	order: one(orders, {
		fields: [orderHistory.orderId],
		references: [orders.orderId],
	}),
	pool: one(pools, {
		fields: [orderHistory.poolId],
		references: [pools.id],
	}),
}));

export const orderBookDepthRelations = relations(orderBookDepth, ({ one }) => ({
	pool: one(pools, {
		fields: [orderBookDepth.poolId, orderBookDepth.chainId],
		references: [pools.id, pools.chainId],
	}),
}));

export const trades = onchainTable(
	"trades",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		transactionId: t.text(),
		poolId: t.hex().notNull(),
		orderId: t.text().notNull(),
		price: t.bigint(),
		quantity: t.bigint(),
		timestamp: t.integer(),
	}),
	table => ({
		transactionIdx: index().on(table.transactionId),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
		orderIdIdx: index().on(table.orderId),
		poolChainTimestampIdx: index().on(table.poolId, table.chainId, table.timestamp),
		timestampIdx: index().on(table.timestamp),
	})
);

export const tradeRelations = relations(trades, ({ one }) => ({
	order: one(orders, { fields: [trades.orderId], references: [orders.id] }),
	pool: one(pools, {
		fields: [trades.poolId],
		references: [pools.id],
	}),
}));

export const orderBookTrades = onchainTable(
	"order_book_trades",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		price: t.bigint(),
		quantity: t.bigint(),
		timestamp: t.integer(),
		transactionId: t.text(),
		side: t.varchar(),
		poolId: t.hex().notNull(),
	}),
	table => ({
		transactionIdx: index().on(table.transactionId),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
		poolChainTimestampIdx: index().on(table.poolId, table.chainId, table.timestamp),
		sideIdx: index().on(table.side),
		timestampIdx: index().on(table.timestamp),
	})
);

const createBucketTable = (tableName: string) =>
	onchainTable(
		tableName,
		t => ({
			id: t.text().primaryKey(),
			chainId: t.integer().notNull(),
			openTime: t.integer().notNull(),
			closeTime: t.integer().notNull(),
			open: t.real().notNull(),
			high: t.real().notNull(),
			low: t.real().notNull(),
			close: t.real().notNull(),
			volume: t.real().notNull(),
			quoteVolume: t.real().notNull(),
			count: t.integer().notNull(),
			takerBuyBaseVolume: t.real().notNull(),
			takerBuyQuoteVolume: t.real().notNull(),
			average: t.real().notNull(),
			poolId: t.hex().notNull(),
		}),
		(table) => ({
			openTimeIdx: index().on(table.openTime),
			poolIdx: index().on(table.poolId),
			chainIdIdx: index().on(table.chainId),
			poolOpenTimeIdx: index().on(table.poolId, table.openTime),
			poolChainOpenTimeIdx: index().on(table.poolId, table.chainId, table.openTime),
			closeTimeIdx: index().on(table.closeTime),
		}));

export const minuteBuckets = createBucketTable("minute_buckets");
export const fiveMinuteBuckets = createBucketTable("five_minute_buckets");
export const thirtyMinuteBuckets = createBucketTable("thirty_minute_buckets");
export const hourBuckets = createBucketTable("hour_buckets");
export const dailyBuckets = createBucketTable("daily_buckets");

export const balances = onchainTable(
	"balances",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		currency: t.hex(),
		amount: t.bigint(),
		lockedAmount: t.bigint(),
	}),
	table => ({
		currencyIdx: index().on(table.currency),
		chainIdIdx: index().on(table.chainId),
		userCurrencyIdx: index().on(table.user, table.currency),
		userChainIdx: index().on(table.user, table.chainId),
	})
);

export const marketMakers = onchainTable(
	"market_makers",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		poolId: t.hex().notNull(),
		amount: t.bigint(),
		lockedAmount: t.bigint(),
		expiry: t.integer(),
	}),
	table => ({
		chainIdIdx: index().on(table.chainId),
		userIdx: index().on(table.user),
		poolIdx: index().on(table.poolId),
		userPoolIdx: index().on(table.user, table.poolId),
		expiryIdx: index().on(table.expiry),
	})
);

export const velockPositions = onchainTable(
	"velock_positions",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		poolId: t.hex().notNull(),
		amount: t.bigint(),
		lockedAmount: t.bigint(),
		expiry: t.integer(),
	}),
	table => ({
		chainIdIdx: index().on(table.chainId),
		userIdx: index().on(table.user),
		poolIdx: index().on(table.poolId),
		userPoolIdx: index().on(table.user, table.poolId),
		expiryIdx: index().on(table.expiry),
	})
);

export const votes = onchainTable(
	"votes",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		poolId: t.hex().notNull(),
		amount: t.bigint(),
		lockedAmount: t.bigint(),
		timestamp: t.integer(),
		expiry: t.integer(),
	}),
	table => ({
		chainIdIdx: index().on(table.chainId),

		// NEW: Additional indexes for vote queries
		userIdx: index().on(table.user),
		poolIdx: index().on(table.poolId),
		userPoolIdx: index().on(table.user, table.poolId),
		timestampIdx: index().on(table.timestamp),
		expiryIdx: index().on(table.expiry),
	})
);

export const currencies = onchainTable(
	"currencies",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		address: t.hex().notNull(),
		name: t.varchar(),
		symbol: t.varchar(),
		decimals: t.integer(),
	}),
	table => ({
		chainIdIdx: index().on(table.chainId),
		addressIdx: index().on(table.address),
		addressChainIdx: index().on(table.address, table.chainId),
		symbolIdx: index().on(table.symbol),
	})
);

export const poolsCurrenciesRelations = relations(pools, ({ one }) => ({
	baseCurrency: one(currencies, {
		fields: [pools.baseCurrency, pools.chainId],
		references: [currencies.address, currencies.chainId],
	}),
	quoteCurrency: one(currencies, {
		fields: [pools.quoteCurrency, pools.chainId],
		references: [currencies.address, currencies.chainId],
	}),
}));

export const balancesCurrenciesRelations = relations(balances, ({ one }) => ({
	currency: one(currencies, {
		fields: [balances.currency, balances.chainId],
		references: [currencies.address, currencies.chainId],
	}),
}));

export const faucetRequests = onchainTable(
	"faucet_requests",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		requester: t.hex().notNull(),
		receiver: t.hex().notNull(),
		token: t.hex().notNull(),
		amount: t.bigint(),
		timestamp: t.integer(),
		transactionId: t.text(),
		blockNumber: t.text(),
	}),
	table => ({
		requesterIdx: index().on(table.requester),
		tokenIdx: index().on(table.token),
		chainIdIdx: index().on(table.chainId),
		timestampIdx: index().on(table.timestamp),
	})
);

export const faucetDeposits = onchainTable(
	"faucet_deposits",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		depositor: t.hex().notNull(),
		token: t.hex().notNull(),
		amount: t.bigint(),
		timestamp: t.integer(),
		transactionId: t.text(),
		blockNumber: t.text(),
	}),
	table => ({
		depositorIdx: index().on(table.depositor),
		tokenIdx: index().on(table.token),
		chainIdIdx: index().on(table.chainId),
		timestampIdx: index().on(table.timestamp),
	})
);

export const faucetTokens = onchainTable(
	"faucet_tokens",
	t => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		token: t.hex().notNull(),
		timestamp: t.integer(),
		transactionId: t.text(),
		blockNumber: t.text(),
	}),
	table => ({
		tokenIdx: index().on(table.token),
		chainIdIdx: index().on(table.chainId),
		timestampIdx: index().on(table.timestamp),
	})
);
