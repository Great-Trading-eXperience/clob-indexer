export const GTXRouterABI: any[] = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_poolManager",
				type: "address",
				internalType: "address",
			},
			{
				name: "_balanceManager",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "balanceManager",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "contract IBalanceManager",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "cancelOrder",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
			{
				name: "orderId",
				type: "uint48",
				internalType: "OrderId",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getBestPrice",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
		],
		outputs: [
			{
				name: "",
				type: "tuple",
				internalType: "struct IOrderBook.PriceVolume",
				components: [
					{
						name: "price",
						type: "uint64",
						internalType: "Price",
					},
					{
						name: "volume",
						type: "uint256",
						internalType: "uint256",
					},
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getNextBestPrices",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
			{
				name: "count",
				type: "uint8",
				internalType: "uint8",
			},
		],
		outputs: [
			{
				name: "",
				type: "tuple[]",
				internalType: "struct IOrderBook.PriceVolume[]",
				components: [
					{
						name: "price",
						type: "uint64",
						internalType: "Price",
					},
					{
						name: "volume",
						type: "uint256",
						internalType: "uint256",
					},
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getOrderQueue",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
		],
		outputs: [
			{
				name: "orderCount",
				type: "uint48",
				internalType: "uint48",
			},
			{
				name: "totalVolume",
				type: "uint256",
				internalType: "uint256",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getUserActiveOrders",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "user",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [
			{
				name: "",
				type: "tuple[]",
				internalType: "struct IOrderBook.Order[]",
				components: [
					{
						name: "id",
						type: "uint48",
						internalType: "OrderId",
					},
					{
						name: "user",
						type: "address",
						internalType: "address",
					},
					{
						name: "next",
						type: "uint48",
						internalType: "OrderId",
					},
					{
						name: "prev",
						type: "uint48",
						internalType: "OrderId",
					},
					{
						name: "timestamp",
						type: "uint48",
						internalType: "uint48",
					},
					{
						name: "expiry",
						type: "uint48",
						internalType: "uint48",
					},
					{
						name: "price",
						type: "uint64",
						internalType: "Price",
					},
					{
						name: "status",
						type: "uint8",
						internalType: "enum Status",
					},
					{
						name: "quantity",
						type: "uint128",
						internalType: "Quantity",
					},
					{
						name: "filled",
						type: "uint128",
						internalType: "Quantity",
					},
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "placeMarketOrder",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "quantity",
				type: "uint128",
				internalType: "Quantity",
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
		],
		outputs: [
			{
				name: "orderId",
				type: "uint48",
				internalType: "OrderId",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "placeMarketOrderWithDeposit",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
			{
				name: "quantity",
				type: "uint128",
				internalType: "Quantity",
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
		],
		outputs: [
			{
				name: "orderId",
				type: "uint48",
				internalType: "OrderId",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "placeOrder",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
			{
				name: "quantity",
				type: "uint128",
				internalType: "Quantity",
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
		],
		outputs: [
			{
				name: "orderId",
				type: "uint48",
				internalType: "OrderId",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "placeOrderWithDeposit",
		inputs: [
			{
				name: "key",
				type: "tuple",
				internalType: "struct PoolKey",
				components: [
					{
						name: "baseCurrency",
						type: "address",
						internalType: "Currency",
					},
					{
						name: "quoteCurrency",
						type: "address",
						internalType: "Currency",
					},
				],
			},
			{
				name: "price",
				type: "uint64",
				internalType: "Price",
			},
			{
				name: "quantity",
				type: "uint128",
				internalType: "Quantity",
			},
			{
				name: "side",
				type: "uint8",
				internalType: "enum Side",
			},
		],
		outputs: [
			{
				name: "orderId",
				type: "uint48",
				internalType: "OrderId",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "poolManager",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "contract IPoolManager",
			},
		],
		stateMutability: "view",
	},
] as const;
