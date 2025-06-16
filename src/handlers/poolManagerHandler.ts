import dotenv from "dotenv";
import { currencies, pools } from "ponder:schema";
import { Address, getAddress } from "viem";
import { ERC20ABI } from "../../abis/ERC20";
import { createCurrencyId, createPoolId } from "../utils/hash";
import { createPoolCacheKey, setCachedData } from "../utils/redis";
import { executeIfInSync, shouldEnableWebSocket } from "../utils/syncState";
import { pushMiniTicker } from "../websocket/broadcaster";

dotenv.config();


async function fetchTokenData(client: any, address: string) {
    try {
        const [symbol, name, decimals] = await client.multicall({
            contracts: [
                { address, abi: ERC20ABI, functionName: "symbol" },
                { address, abi: ERC20ABI, functionName: "name" },
                { address, abi: ERC20ABI, functionName: "decimals" },
            ],
        });

        return {
            symbol: symbol.status === "success" ? symbol.result : "",
            name: name.status === "success" ? name.result : "",
            decimals: decimals.status === "success" ? decimals.result : 18,
        };
    } catch {
        return {
            symbol: await safeReadContract(client, address, "symbol"),
            name: await safeReadContract(client, address, "name"),
            decimals: (await safeReadContract(client, address, "decimals")) || 18,
        };
    }
}

async function safeReadContract(client: any, address: string, functionName: string) {
    try {
        return await client.readContract({address, abi: ERC20ABI, functionName});
    } catch (e) {
        console.error(`Failed to get ${functionName} for ${address}:`, e);
        return functionName === "decimals" ? 18 : "";
    }
}

async function insertCurrency(db: any, chainId: number, address: Address, data: any) {
    await db
        .insert(currencies)
        .values({
            id: createCurrencyId(chainId, address),
            address: address,
            chainId,
            name: data.name,
            symbol: data.symbol,
            decimals: data.decimals,
        })
        .onConflictDoNothing();
}

export async function handlePoolCreated({event, context}: any) {
    const {client, db} = context;
    const chainId = context.network.chainId;

    const baseCurrency = getAddress(event.args.baseCurrency);
    const quoteCurrency = getAddress(event.args.quoteCurrency);

    const baseData = await fetchTokenData(client, baseCurrency);
    const quoteData = await fetchTokenData(client, quoteCurrency);

    await insertCurrency(db, chainId, baseCurrency, baseData);
    await insertCurrency(db, chainId, quoteCurrency, quoteData);

    const coin = `${baseData.symbol}/${quoteData.symbol}`;
    const orderBook = getAddress(event.args.orderBook);

    const poolId = createPoolId(chainId, orderBook);

    const poolData = {
        id: poolId,
        chainId,
        coin,
        orderBook,
        baseCurrency,
        quoteCurrency,
        baseDecimals: baseData.decimals,
        quoteDecimals: quoteData.decimals,
        volume: BigInt(0),
        volumeInQuote: BigInt(0),
        price: BigInt(0),
        timestamp: Number(event.block.timestamp),
    };

    await db
        .insert(pools)
        .values(poolData)
        .onConflictDoNothing();

    try {
        const cacheKey = createPoolCacheKey(orderBook, chainId);
        await setCachedData(cacheKey, poolData);
    } catch (error) {
        console.error('Failed to cache pool data:', error);
    }

    await executeIfInSync(Number(event.block.number), async () => {
        const symbol = coin.replace('/', '').toLowerCase();
        pushMiniTicker(symbol, "0", "0", "0", "0");
    });
}