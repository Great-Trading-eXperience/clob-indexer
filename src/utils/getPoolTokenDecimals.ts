import { and, eq } from "ponder";
import { getAddress } from "viem";
import { pools } from "../../ponder.schema";

export async function getPoolTokenDecimals(orderBook: string, chainId: number, context: any) {
    let poolResult;
    try {
        poolResult = await context.db.sql
            .select()
            .from(pools)
            .where(
                and(
                    eq(pools.orderBook, getAddress(orderBook)),
                    eq(pools.chainId, chainId)
                )
            )
            .execute();

        if (poolResult) {
            return {
                baseDecimals: poolResult[0].baseDecimals || 18,
                quoteDecimals: poolResult[0].quoteDecimals || 6
            };
        }

        return {baseDecimals: 18, quoteDecimals: 6};
    } catch (error) {
        console.log(`Error getting token decimals: ${error}, ${orderBook}, ${chainId}, ${poolResult}`);
        return {baseDecimals: 18, quoteDecimals: 6};
    }
}