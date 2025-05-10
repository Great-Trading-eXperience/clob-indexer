import {pools} from "../../ponder.schema";
import {getAddress} from "viem";

export async function getPoolTokenDecimals(orderBook: string, chainId: number, context: any) {
    try {
        const poolResult = await context.db
            .find(pools, {
                orderBook: getAddress(orderBook),
                chainId: chainId
            });

        if (poolResult) {
            return {
                baseDecimals: poolResult.baseDecimals || 18,
                quoteDecimals: poolResult.quoteDecimals || 6
            };
        }

        return {baseDecimals: 18, quoteDecimals: 6};
    } catch (error) {
        console.log(`Error getting token decimals: ${error}`);
        return {baseDecimals: 18, quoteDecimals: 6};
    }
}