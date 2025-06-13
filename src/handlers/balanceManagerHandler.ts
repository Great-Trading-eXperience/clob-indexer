import dotenv from "dotenv";
import { eq } from "ponder";
import { balances } from "ponder:schema";
import { getAddress, toHex } from "viem";
import { createBalanceId } from "../utils/hash";
import { executeIfInSync } from "../utils/syncState";
import { pushBalanceUpdate } from "../websocket/broadcaster";

dotenv.config();

function fromId(id: number): string {
    return `0x${id.toString(16).padStart(40, "0")}`;
}

export async function handleDeposit({event, context}: any) {
    const {db} = context;
    const chainId = context.network.chainId;
    const user = event.args.user;
    const currency = getAddress(fromId(event.args.id));
    const balanceId = createBalanceId(chainId, currency, user);
    const timestamp = Number(event.block.timestamp);

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

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
        if (balRow[0]) {
            pushBalanceUpdate(balRow[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRow[0].currency,
                b: balRow[0].amount.toString(),
                l: balRow[0].lockedAmount.toString()
            });
        }
    });
}

export async function handleWithdrawal({event, context}: any) {
    const chainId = context.network.chainId;
    const user = event.args.user;
    const currency = getAddress(toHex(event.args.id));
    const balanceId = createBalanceId(chainId, currency, user);
    const timestamp = Number(event.block.timestamp);

    await context.db
        .update(balances, {id: balanceId})
        .set((row: any) => ({
            amount: row.amount - BigInt(event.args.amount),
        }));

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
        if (balRow[0]) {
            pushBalanceUpdate(balRow[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRow[0].currency,
                b: balRow[0].amount.toString(),
                l: balRow[0].lockedAmount.toString()
            });
        }
    });
}

export async function handleTransferFrom({event, context}: any) {
    const chainId = context.network.chainId;
    const netAmount = BigInt(event.args.amount) - BigInt(event.args.feeAmount);
    const currency = getAddress(fromId(event.args.id));
    const timestamp = Number(event.block.timestamp);

    // Update or insert sender balance
    const senderId = createBalanceId(chainId, currency, event.args.sender);
    await context.db
        .update(balances, {id: senderId})
        .set((row: any) => ({
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

    // Update or insert operator balance
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

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        // Sender balance update
        const balRowSender = await context.db.sql.select().from(balances).where(eq(balances.id, senderId)).execute();
        if (balRowSender[0]) {
            pushBalanceUpdate(balRowSender[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowSender[0].currency,
                b: balRowSender[0].amount.toString(),
                l: balRowSender[0].lockedAmount.toString()
            });
        }

        // Receiver balance update
        const balRowReceiver = await context.db.sql.select().from(balances).where(eq(balances.id, receiverId)).execute();
        if (balRowReceiver[0]) {
            pushBalanceUpdate(balRowReceiver[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowReceiver[0].currency,
                b: balRowReceiver[0].amount.toString(),
                l: balRowReceiver[0].lockedAmount.toString()
            });
        }

        // Operator balance update
        const balRowOperator = await context.db.sql.select().from(balances).where(eq(balances.id, operatorId)).execute();
        if (balRowOperator[0]) {
            pushBalanceUpdate(balRowOperator[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowOperator[0].currency,
                b: balRowOperator[0].amount.toString(),
                l: balRowOperator[0].lockedAmount.toString()
            });
        }
    });
}

export async function handleTransferLockedFrom({event, context}: any) {
    const chainId = context.network.chainId;
    const netAmount = BigInt(event.args.amount) - BigInt(event.args.feeAmount);
    const currency = getAddress(fromId(event.args.id));
    const timestamp = Number(event.block.timestamp);

    // Update sender locked balance
    const senderId = createBalanceId(chainId, currency, event.args.sender);
    await context.db
        .update(balances, {id: senderId})
        .set((row: any) => ({
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

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        // Sender balance update
        const balRowSender = await context.db.sql.select().from(balances).where(eq(balances.id, senderId)).execute();
        if (balRowSender[0]) {
            pushBalanceUpdate(balRowSender[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowSender[0].currency,
                b: balRowSender[0].amount.toString(),
                l: balRowSender[0].lockedAmount.toString()
            });
        }

        // Receiver balance update
        const balRowReceiver = await context.db.sql.select().from(balances).where(eq(balances.id, receiverId)).execute();
        if (balRowReceiver[0]) {
            pushBalanceUpdate(balRowReceiver[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowReceiver[0].currency,
                b: balRowReceiver[0].amount.toString(),
                l: balRowReceiver[0].lockedAmount.toString()
            });
        }

        // Operator balance update
        const balRowOperator = await context.db.sql.select().from(balances).where(eq(balances.id, operatorId)).execute();
        if (balRowOperator[0]) {
            pushBalanceUpdate(balRowOperator[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRowOperator[0].currency,
                b: balRowOperator[0].amount.toString(),
                l: balRowOperator[0].lockedAmount.toString()
            });
        }
    });
}

export async function handleLock({event, context}: any) {
    const chainId = context.network.chainId;
    const user = event.args.user;
    const currency = getAddress(fromId(event.args.id));
    const balanceId = createBalanceId(chainId, currency, user);
    const timestamp = Number(event.block.timestamp);

    await context.db
        .update(balances, {id: balanceId})
        .set((row: any) => ({
            amount: row.amount - BigInt(event.args.amount),
            lockedAmount: row.lockedAmount + BigInt(event.args.amount),
        }));

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
        if (balRow[0]) {
            pushBalanceUpdate(balRow[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRow[0].currency,
                b: balRow[0].amount.toString(),
                l: balRow[0].lockedAmount.toString()
            });
        }
    });
}

export async function handleUnlock({event, context}: any) {
    const chainId = context.network.chainId;
    const user = event.args.user;
    const currency = getAddress(fromId(event.args.id));
    const balanceId = createBalanceId(chainId, currency, user);
    const timestamp = Number(event.block.timestamp);

    await context.db
        .update(balances, {id: balanceId})
        .set((row: any) => ({
            lockedAmount: row.lockedAmount - BigInt(event.args.amount),
            amount: row.amount + BigInt(event.args.amount),
        }));

    // Only emit WebSocket events if we're in sync
    await executeIfInSync(context, event.block.number, timestamp, async () => {
        const balRow = await context.db.sql.select().from(balances).where(eq(balances.id, balanceId)).execute();
        if (balRow[0]) {
            pushBalanceUpdate(balRow[0].user, {
                e: "balanceUpdate",
                E: timestamp * 1000,
                a: balRow[0].currency,
                b: balRow[0].amount.toString(),
                l: balRow[0].lockedAmount.toString()
            });
        }
    });
}