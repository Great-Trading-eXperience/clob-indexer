import { and, desc, eq, lt, lte, or, sql } from "ponder";
import { orderBookDepth, orderBookDepthSnapshots, orders } from "../../ponder.schema";
import { validatePoolId } from "./validation";

export class DepthManager {
    private static sequenceCounter = 0;
    private static lastSnapshotTime = new Map<string, number>();
    private static readonly SNAPSHOT_INTERVAL_MS = 100;

    static getNextSequence(): bigint {
        return BigInt(++DepthManager.sequenceCounter);
    }

    private static createDepthId(poolId: string, chainId: number, side: string, price: string): string {
        return `${poolId}:${chainId}:${side}:${price}`;
    }
    
    static async maybeCreateSnapshot(
        context: any,
        poolId: `0x${string}`,
        chainId: number,
        timestampMs: number
    ) {
        const validatedPoolId = validatePoolId(poolId);
        const poolKey = `${validatedPoolId}:${chainId}`;
        const lastSnapshot = this.lastSnapshotTime.get(poolKey) || 0;

        if (timestampMs - lastSnapshot < this.SNAPSHOT_INTERVAL_MS) {
            return;
        }

        try {
            const currentDepth = await context.db.sql
                .select()
                .from(orderBookDepth)
                .where(
                    and(
                        eq(orderBookDepth.poolId, validatedPoolId),
                        eq(orderBookDepth.chainId, chainId)
                    )
                )
                .execute();

            const bids = currentDepth
                .filter((d: any) => d.side === "Buy")
                .sort((a: any, b: any) => Number(b.price - a.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);

            const asks = currentDepth
                .filter((d: any) => d.side === "Sell")
                .sort((a: any, b: any) => Number(a.price - b.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);

            const snapshotData = JSON.stringify({ bids, asks });
            const snapshotId = `${validatedPoolId}:${chainId}:${timestampMs}`;

            await context.db
                .insert(orderBookDepthSnapshots)
                .values({
                    id: snapshotId,
                    chainId: chainId,
                    poolId: validatedPoolId,
                    timestamp: BigInt(timestampMs),
                    snapshotData: snapshotData,
                    sequenceNumber: this.getNextSequence(),
                    changeCount: currentDepth.length,
                })
                .onConflictDoNothing();

            this.lastSnapshotTime.set(poolKey, timestampMs);

            await this.cleanupOldSnapshots(context, validatedPoolId, chainId, timestampMs);

        } catch (error) {
            console.log(`Error creating depth snapshot: ${error}`);
        }
    }

    static async getLatestSnapshot(context: any, poolId: `0x${string}`, chainId: number) {
        try {
            const result = await context.db
                .select({ id: orderBookDepthSnapshots.id })
                .from(orderBookDepthSnapshots)
                .where(
                    and(
                        eq(orderBookDepthSnapshots.poolId, poolId),
                        eq(orderBookDepthSnapshots.chainId, chainId)
                    )
                )
                .orderBy(desc(orderBookDepthSnapshots.timestamp))
                .limit(1)
                .execute();

            return result[0] || null;
        } catch (error) {
            console.error(`Error fetching latest snapshot: ${error}`);
            return null;
        }
    }

    static async cleanupOldSnapshots(
        context: any,
        poolId: string,
        chainId: number,
        currentTimestamp: number
    ) {
        const validatedPoolId = validatePoolId(poolId);
        const cutoffTime = currentTimestamp - (100 * 1000);

        try {
            if (!context.db?.isConnected?.()) {
                throw new Error('Database connection not established');
            }

            const deleteResult = await context.db
                .delete(orderBookDepthSnapshots)
                .where(
                    and(
                        eq(orderBookDepthSnapshots.poolId, validatedPoolId),
                        eq(orderBookDepthSnapshots.chainId, chainId),
                        lt(orderBookDepthSnapshots.timestamp, BigInt(cutoffTime))
                    )
                )
                .limit(1000)
                .returning();

            console.log(`Cleaned ${deleteResult.length} snapshots`);

        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Snapshot cleanup failed: ${error.message}`);
                if (error.message.includes('ECONNREFUSED')) {
                    throw new Error('Database connection refused');
                }
            }
        }
    }

    static async getDepthAtInterval(
        context: any,
        poolId: `0x${string}`,
        chainId: number,
        intervalMs: number
    ) {
        const now = Date.now();
        const targetTime = now - intervalMs;

        try {
            const validatedPoolId = validatePoolId(poolId);
            const snapshot: any = await context.db.sql
                .select()
                .from(orderBookDepthSnapshots)
                .where(
                    and(
                        eq(orderBookDepthSnapshots.poolId, validatedPoolId),
                        eq(orderBookDepthSnapshots.chainId, chainId),
                        lte(orderBookDepthSnapshots.timestamp, BigInt(targetTime))
                    )
                )
                .orderBy(orderBookDepthSnapshots.timestamp, "desc")
                .limit(1)
                .execute();

            if (snapshot.length > 0) {
                return JSON.parse(snapshot[0].snapshotData);
            }

            return await this.getCurrentDepth(context, validatedPoolId, chainId);

        } catch (error) {
            console.log(`Error getting depth at interval: ${error}`);
            return { bids: [], asks: [] };
        }
    }

    static async getCurrentDepth(context: any, poolId: `0x${string}`, chainId: number) {
        try {
            const validatedPoolId = validatePoolId(poolId);
            const depthData = await context.db.sql
                .select()
                .from(orderBookDepth)
                .where(
                    and(
                        eq(orderBookDepth.poolId, validatedPoolId),
                        eq(orderBookDepth.chainId, chainId)
                    )
                )
                .execute();

            const bids = depthData
                .filter((d: any) => d.side === "Buy")
                .sort((a: any, b: any) => Number(b.price - a.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);

            const asks = depthData
                .filter((d: any) => d.side === "Sell")
                .sort((a: any, b: any) => Number(a.price - b.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);

            return { bids, asks };
        } catch (error) {
            console.log(`Error getting current depth: ${error}`);
            return { bids: [], asks: [] };
        }
    }

    static async getBids(context: any, poolId: `0x${string}`, chainId: number) {
        try {
            const validatedPoolId = validatePoolId(poolId);
            const depthData = await context.db.sql
                .select()
                .from(orderBookDepth)
                .where(
                    and(
                        eq(orderBookDepth.poolId, validatedPoolId),
                        eq(orderBookDepth.chainId, chainId),
                        eq(orderBookDepth.side, "Buy")
                    )
                )
                .execute();

            return depthData
                .sort((a: any, b: any) => Number(b.price - a.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);
        } catch (error) {
            console.log(`Error getting bids: ${error}`);
            return [];
        }
    }

    static async getAsks(context: any, poolId: `0x${string}`, chainId: number) {
        try {
            const validatedPoolId = validatePoolId(poolId);
            const depthData = await context.db.sql
                .select()
                .from(orderBookDepth)
                .where(
                    and(
                        eq(orderBookDepth.poolId, validatedPoolId),
                        eq(orderBookDepth.chainId, chainId),
                        eq(orderBookDepth.side, "Sell")
                    )
                )
                .execute();

            return depthData
                .sort((a: any, b: any) => Number(a.price - b.price))
                .slice(0, 50)
                .map((d: any) => [d.price.toString(), d.quantity.toString()]);
        } catch (error) {
            console.log(`Error getting asks: ${error}`);
            return [];
        }
    }

    static async updateOrderBookDepth(context: any, poolId: `0x${string}`, chainId: number, timestamp: number) {
        try {
            const validatedPoolId = validatePoolId(poolId);
            console.log(`Rebuilding order book depth for pool ${validatedPoolId}`);

            const activeOrders = await context.db.sql
                .select()
                .from(orders)
                .where(
                    and(
                        eq(orders.poolId, validatedPoolId),
                        eq(orders.chainId, chainId),
                        or(
                            eq(orders.status, "NEW"),
                            eq(orders.status, "PARTIALLY_FILLED"),
                            eq(orders.status, "OPEN")
                        )
                    )
                )
                .execute();

            const ordersByPriceAndSide = new Map();

            for (const order of activeOrders) {
                const key = `${order.side}:${order.price.toString()}`;
                if (!ordersByPriceAndSide.has(key)) {
                    ordersByPriceAndSide.set(key, {
                        side: order.side,
                        price: order.price,
                        orders: []
                    });
                }
                ordersByPriceAndSide.get(key).orders.push(order);
            }

            for (const [key, data] of ordersByPriceAndSide.entries()) {
                const { side, price, orders: ordersAtLevel } = data;
                const normalizedSide = side === "Buy" ? "Buy" : "Sell";

                let totalQuantity = BigInt(0);
                for (const order of ordersAtLevel) {
                    const remainingQuantity = BigInt(order.quantity) - BigInt(order.filled);
                    if (remainingQuantity > 0) {
                        totalQuantity += remainingQuantity;
                    }
                }

                const orderCount = ordersAtLevel.length;
                console.log(`Depth level: ${normalizedSide} @ ${price}, Count: ${orderCount}, Quantity: ${totalQuantity}`);

                const depthId = this.createDepthId(validatedPoolId, chainId, normalizedSide, price.toString());

                const existingRecord = await context.db.sql
                    .select()
                    .from(orderBookDepth)
                    .where(eq(orderBookDepth.id, depthId))
                    .execute();

                if (existingRecord.length > 0) {
                    await context.db.update(orderBookDepth, { id: depthId })
                        .set({
                            quantity: totalQuantity,
                            orderCount,
                            lastUpdated: timestamp
                        });
                } else {
                    await context.db.insert(orderBookDepth)
                        .values({
                            id: depthId,
                            chainId,
                            poolId: validatedPoolId,
                            side: normalizedSide,
                            price,
                            quantity: totalQuantity,
                            orderCount,
                            lastUpdated: timestamp
                        })
                        .onConflictDoUpdate((row: any) => ({
                            quantity: totalQuantity,
                            orderCount,
                            lastUpdated: timestamp
                        }));
                }
            }

            await this.maybeCreateSnapshot(context, poolId, chainId, timestamp);

            console.log(`Order book depth rebuild complete for pool ${validatedPoolId}`);
            return true;
        } catch (error) {
            console.error(`Error rebuilding order book depth: ${error instanceof Error ? error.message : error}`);
            return false;
        }
    }
}

async function depth(pool: `0x${string}`, ctx: any, chainId: number) {
    try {
        return await DepthManager.getCurrentDepth(ctx, pool, chainId);
    } catch (error) {
        console.log(`Error getting depth: ${error}`);
        const bids = await ctx.db.sql.select().from(orders).where(and(eq(orders.poolId, pool), eq(orders.side, "Buy"), or(eq(orders.status, "OPEN"), eq(orders.status, "PARTIALLY_FILLED")))).orderBy(orders.price, "desc").limit(50).execute();
        const asks = await ctx.db.sql.select().from(orders).where(and(eq(orders.poolId, pool), eq(orders.side, "Sell"), or(eq(orders.status, "OPEN"), eq(orders.status, "PARTIALLY_FILLED")))).orderBy(orders.price, "asc").limit(50).execute();
        return {
            bids: bids.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()]),
            asks: asks.map((o: any) => [o.price.toString(), (o.quantity - o.filled).toString()])
        };
    }
}
