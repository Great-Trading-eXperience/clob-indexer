import { ponder } from "ponder:registry";
import { getAddress } from "viem";
import { marketMaker } from "ponder:schema";
import { createHash } from "crypto";

ponder.on("MarketMakerFactory:MarketMakerCreated" as any, async ({ event, context }: any) => {
	await context.db
		.insert(marketMaker)
		.values({
			id: getAddress(event.args.marketMaker),
			name: event.args.name,
			symbol: event.args.symbol,
		})
		.onConflictDoNothing();
});

ponder.on("MarketMaker:Transfer" as any, async ({ event, context }: any) => {
	const marketMakerId = event.log.address!;

	await context.db
		.insert(marketMaker)
		.values({
			id: getAddress(event.args.to),
			from: getAddress(event.args.from),
			to: getAddress(event.args.to),
			value: event.args.value,
		})
		.onConflictDoNothing();
});

ponder.on("MarketMaker:RedeemRewards" as any, async ({ event, context }: any) => {
	const timestampId = Math.floor(event.log.timestamp);
	const marketMakerId = event.log.address!;
	const id = createHash("sha256")
		.update(`${marketMakerId!}-${BigInt(timestampId!)}`)
		.digest("hex");
	const rewardsOut = event.args.rewardsOut;
	await context.db
		.insert(marketMaker)
		.values({
			id: id,
			user: getAddress(event.args.user),
			rewardsOut: rewardsOut,
			marketMakerId: marketMakerId,
			timestamp: timestampId,
		})
		.onConflictDoNothing();
});

// {
// 	type: "event",
// 	name: "Approval",
// 	inputs: [
// 		{
// 			name: "owner",
// 			type: "address",
// 			indexed: true,
// 			internalType: "address",
// 		},
// 		{
// 			name: "spender",
// 			type: "address",
// 			indexed: true,
// 			internalType: "address",
// 		},
// 		{
// 			name: "value",
// 			type: "uint256",
// 			indexed: false,
// 			internalType: "uint256",
// 		},
// 	],
// 	anonymous: false,
// },
// {
// 	type: "event",
// 	name: "RedeemRewards",
// 	inputs: [
// 		{
// 			name: "user",
// 			type: "address",
// 			indexed: true,
// 			internalType: "address",
// 		},
// 		{
// 			name: "rewardsOut",
// 			type: "uint256[]",
// 			indexed: false,
// 			internalType: "uint256[]",
// 		},
// 	],
// 	anonymous: false,
// },
// {
// 	type: "event",
// 	name: "Transfer",
// 	inputs: [
// 		{
// 			name: "from",
// 			type: "address",
// 			indexed: true,
// 			internalType: "address",
// 		},
// 		{
// 			name: "to",
// 			type: "address",
// 			indexed: true,
// 			internalType: "address",
// 		},
// 		{
// 			name: "value",
// 			type: "uint256",
// 			indexed: false,
// 			internalType: "uint256",
// 		},
// 	],
// 	anonymous: false,
// },
