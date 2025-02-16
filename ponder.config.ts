import { createConfig } from "ponder";
import { getAddress, http } from "viem";
import { OrderBookABI } from "./abis/OrderBook";

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.PONDER_DATABASE_URL,
  },
  networks: {
    riseSepolia: {
      chainId: 11155931,
      transport: http(process.env.PONDER_RPC_URL_RISE_SEPOLIA),
      pollingInterval: 2_000,
      maxRequestsPerSecond: 25,
    }
  },
  contracts: {
    OrderBook: {
      abi: OrderBookABI,
      network: "riseSepolia",
      address: process.env.CONTRACT_ADDRESS ? getAddress(process.env.CONTRACT_ADDRESS) : undefined,
    },
  },
});