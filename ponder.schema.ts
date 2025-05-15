import { index, onchainTable, relations } from "ponder";

export const pools = onchainTable(
	"pools",
	(t: any) => ({
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

export const trades = onchainTable(
	"trades",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		transactionId: t.text(),
		poolId: t.hex().notNull(),
		orderId: t.text().notNull(),
		price: t.bigint(),
		quantity: t.bigint(),
		timestamp: t.integer(),
	}),
	(table: any) => ({
		transactionIdx: index().on(table.transactionId),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
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
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		price: t.bigint(),
		quantity: t.bigint(),
		timestamp: t.integer(),
		transactionId: t.text(),
		side: t.varchar(),
		poolId: t.hex().notNull(),
	}),
	(table: any) => ({
		transactionIdx: index().on(table.transactionId),
		poolIdx: index().on(table.poolId),
		chainIdIdx: index().on(table.chainId),
	})
);

const createBucketTable = (tableName: string) =>
	onchainTable(
		tableName,
		(t: any) => ({
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
		(table: any) => ({
			openTimeIdx: index().on(table.openTime),
			poolIdx: index().on(table.poolId),
			chainIdIdx: index().on(table.chainId),
		})
	);

export const minuteBuckets = createBucketTable("minute_buckets");
export const fiveMinuteBuckets = createBucketTable("five_minute_buckets");
export const thirtyMinuteBuckets = createBucketTable("thirty_minute_buckets");
export const hourBuckets = createBucketTable("hour_buckets");
export const dailyBuckets = createBucketTable("daily_buckets");

export const balances = onchainTable(
	"balances",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		currency: t.hex(),
		amount: t.bigint(),
		lockedAmount: t.bigint(),
	}),
	(table: any) => ({
		currencyIdx: index().on(table.currency),
		chainIdIdx: index().on(table.chainId),
	})
);

export const marketMaker = onchainTable("market_makers", (t: any) => ({
	id: t.text().primaryKey(),
	name: t.text(),
	symbol: t.text(),
}));

export const marketMakers = onchainTable(
	"pool_market_makers",
	(t: any) => ({
		id: t.text().primaryKey(),
		name: t.text(),
		symbol: t.text(),
		chainId: t.integer().notNull(),
		marketMakerId: t.hex().notNull(),
		// amount: t.bigint(),
		// lockedAmount: t.bigint(),
	}),
	(table: any) => ({
		chainIdIdx: index().on(table.chainId),
		marketMakerIdx: index().on(table.marketMakerId),
	})
);

export const votingPools = onchainTable(
	"ve_pools",
	t => ({
		id: t.text().primaryKey(),
		marketMakerId: t.hex(), // pools in vetoken perspective
		chainId: t.integer().notNull(),
		active: t.boolean(),
	}),
	table => ({
		chainIdIdx: index().on(table.chainId),
		marketMakerIdx: index().on(table.marketMakerId),
	})
);

export const velockPositions = onchainTable("velock_positions", t => ({
	id: t.text().primaryKey(),
	chainId: t.integer().notNull(),
	user: t.hex(),
	amount: t.bigint(),
	expiry: t.integer(),
}));

export const marketMakerRewards = onchainTable("market_maker_rewards", (t: any) => ({
	id: t.text().primaryKey(),
	marketMakerId: t.hex(),
	amount: t.bigint(),
}));

// export const incentiveBalances = onchainTable(
// 	"incentive_balances",
// 	(t) => ({
// 		id: t.text().primaryKey(),
// 		chainId: t.integer().notNull(),
// 		user: t.hex(),
// 		amount: t.bigint(),
// 		expiry: t.integer(),
// 	}),
// 	(table) => ({})
// );

export const votingEscrow = onchainTable(
	"voting_escrow",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		totalSupply: t.json().$type<{ bias: bigint; slope: bigint }>(),
		timestamp: t.integer(),
		amount: t.bigint(),
		expiry: t.integer(),
	}),
	(table: any) => ({
		chainIdIdx: index().on(table.chainId),
	})
);

export const votes = onchainTable(
	"votes",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		user: t.hex(),
		poolId: t.hex().notNull(),
		// amount: t.bigint(),
		// lockedAmount: t.bigint(),
		weight: t.bigint(),
		timestamp: t.integer(),
		expiry: t.integer(),
	}),
	(table: any) => ({
		chainIdIdx: index().on(table.chainId),
	})
);

export const currencies = onchainTable(
	"currencies",
	(t: any) => ({
		id: t.text().primaryKey(),
		chainId: t.integer().notNull(),
		address: t.hex().notNull(),
		name: t.varchar(),
		symbol: t.varchar(),
		decimals: t.integer(),
	}),
	(table: any) => ({
		chainIdIdx: index().on(table.chainId),
		addressIdx: index().on(table.address),
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
