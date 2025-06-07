import { createHash } from "crypto";
import { Address } from "viem";

export function createOrderId(chainId: number, orderId: bigint, poolAddress: string): string {
	return createHash("sha256").update(`${chainId}_${poolAddress}_${orderId}`).digest("hex");
}

export function createBucketId(chainId: number, poolAddress: string, openTime: number): string {
	return createHash("sha256").update(`${chainId}_${poolAddress}_${openTime}`).digest("hex");
}

export function createTradeId(chainId: number, txHash: string, user: string, side: string, args: any): string {
	const buyOrderId = args.buyOrderId;
	const sellOrderId = args.sellOrderId;
	const price = args.executionPrice;
	const quantity = args.executedQuantity;

	return createHash("sha256")
		.update(`${chainId}_${txHash}_${user}_${side}_${buyOrderId}_${sellOrderId}_${price}_${quantity}`)
		.digest("hex");
}

export function createOrderHistoryId(
	chainId: number,
	txHash: string,
	filled: bigint,
	poolId: string,
	orderId: string
): string {
	return createHash("sha256").update(`${chainId}_${poolId}_${orderId}_${txHash}_${filled}`).digest("hex");
}

export function createPoolId(chainId: number, orderBook: string): string {
	return createHash("sha256").update(`${chainId}_${orderBook}`).digest("hex");
}

// New utility functions
export function createBalanceId(chainId: number, currency: Address, user: string): string {
	return createHash("sha256").update(`${chainId}_${currency}_${user}`).digest("hex");
}

export function createCurrencyId(chainId: number, address: string): string {
	return createHash("sha256").update(`${chainId}_${address}`).digest("hex");
}
