import { createConfig, factory } from "ponder";
import { getAddress, http, parseAbiItem } from "viem";
import { BalanceManagerABI } from "./abis/BalanceManager";
import { GTXRouterABI } from "./abis/GTXRouter";
import { OrderBookABI } from "./abis/OrderBook";
import { PoolManagerABI } from "./abis/PoolManager";

const default_address = getAddress(
	"0x0000000000000000000000000000000000000000"
);

const contracts: any = {
	OrderBook: {
		abi: OrderBookABI,
		network: "monadTestnet",
		address: factory({
			address:
				getAddress(process.env.MONAD_POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
				default_address,
			event: parseAbiItem(
				"event PoolCreated(bytes32 indexed id, address indexed orderBook, address baseCurrency, address quoteCurrency, uint256 lotSize, uint256 maxOrderAmount)"
			),
			parameter: "orderBook",
		}),
		startBlock: process.env.MONAD_START_BLOCK as number | undefined,
	},
	PoolManager: {
		abi: PoolManagerABI || [],
		network: "monadTestnet",
		address: getAddress(
			(process.env.MONAD_POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.MONAD_START_BLOCK) || undefined,
	},
	BalanceManager: {
		abi: BalanceManagerABI || [],
		network: "monadTestnet",
		address: getAddress(
			(process.env.MONAD_BALANCEMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.MONAD_START_BLOCK) || undefined,
	},
	GTXRouter: {
		abi: GTXRouterABI || [],
		network: "monadTestnet",
		address: getAddress(
			(process.env.MONAD_GTXROUTER_CONTRACT_ADDRESS as `0x${string}`) ||
			default_address
		),
		startBlock: Number(process.env.MONAD_START_BLOCK) || undefined,
	},
};

export default createConfig({
	database: {
		kind: "postgres",
		connectionString: process.env.MONAD_PONDER_DATABASE_URL!,
	},
	networks: {
		monadTestnet: {
			chainId: 10143,
			transport: http(process.env.PONDER_RPC_URL_MONAD_TESTNET),
			pollingInterval: 2_000,
			maxRequestsPerSecond: 25,
		},
	},
	contracts: contracts,
});
