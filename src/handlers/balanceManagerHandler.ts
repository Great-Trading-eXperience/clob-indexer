import { balances } from "ponder:schema";
import { createBalanceId } from "@/utils";
import { getAddress } from "viem";
import { pushBalanceUpdate } from "../websocket/broadcaster";
import { eq } from "ponder";
import dotenv from "dotenv";

dotenv.config();

const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === "true";
const START_WEBSOCKET_BLOCK = process.env.START_WEBSOCKET_BLOCK ? parseInt(process.env.START_WEBSOCKET_BLOCK) : 0;

function fromId(id: number): string {
	return `0x${id.toString(16).padStart(40, "0")}`;
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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
		if (balRow[0]) {
			pushBalanceUpdate(balRow[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRow[0].currency,
				b: balRow[0].amount.toString(),
				l: balRow[0].lockedAmount.toString(),
			});
		}
	}
}

export async function handleWithdrawal({ event, context }: any) {
	const chainId = context.network.chainId;
	const user = event.args.user;
	const currency = getAddress(fromId(event.args.id));
	const balanceId = createBalanceId(chainId, currency, user);

	await context.db.update(balances, { id: balanceId }).set((row: any) => ({
		amount: row.amount - BigInt(event.args.amount),
	}));

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
		if (balRow[0]) {
			pushBalanceUpdate(balRow[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRow[0].currency,
				b: balRow[0].amount.toString(),
				l: balRow[0].lockedAmount.toString(),
			});
		}
	}
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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowSender = await context.db.sql.select().from(balances).where(eq(balances.id, senderId)).execute();
		if (balRowSender[0]) {
			pushBalanceUpdate(balRowSender[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowSender[0].currency,
				b: balRowSender[0].amount.toString(),
				l: balRowSender[0].lockedAmount.toString(),
			});
		}
	}

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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowReceiver = await context.db.sql.select().from(balances).where(eq(balances.id, receiverId)).execute();
		if (balRowReceiver[0]) {
			pushBalanceUpdate(balRowReceiver[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowReceiver[0].currency,
				b: balRowReceiver[0].amount.toString(),
				l: balRowReceiver[0].lockedAmount.toString(),
			});
		}
	}

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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowOperator = await context.db.sql.select().from(balances).where(eq(balances.id, operatorId)).execute();
		if (balRowOperator[0]) {
			pushBalanceUpdate(balRowOperator[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowOperator[0].currency,
				b: balRowOperator[0].amount.toString(),
				l: balRowOperator[0].lockedAmount.toString(),
			});
		}
	}
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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowSender = await context.db.sql.select().from(balances).where(eq(balances.id, senderId)).execute();
		if (balRowSender[0]) {
			pushBalanceUpdate(balRowSender[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowSender[0].currency,
				b: balRowSender[0].amount.toString(),
				l: balRowSender[0].lockedAmount.toString(),
			});
		}
	}

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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowReceiver = await context.db.sql.select().from(balances).where(eq(balances.id, receiverId)).execute();
		if (balRowReceiver[0]) {
			pushBalanceUpdate(balRowReceiver[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowReceiver[0].currency,
				b: balRowReceiver[0].amount.toString(),
				l: balRowReceiver[0].lockedAmount.toString(),
			});
		}
	}

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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRowOperator = await context.db.sql.select().from(balances).where(eq(balances.id, operatorId)).execute();
		if (balRowOperator[0]) {
			pushBalanceUpdate(balRowOperator[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRowOperator[0].currency,
				b: balRowOperator[0].amount.toString(),
				l: balRowOperator[0].lockedAmount.toString(),
			});
		}
	}
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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
		if (balRow[0]) {
			pushBalanceUpdate(balRow[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRow[0].currency,
				b: balRow[0].amount.toString(),
				l: balRow[0].lockedAmount.toString(),
			});
		}
	}
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

	if (ENABLED_WEBSOCKET && event.block.number > START_WEBSOCKET_BLOCK) {
		const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
		if (balRow[0]) {
			pushBalanceUpdate(balRow[0].user, {
				e: "balanceUpdate",
				E: Number(event.block?.timestamp ?? Date.now()),
				a: balRow[0].currency,
				b: balRow[0].amount.toString(),
				l: balRow[0].lockedAmount.toString(),
			});
		}
	}
}
