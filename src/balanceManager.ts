import { ponder } from "ponder:registry";
import { balances } from "ponder:schema";
import { ERC20ABI } from "../abis/ERC20";
import { getAddress } from "viem";

function fromId(id: number): string {
	return `0x${id.toString(16).padStart(40, "0")}`;
}

ponder.on("BalanceManager:Deposit" as any, async ({ event, context }: any) => {
	const { client } = context;
	const currency = fromId(event.args.id);
	const name = await client.readContract({
		abi: ERC20ABI,
		address: getAddress(currency),
		functionName: "name",
	});
	const symbol = await client.readContract({
		abi: ERC20ABI,
		address: getAddress(currency),
		functionName: "symbol",
	});

	await context.db
		.insert(balances)
		.values({
			user: event.args.user,
			name: name,
			symbol: symbol,
			currency: currency,
			amount: BigInt(event.args.amount),
			lockedAmount: BigInt(0),
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + BigInt(event.args.amount),
			name: name,
			symbol: symbol,
			currency: currency,
		}));
});

ponder.on(
	"BalanceManager:Withdrawal" as any,
	async ({ event, context }: any) => {
		await context.db
			.update(balances, { user: event.args.user })
			.set((row: any) => ({
				amount: row.amount - BigInt(event.args.amount),
			}));
	}
);

ponder.on(
	"BalanceManager:OperatorSet" as any,
	async ({ event, context }: any) => {
		// Assuming there's a table or logic to handle operator settings
		console.log(
			`Operator ${event.args.operator} set to ${event.args.approved}`
		);
	}
);

ponder.on(
	"BalanceManager:TransferFrom" as any,
	async ({ event, context }: any) => {
		const netAmount = BigInt(event.args.amount) - BigInt(event.args.feeAmount);

		// Update or insert sender balance
		await context.db
			.insert(balances)
			.values({
				user: event.args.sender,
				amount: BigInt(0) - BigInt(event.args.amount),
				lockedAmount: BigInt(0),
			})
			.onConflictDoUpdate((row: any) => ({
				amount: row.amount - BigInt(event.args.amount),
			}));

		// Update or insert receiver balance
		await context.db
			.insert(balances)
			.values({
				user: event.args.receiver,
				amount: netAmount,
				lockedAmount: BigInt(0),
			})
			.onConflictDoUpdate((row: any) => ({
				amount: row.amount + netAmount,
			}));

		// Update or insert operator balance
		await context.db
			.insert(balances)
			.values({
				user: event.args.operator,
				amount: BigInt(event.args.feeAmount),
				lockedAmount: BigInt(0),
			})
			.onConflictDoUpdate((row: any) => ({
				amount: row.amount + BigInt(event.args.feeAmount),
			}));
	}
);
