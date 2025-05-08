import { ponder } from "ponder:registry";

// ponder.schema("VotingEscrow", {
// 	User: {
// 		id: "string",
// 		address: "string",
// 		amount: "bigint",
// 		expiry: "bigint",
// 		chainIds: ["bigint"],
// 	},
// 	TotalSupply: {
// 		id: "string",
// 		bias: "bigint",
// 		slope: "bigint",
// 		chainIds: ["bigint"],
// 	},
// });

// ponder.on("VotingEscrow:BroadcastTotalSupply", async ({ event, context }) => {
// 	const { newTotalSupply, chainIds } = event.args;

// 	await context.db.TotalSupply.create({
// 		id: event.transaction.hash,
// 		data: {
// 			bias: newTotalSupply.bias,
// 			slope: newTotalSupply.slope,
// 			chainIds: chainIds,
// 		},
// 	});
// });

// ponder.on("VotingEscrow:BroadcastUserPosition", async ({ event, context }) => {
// 	const { user, chainIds } = event.args;

// 	await context.db.User.update({
// 		id: user,
// 		data: {
// 			chainIds: chainIds,
// 		},
// 	});
// });

// ponder.on("VotingEscrow:NewLockPosition", async ({ event, context }) => {
// 	const { user, amount, expiry } = event.args;

// 	await context.db.User.create({
// 		id: user,
// 		data: {
// 			address: user,
// 			amount: amount,
// 			expiry: expiry,
// 			chainIds: [],
// 		},
// 	});
// });

// ponder.on("VotingEscrow:Withdraw", async ({ event, context }) => {
// 	const { user, amount } = event.args;

// 	await context.db.User.update({
// 		id: user,
// 		data: {
// 			amount: amount,
// 		},
// 	});
// });
