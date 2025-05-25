// base-ponder.config.ts
import {factory} from "ponder";
import {getAddress, http, parseAbiItem} from "viem";
import {BalanceManagerABI} from "./abis/BalanceManager";
import {GTXRouterABI} from "./abis/GTXRouter";
import {OrderBookABI} from "./abis/OrderBook";
import {PoolManagerABI} from "./abis/PoolManager";
import dotenv from "dotenv";

dotenv.config();

const default_address = getAddress(
    "0x0000000000000000000000000000000000000000"
);

const contracts: any = {
    OrderBook: {
        abi: OrderBookABI,
        network: "network",
        address: factory({
            address:
                getAddress(process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
                default_address,
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
        address: getAddress(
            (process.env.POOLMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
            default_address
        ),
        startBlock: Number(process.env.START_BLOCK) || undefined,
    },
    BalanceManager: {
        abi: BalanceManagerABI || [],
        network: "network",
        address: getAddress(
            (process.env.BALANCEMANAGER_CONTRACT_ADDRESS as `0x${string}`) ||
            default_address
        ),
        startBlock: Number(process.env.START_BLOCK) || undefined,
    },
    GTXRouter: {
        abi: GTXRouterABI || [],
        network: "network",
        address: getAddress(
            (process.env.GTXROUTER_CONTRACT_ADDRESS as `0x${string}`) ||
            default_address
        ),
        startBlock: Number(process.env.START_BLOCK) || undefined,
    },
};

export function getBaseConfig() {
    return {
        networks: {
            network: {
                chainId: Number(process.env.CHAIN_ID),
                transport: http(process.env.PONDER_RPC_URL),
                pollingInterval: Number(process.env.POLLING_INTERVAL) || 100,
                maxRequestsPerSecond: Number(process.env.MAX_REQUESTS_PER_SECOND) || 250,
            },
        },
        contracts: contracts,
    };
}