import { createConfig, factory } from "ponder";
import { getAddress, http, parseAbiItem } from "viem";
import { OrderBookABI } from "./abis/OrderBook";
// import { deployedContracts } from "../clob-dex/deployed-contracts/deployedContracts";
import { deployedContracts } from "./contracts/deployedContracts";

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
				getAddress(
					deployedContracts[chainId]?.["PoolManager"]?.address || ""
				) || default_address,
			event: parseAbiItem(
				"event PoolCreated(bytes32 indexed id, address indexed orderBook, address baseCurrency, address quoteCurrency, uint256 lotSize, uint256 maxOrderAmount)"
			),
			parameter: "orderBook",
		}),
		// address: [
		// 	"0x9231e74e817fad37a62d06790db5f913840544da",
		// 	"0x9d4fb92a3eb51e23586a661dbd926d5ee0e7eaef",
		// 	"0x4d744292de49297f33dff8063c4a3876de7aaade",
		// 	"0x6759df93ba4382d7832203007116894a33ec07e3",
		// ],
		startBlock: process.env.START_BLOCK as number | undefined,
	},
	PoolManager: {
		abi: (deployedContracts[chainId]?.["PoolManager"]?.abi as any[]) || [],
		network: "riseSepolia",
		address:
			deployedContracts[chainId]?.["PoolManager"]?.address || default_address,
		startBlock: process.env.START_BLOCK as number | undefined,
	},
	BalanceManager: {
		abi: deployedContracts[chainId]?.["BalanceManager"]?.abi || [],
		network: "riseSepolia",
		address:
			deployedContracts[chainId]?.["BalanceManager"]?.address ||
			default_address,
		startBlock: process.env.START_BLOCK as number | undefined,
	},
	GTXRouter: {
		abi: deployedContracts[chainId]?.["GTXRouter"]?.abi || [],
		network: "riseSepolia",
		address:
			deployedContracts[chainId]?.["GTXRouter"]?.address || default_address,
		startBlock: process.env.START_BLOCK as number | undefined,
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
