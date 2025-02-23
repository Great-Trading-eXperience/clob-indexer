import { ponder } from "ponder:registry";
import { balances } from "ponder:schema";

function fromId(id: number): string {
	return `0x${id.toString(16).padStart(40, "0")}`;
}

ponder.on("BalanceManager:Deposit" as any, async ({ event, context }: any) => {
	// console.log("Event:", event);
	// console.log("Context:", context);
	const currency = fromId(event.args.id);
	await context.db
		.insert(balances)
		.values({
			user: event.args.user,
			currency: currency,
			amount: BigInt(event.args.amount),
			lockedAmount: BigInt(0),
		})
		.onConflictDoUpdate((row: any) => ({
			amount: row.amount + BigInt(event.args.amount),
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
		await context.db
			.update(balances, { user: event.args.sender })
			.set((row: any) => ({
				amount: row.amount - BigInt(event.args.amount),
			}));

		await context.db
			.update(balances, { user: event.args.receiver })
			.set((row: any) => ({
				amount: row.amount + BigInt(event.args.amount),
			}));
	}
);
