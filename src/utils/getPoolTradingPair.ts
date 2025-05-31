import { pools } from "../../ponder.schema";
import { validatePoolId } from "./validation";
import { eq } from "ponder";

export const getPoolTradingPair = async (context: any, pool: `0x${string}`, chainId: number) => {
    const validatedPoolId = validatePoolId(pool);
    const poolData = (await context.db.sql.select().from(pools).where(eq(pools.orderBook, validatedPoolId), eq(pools.chainId, chainId)).execute())[0];
    return poolData.coin.replace('/', '').toLowerCase();
};