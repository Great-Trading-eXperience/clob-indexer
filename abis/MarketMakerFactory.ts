export const MarketMakerFactoryABI: any[] = [
	{
		type: "constructor",
		inputs: [
			{ name: "_veToken", type: "address", internalType: "address" },
			{
				name: "_gaugeController",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "createMarketMaker",
		inputs: [
			{ name: "name", type: "string", internalType: "string" },
			{ name: "symbol", type: "string", internalType: "string" },
		],
		outputs: [{ name: "", type: "address", internalType: "address" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "gaugeController",
		inputs: [],
		outputs: [{ name: "", type: "address", internalType: "address" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "isValidMarketMaker",
		inputs: [
			{ name: "_marketMaker", type: "address", internalType: "address" },
		],
		outputs: [{ name: "", type: "bool", internalType: "bool" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "marketMakers",
		inputs: [{ name: "", type: "address", internalType: "address" }],
		outputs: [{ name: "", type: "bool", internalType: "bool" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "setGaugeController",
		inputs: [
			{
				name: "_gaugeController",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "setVeToken",
		inputs: [{ name: "_veToken", type: "address", internalType: "address" }],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "veToken",
		inputs: [],
		outputs: [{ name: "", type: "address", internalType: "address" }],
		stateMutability: "view",
	},
	{
		type: "event",
		name: "GaugeControllerUpdated",
		inputs: [
			{
				name: "oldGaugeController",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newGaugeController",
				type: "address",
				indexed: true,
				internalType: "address",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "MarketMakerCreated",
		inputs: [
			{
				name: "marketMaker",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "name",
				type: "string",
				indexed: false,
				internalType: "string",
			},
			{
				name: "symbol",
				type: "string",
				indexed: false,
				internalType: "string",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "VeTokenUpdated",
		inputs: [
			{
				name: "oldVeToken",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newVeToken",
				type: "address",
				indexed: true,
				internalType: "address",
			},
		],
		anonymous: false,
	},
];
