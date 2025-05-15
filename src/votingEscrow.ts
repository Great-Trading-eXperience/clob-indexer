import { createHash } from "crypto";
import { ponder } from "ponder:registry";
import { velockPositions } from "../ponder.schema";

ponder.on(
	"VotingEscrow:NewLockPosition" as any,
	async ({ event, context }: any) => {
		const user = event.args.user;
		const chainId = event.args.chainId;
		const id = createHash("sha256")
			.update(`${user!}-${chainId!}`)
			.digest("hex");

		await context.db
			.insert(velockPositions)
			.values({
				id: id,
				chainId: chainId,
				user: user,
				amount: event.args.amount,
				expiry: event.args.expiry,
			})
			.onConflictDoUpdate((row: any) => ({
				amount: row.amount + BigInt(event.args.amount),
			}));
	}
);

ponder.on("VotingEscrow:Withdraw" as any, async ({ event, context }: any) => {
	const user = event.args.user;
	const chainId = event.args.chainId;
	const id = createHash("sha256").update(`${user!}-${chainId!}`).digest("hex");

	await context.db.update(velockPositions, { id: id }).set((row: any) => ({
		amount: row.amount - BigInt(event.args.amount),
	}));
});

// {
// 	type: "event",
// 	name: "BroadcastTotalSupply",
// 	inputs: [
// 		{
// 			name: "newTotalSupply",
// 			type: "tuple",
// 			indexed: false,
// 			internalType: "struct VeBalance",
// 			components: [
// 				{ name: "bias", type: "uint128", internalType: "uint128" },
// 				{ name: "slope", type: "uint128", internalType: "uint128" },
// 			],
// 		},
// 		{
// 			name: "chainIds",
// 			type: "uint256[]",
// 			indexed: false,
// 			internalType: "uint256[]",
// 		},
// 	],
// 	anonymous: false,
// },
// {
// 	type: "event",
// 	name: "BroadcastUserPosition",
// 	inputs: [
// 		{ name: "user", type: "address", indexed: true, internalType: "address" },
// 		{
// 			name: "chainIds",
// 			type: "uint256[]",
// 			indexed: false,
// 			internalType: "uint256[]",
// 		},
// 	],
// 	anonymous: false,
// },
// {
// 	type: "event",
// 	name: "Initialized",
// 	inputs: [
// 		{
// 			name: "version",
// 			type: "uint64",
// 			indexed: false,
// 			internalType: "uint64",
// 		},
// 	],
// 	anonymous: false,
// },

// {
// 	type: "event",
// 	name: "Withdraw",
// 	inputs: [
// 		{ name: "user", type: "address", indexed: true, internalType: "address" },
// 		{
// 			name: "amount",
// 			type: "uint128",
// 			indexed: false,
// 			internalType: "uint128",
// 		},
// 	],
// 	anonymous: false,
// },

ponder.on(
	"VotingEscrow:BroadcastTotalSupply" as any,
	async ({ event, context }) => {
		const { newTotalSupply, chainIds } = event.args;

		await context.db.TotalSupply.create({
			id: event.transaction.hash,
			data: {
				bias: newTotalSupply.bias,
				slope: newTotalSupply.slope,
				chainIds: chainIds,
			},
		});
	}
);

ponder.on(
	"VotingEscrow:BroadcastUserPosition" as any,
	async ({ event, context }) => {
		const { user, chainIds } = event.args;

		await context.db.User.update({
			id: user,
			data: {
				chainIds: chainIds,
			},
		});
	}
);
