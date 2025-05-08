import { createConfig, factory } from "ponder";
import { getAddress, http, parseAbiItem } from "viem";
import { BalanceManagerABI } from "./abis/BalanceManager";
import { GTXRouterABI } from "./abis/GTXRouter";
import { OrderBookABI } from "./abis/OrderBook";
import { PoolManagerABI } from "./abis/PoolManager";
import dotenv from "dotenv";
import { VotingControllerABI } from "./abis/VotingController";
import { MarketMakerFactoryABI } from "./abis/MarketMakerFactory";
import { MarketMakerABI } from "./abis/MarketMaker";
import { GaugeControllerABI } from "./abis/GaugeControllerMainchain";
import { VotingEscrowABI } from "./abis/VotingEscrowMainchain";

dotenv.config();

const default_address = getAddress("0x0000000000000000000000000000000000000000");

const contracts: any = {
	OrderBook: {
		abi: OrderBookABI,
		network: "network",
		address: factory({
			address: getAddress(process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) || default_address,
			event: parseAbiItem(
				"event PoolCreated(bytes32 indexed poolId, address orderBook, address baseCurrency, address quoteCurrency)"
			),
			parameter: "orderBook",
		}),
		startBlock: process.env.START_BLOCK as number | undefined,
	},
	PoolManager: {
		abi: PoolManagerABI || [],
		network: "network",
		address: getAddress((process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	BalanceManager: {
		abi: BalanceManagerABI || [],
		network: "network",
		address: getAddress((process.env.BALANCEMANAGER_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	GTXRouter: {
		abi: GTXRouterABI || [],
		network: "network",
		address: getAddress((process.env.GTXROUTER_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	VotingController: {
		abi: VotingControllerABI || [],
		network: "network",
		address: getAddress((process.env.VOTINGCONTROLLER_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	VotingEscrow: {
		abi: VotingEscrowABI || [],
		network: "network",
		address: getAddress((process.env.VOTINGESCROW_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	GaugeController: {
		abi: GaugeControllerABI || [],
		network: "network",
		address: getAddress((process.env.GAUGECONTROLLER_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	MarketMaker: {
		abi: MarketMakerABI,
		network: "network",
		address: factory({
			address: getAddress(process.env.MARKETMAKERFACTORY_CONTRACT_ADDRESS as `0x${string}`) || default_address,
			event: parseAbiItem("event MarketMakerCreated(address indexed marketMaker, string name, string symbol)"),
			parameter: "marketMaker",
		}),
		startBlock: process.env.START_BLOCK as number | undefined,
	},
	MarketMakerFactory: {
		abi: MarketMakerFactoryABI || [],
		network: "network",
		address: getAddress((process.env.MARKETMAKERFACTORY_CONTRACT_ADDRESS as `0x${string}`) || default_address),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
};

export default createConfig({
	database: {
		kind: "postgres",
		connectionString: process.env.PONDER_DATABASE_URL,
	},
	networks: {
		network: {
			chainId: Number(process.env.CHAIN_ID),
			transport: http(process.env.PONDER_RPC_URL),
			pollingInterval: Number(process.env.POLLING_INTERVAL) || 10000,
			maxRequestsPerSecond: Number(process.env.MAX_REQUESTS_PER_SECOND) || 5,
		},
	},
	contracts: contracts,
});
