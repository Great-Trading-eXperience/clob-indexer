import { createConfig } from "ponder";
import { getAddress, http } from "viem";
import deployed from "../clob-dex/broadcast/Deploy.s.sol/31337/run-latest.json";
import { OrderBookABI } from "./abis/OrderBook";
const address = getAddress(deployed.transactions[0]!.contractAddress);

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
	contracts: {
		OrderBook: {
			abi: OrderBookABI,
			network: "anvil",
			address,
		},
	},
});
