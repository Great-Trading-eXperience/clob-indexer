import { balances } from "ponder:schema";
import { createBalanceId } from "../utils/hash";
import { getAddress, toHex } from "viem";
import { BalanceManagerABI } from "../../abis/BalanceManager";

function fromId(id: number): string {
	return `0x${id.toString(16).padStart(40, "0")}`;
}

async function fetchBalance(client: any, address: string, args: [user: string, currency: string, operator: string]) {
	const [user, currency, operator] = args;
	try {
		const [balance, lockedBalance] = await client.multicall({
			contracts: [
				{
					address,
					abi: BalanceManagerABI,
					functionName: "getBalance",
					args: [user, currency],
				},
				{
					address,
					abi: BalanceManagerABI,
					functionName: "getLockedBalance",
					args: [user, operator, currency],
				},
			],
		});

		return {
			balance: balance.status === "success" ? balance.result : BigInt(0),
			lockedBalance: lockedBalance.status === "success" ? lockedBalance.result : BigInt(0),
		};
	} catch {
		return {
			balance: await safeReadContract(client, address, "getBalance", [user, currency]),
			lockedBalance: await safeReadContract(client, address, "getLockedBalance", [user, operator, currency]),
		};
	}
}

async function safeReadContract(client: any, address: string, functionName: string, args: any[] = []) {
	try {
		return await client.readContract({
			address,
			abi: BalanceManagerABI,
			functionName,
			args,
		});
	} catch (e) {
		console.error(`Failed to get ${functionName} for ${address}:`, e);
		return functionName === "decimals" ? 18 : BigInt(0);
	}
}

export async function handleDeposit({ event, context }: any) {
	const { db } = context;
	const chainId = context.network.chainId;
	const user = event.args.user;
	const currency = getAddress(fromId(event.args.id));
	const balanceId = createBalanceId(chainId, currency, user);

	await db
		.insert(balances)
		.values({
			id: balanceId,
			user: user,
			chainId: chainId,
			currency: currency,
			amount: BigInt(event.args.amount),
			lockedAmount: BigInt(0),
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + BigInt(event.args.amount),
		}));
}

export async function handleWithdrawal({ event, context }: any) {
	const chainId = context.network.chainId;
	const user = event.args.user;
	const currency = getAddress(toHex(event.args.id));
	const balanceId = createBalanceId(chainId, currency, user);

	await context.db.update(balances, { id: balanceId }).set((row: any) => ({
		amount: row.amount - BigInt(event.args.amount),
	}));
}

export async function handleTransferFrom({ event, context }: any) {
	const chainId = context.network.chainId;
	const netAmount = BigInt(event.args.amount) - BigInt(event.args.feeAmount);
	const currency = getAddress(fromId(event.args.id));

	// Update or insert sender balance
	const senderId = createBalanceId(chainId, currency, event.args.sender);
	await context.db.update(balances, { id: senderId }).set((row: any) => ({
		amount: row.amount - event.args.amount,
		user: event.args.sender,
		chainId: chainId,
	}));

	// Update or insert receiver balance
	const receiverId = createBalanceId(chainId, currency, event.args.receiver);

	await context.db
		.insert(balances)
		.values({
			id: receiverId,
			user: event.args.receiver,
			chainId: chainId,
			amount: netAmount,
			lockedAmount: BigInt(0),
			currency: currency,
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + netAmount,
		}));

	// // Update or insert operator balance
	const operatorId = createBalanceId(chainId, currency, event.args.operator);
	await context.db
		.insert(balances)
		.values({
			id: operatorId,
			user: event.args.operator,
			chainId: chainId,
			amount: BigInt(event.args.feeAmount),
			lockedAmount: BigInt(0),
			currency: currency,
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + BigInt(event.args.feeAmount),
		}));
}

export async function handleTransferLockedFrom({ event, context }: any) {
	const chainId = context.network.chainId;
	const netAmount = BigInt(event.args.amount) - BigInt(event.args.feeAmount);
	const currency = getAddress(fromId(event.args.id));

	// Update sender locked balance
	const senderId = createBalanceId(chainId, currency, event.args.sender);
	await context.db.update(balances, { id: senderId }).set((row: any) => ({
		lockedAmount: row.lockedAmount - event.args.amount,
		user: event.args.sender,
		chainId: chainId,
	}));

	// Update or insert receiver balance (unlocked)
	const receiverId = createBalanceId(chainId, currency, event.args.receiver);
	await context.db
		.insert(balances)
		.values({
			id: receiverId,
			user: event.args.receiver,
			chainId: chainId,
			amount: netAmount,
			lockedAmount: BigInt(0),
			currency: currency,
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + netAmount,
		}));

	// Update or insert operator balance (unlocked)
	const operatorId = createBalanceId(chainId, currency, event.args.operator);
	await context.db
		.insert(balances)
		.values({
			id: operatorId,
			user: event.args.operator,
			chainId: chainId,
			amount: BigInt(event.args.feeAmount),
			lockedAmount: BigInt(0),
			currency: currency,
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + BigInt(event.args.feeAmount),
		}));
}

export async function handleLock({ event, context }: any) {
	const chainId = context.network.chainId;
	const user = event.args.user;
	const currency = getAddress(fromId(event.args.id));
	const balanceId = createBalanceId(chainId, currency, user);

	await context.db.update(balances, { id: balanceId }).set((row: any) => ({
		amount: row.amount - BigInt(event.args.amount),
		lockedAmount: row.lockedAmount + BigInt(event.args.amount),
	}));
}

export async function handleUnlock({ event, context }: any) {
	const chainId = context.network.chainId;
	const user = event.args.user;
	const currency = getAddress(fromId(event.args.id));
	const balanceId = createBalanceId(chainId, currency, user);

	await context.db.update(balances, { id: balanceId }).set((row: any) => ({
		lockedAmount: row.lockedAmount - BigInt(event.args.amount),
		amount: row.amount + BigInt(event.args.amount),
	}));
}
