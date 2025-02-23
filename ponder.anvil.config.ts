import { createConfig } from "ponder";
import { getAddress, http } from "viem";
import deployed from "../clob-dex/broadcast/Deploy.s.sol/31337/run-latest.json";
import { OrderBookABI } from "./abis/OrderBook";
import { deployedContracts } from "../clob-dex/deployed-contracts/deployedContracts";

const default_address = getAddress(
	"0x0000000000000000000000000000000000000000"
);

const transactions = deployed.transactions.filter(
	(tx) =>
		(tx.transactionType === "CREATE" &&
			(tx.contractName === "PoolManager" ||
				tx.contractName === "BalanceManager" ||
				tx.contractName === "GTXRouter")) ||
		(tx.transactionType === "CALL" &&
			tx.contractName === "PoolManager" &&
			tx.function === "createPool((address,address),uint256,uint256)")
);

const address =
	transactions.find(
		(tx) =>
			tx.transactionType === "CALL" &&
			tx.contractName === "PoolManager" &&
			tx.function === "createPool((address,address),uint256,uint256)"
	)?.contractAddress || default_address;

const contracts: any = {
	OrderBook: {
		abi: OrderBookABI,
		network: "anvil",
		address: address,
	},
	PoolManager: {
		abi: deployedContracts["31337"]?.["PoolManager"]?.abi || [],
		network: "anvil",
		address:
			deployedContracts["31337"]?.["PoolManager"]?.address || default_address,
	},
	BalanceManager: {
		abi: deployedContracts["31337"]?.["BalanceManager"]?.abi || [],
		network: "anvil",
		address:
			deployedContracts["31337"]?.["BalanceManager"]?.address ||
			default_address,
	},
	GTXRouter: {
		abi: deployedContracts["31337"]?.["GTXRouter"]?.abi || [],
		network: "anvil",
		address:
			deployedContracts["31337"]?.["GTXRouter"]?.address || default_address,
	},
};

export default createConfig({
	database: {
		kind: "postgres",
		connectionString: process.env.PONDER_DATABASE_URL,
	},
	networks: {
		anvil: {
			chainId: 31337,
			transport: http(process.env.PONDER_RPC_URL_ANVIL),
			disableCache: true,
		},
	},
	contracts: contracts,
});
