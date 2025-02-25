export const PoolManagerABI: any[] = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_owner",
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
		name: "createPool",
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
				name: "_lotSize",
				type: "uint256",
				internalType: "uint256",
			},
			{
				name: "_maxOrderAmount",
				type: "uint256",
				internalType: "uint256",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getPool",
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
		],
		outputs: [
			{
				name: "",
				type: "tuple",
				internalType: "struct IPoolManager.Pool",
				components: [
					{
						name: "maxOrderAmount",
						type: "uint256",
						internalType: "uint256",
					},
					{
						name: "lotSize",
						type: "uint256",
						internalType: "uint256",
					},
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
					{
						name: "orderBook",
						type: "address",
						internalType: "contract IOrderBook",
					},
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getPoolId",
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
		],
		outputs: [
			{
				name: "",
				type: "bytes32",
				internalType: "PoolId",
			},
		],
		stateMutability: "pure",
	},
	{
		type: "function",
		name: "owner",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "pools",
		inputs: [
			{
				name: "",
				type: "bytes32",
				internalType: "PoolId",
			},
		],
		outputs: [
			{
				name: "maxOrderAmount",
				type: "uint256",
				internalType: "uint256",
			},
			{
				name: "lotSize",
				type: "uint256",
				internalType: "uint256",
			},
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
			{
				name: "orderBook",
				type: "address",
				internalType: "contract IOrderBook",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "renounceOwnership",
		inputs: [],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "setRouter",
		inputs: [
			{
				name: "_router",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "transferOwnership",
		inputs: [
			{
				name: "newOwner",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "event",
		name: "OwnershipTransferred",
		inputs: [
			{
				name: "previousOwner",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newOwner",
				type: "address",
				indexed: true,
				internalType: "address",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "PoolCreated",
		inputs: [
			{
				name: "id",
				type: "bytes32",
				indexed: true,
				internalType: "PoolId",
			},
			{
				name: "orderBook",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "baseCurrency",
				type: "address",
				indexed: false,
				internalType: "Currency",
			},
			{
				name: "quoteCurrency",
				type: "address",
				indexed: false,
				internalType: "Currency",
			},
			{
				name: "lotSize",
				type: "uint256",
				indexed: false,
				internalType: "uint256",
			},
			{
				name: "maxOrderAmount",
				type: "uint256",
				indexed: false,
				internalType: "uint256",
			},
		],
		anonymous: false,
	},
	{
		type: "error",
		name: "InvalidRouter",
		inputs: [],
	},
	{
		type: "error",
		name: "OwnableInvalidOwner",
		inputs: [
			{
				name: "owner",
				type: "address",
				internalType: "address",
			},
		],
	},
	{
		type: "error",
		name: "OwnableUnauthorizedAccount",
		inputs: [
			{
				name: "account",
				type: "address",
				internalType: "address",
			},
		],
	},
] as const;
