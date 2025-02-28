import { createConfig, factory } from "ponder";
import { getAddress, http, parseAbiItem } from "viem";
import { BalanceManagerABI } from "./abis/BalanceManager";
import { GTXRouterABI } from "./abis/GTXRouter";
import { OrderBookABI } from "./abis/OrderBook";
import { PoolManagerABI } from "./abis/PoolManager";

const chainId = 11155931;
const default_address = getAddress(
	"0x0000000000000000000000000000000000000000"
);

const contracts: any = {
	OrderBook: {
		abi: OrderBookABI,
		network: "riseSepolia",
		address: factory({
			address:
				getAddress(process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
				default_address,
			event: parseAbiItem(
				"event PoolCreated(bytes32 indexed id, address indexed orderBook, address baseCurrency, address quoteCurrency, uint256 lotSize, uint256 maxOrderAmount)"
			),
			parameter: "orderBook",
		}),
		startBlock: process.env.START_BLOCK_ORDER_BOOK as number | undefined,
	},
	PoolManager: {
		abi: PoolManagerABI || [],
		network: "riseSepolia",
		address: getAddress(
			(process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	BalanceManager: {
		abi: BalanceManagerABI || [],
		network: "riseSepolia",
		address: getAddress(
			(process.env.BALANCEMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
	GTXRouter: {
		abi: GTXRouterABI || [],
		network: "riseSepolia",
		address: getAddress(
			(process.env.GTXROUTER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.START_BLOCK) || undefined,
	},
};

export default createConfig({
	database: {
		kind: "postgres",
		connectionString: process.env.PONDER_DATABASE_URL!,
	},
	networks: {
		riseSepolia: {
			chainId: Number(chainId),
			transport: http(process.env.PONDER_RPC_URL_RISE_SEPOLIA),
			pollingInterval: 2_000,
			maxRequestsPerSecond: 25,
		},
	},
	contracts: contracts,
});
