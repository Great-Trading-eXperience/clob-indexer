import { ponder } from "ponder:registry";
import { getAddress } from "viem";
// import { marketMaker } from "ponder:schema";
import { createHash } from "crypto";
import { votingPools, votes } from "../ponder.schema";

ponder.on(
	"VotingController:AddPool" as any,
	async ({ event, context }: any) => {
		const poolId = event.args.pool;
		const chainId = event.args.chainId;
		const id = createHash("sha256")
			.update(`${chainId!}-${poolId!}`)
			.digest("hex");

		await context.db
			.insert(votingPools)
			.values({
				id: id,
				chainId: chainId,
				poolId: poolId,
				active: true,
			})
			.onConflictDoNothing();
	}
);

ponder.on(
	"VotingController:RemovePool" as any,
	async ({ event, context }: any) => {
		const poolId = event.args.pool;
		const chainId = event.args.chainId;
		const id = createHash("sha256")
			.update(`${chainId!}-${poolId!}`)
			.digest("hex");

		await context.db
			.update(votingPools)
			.set({ active: false })
			.where({ id: id });
	}
);

// {
// 	type: "event",
// 	name: "SetTokenPerSec",
// 	inputs: [
// 		{
// 			name: "newTokenPerSec",
// 			type: "uint256",
// 			indexed: false,
// 			internalType: "uint256",
// 		},
// 	],
// 	anonymous: false,
// },

// {
// 	type: "event",
// 	name: "Vote",
// 	inputs: [
// 		{ name: "user", type: "address", indexed: true, internalType: "address" },
// 		{ name: "pool", type: "address", indexed: true, internalType: "address" },
// 		{
// 			name: "weight",
// 			type: "uint64",
// 			indexed: false,
// 			internalType: "uint64",
// 		},
// 		{
// 			name: "vote",
// 			type: "tuple",
// 			indexed: false,
// 			internalType: "struct VeBalance",
// 			components: [
// 				{ name: "bias", type: "uint128", internalType: "uint128" },
// 				{ name: "slope", type: "uint128", internalType: "uint128" },
// 			],
// 		},
// 	],
// 	anonymous: false,
// },
ponder.on("VotingController:Vote" as any, async ({ event, context }: any) => {
	const user = getAddress(event.args.user);
	const poolId = getAddress(event.args.pool);
	const weight = event.args.weight;
	const vote = event.args.vote;
	const id = createHash("sha256").update(`${user}-${poolId}}`).digest("hex");

	await context.db
		.insert(votes)
		.values({
			id: id,
			user: user,
			poolId: poolId,
			weight: weight,
			bias: vote.bias,
			slope: vote.slope,
			timestamp: event.block.timestamp,
			active: true,
		})
		.onConflictDoNothing();
});

// ponder.on(
// 	"VotingController:PoolVoteChange" as any,
// 	async ({ event, context }: any) => {
// 		const poolId = getAddress(event.args.pool);
// 		const vote = event.args.vote;
// 		const id = createHash("sha256").update(`${user}-${poolId}}`).digest("hex");

// 		await context.db
// 			.update(votes)
// 			.set({
// 				bias: vote.bias,
// 				slope: vote.slope,
// 				timestamp: event.block.timestamp,
// 			})
// 			.where({ poolId: poolId, active: true });
// 	}
// );
// {
// 	type: "event",
// 	name: "BroadcastResults",
// 	inputs: [
// 		{
// 			name: "chainId",
// 			type: "uint64",
// 			indexed: true,
// 			internalType: "uint64",
// 		},
// 		{
// 			name: "wTime",
// 			type: "uint128",
// 			indexed: true,
// 			internalType: "uint128",
// 		},
// 		{
// 			name: "totalTokenPerSec",
// 			type: "uint128",
// 			indexed: false,
// 			internalType: "uint128",
// 		},
// 	],
// 	anonymous: false,
// },

// {
// 	type: "event",
// 	name: "PoolVoteChange",
// 	inputs: [
// 		{ name: "pool", type: "address", indexed: true, internalType: "address" },
// 		{
// 			name: "vote",
// 			type: "tuple",
// 			indexed: false,
// 			internalType: "struct VeBalance",
// 			components: [
// 				{ name: "bias", type: "uint128", internalType: "uint128" },
// 				{ name: "slope", type: "uint128", internalType: "uint128" },
// 			],
// 		},
// 	],
// 	anonymous: false,
// },

// {
// 	type: "event",
// 	name: "SetTokenPerSec",
// 	inputs: [
// 		{
// 			name: "newTokenPerSec",
// 			type: "uint256",
// 			indexed: false,
// 			internalType: "uint256",
// 		},
// 	],
// 	anonymous: false,
// },
