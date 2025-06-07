import { and, eq } from "ponder";
import { getAddress } from "viem";
import { pools } from "../../ponder.schema";
import { createPoolCacheKey, getCachedData, setCachedData } from "./redis";
import { validatePoolId } from "./validation";

type PoolDecimalsData = {
    baseDecimals: number;
    quoteDecimals: number;
};

export async function getPoolTokenDecimals(orderBook: string, chainId: number, context: any): Promise<PoolDecimalsData> {
    try {
        const validatedPoolId = validatePoolId(orderBook);

        const cacheKey = createPoolCacheKey(validatedPoolId, chainId);
        const cachedPoolData = await getCachedData<any>(cacheKey);

        if (cachedPoolData && (cachedPoolData.baseDecimals || cachedPoolData.quoteDecimals)) {
            return {
                baseDecimals: cachedPoolData.baseDecimals || 18,
                quoteDecimals: cachedPoolData.quoteDecimals || 6
            };
        }

        let poolData = await context.db.find(pools, {
            orderBook: validatedPoolId,
            chainId: chainId
        });

        if (!poolData) {
            const poolRows = await context.db.sql.select().from(pools).where(
                eq(pools.orderBook, validatedPoolId),
                eq(pools.chainId, chainId)
            ).limit(1).execute();

            if (poolRows.length > 0) {
                poolData = poolRows[0];
            }
        }

        if (poolData) {
            const result = {
                baseDecimals: poolData.baseDecimals || 18,
                quoteDecimals: poolData.quoteDecimals || 6
            };

            await setCachedData(cacheKey, poolData);

            return result;
        }

        return {baseDecimals: 18, quoteDecimals: 6};
    } catch (error) {
        console.log(`Error getting token decimals: ${error}, ${orderBook}, ${chainId}`);
        return {baseDecimals: 18, quoteDecimals: 6};
    }
}