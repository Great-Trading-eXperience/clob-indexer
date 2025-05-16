import {createHash} from "crypto";
import {Address} from "viem";

export function createOrderId(orderId: bigint, poolAddress: string, chainId: number): string {
    return createHash("sha256")
        .update(`${chainId}_${poolAddress}_${orderId}`)
        .digest("hex");
}

export function createBucketId(poolAddress: string, openTime: number, chainId: number): string {
    return createHash("sha256")
        .update(`${chainId}_${poolAddress}_${openTime}`)
        .digest("hex");
}

export function createTradeId(
    txHash: string,
    user: string,
    side: string,
    buyOrderId: bigint,
    sellOrderId: bigint,
    price: bigint,
    quantity: bigint,
    chainId: number
): string {
    return createHash("sha256")
        .update(
            `${chainId}_${txHash}_${user}_${side}_${buyOrderId}_${sellOrderId}_${price}_${quantity}`
        )
        .digest("hex");
}

export function createOrderHistoryId(txHash: string, filled: bigint, chainId: number, poolId: string, orderId: string): string {
    return createHash("sha256")
        .update(`${chainId}_${poolId}_${orderId}_${txHash}_${filled}`)
        .digest("hex");
}

export function createPoolId(chainId: number, orderBook: string): string {
    return createHash("sha256")
        .update(`${chainId}_${orderBook}`)
        .digest("hex");
}

// New utility functions
export function createBalanceId(chainId: number, currency: Address, user: string): string {
    return createHash("sha256")
        .update(`${chainId}_${currency}_${user}`)
        .digest("hex");
}

export function createCurrencyId(chainId: number, address: string): string {
    return createHash("sha256")
        .update(`${chainId}_${address}`)
        .digest("hex");
}
