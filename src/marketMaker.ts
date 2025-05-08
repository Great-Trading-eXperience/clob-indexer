import { ponder } from "ponder:registry";
import { getAddress } from "viem";
import { marketMaker } from "ponder:schema";
import { createHash } from "crypto";

ponder.on(
	"MarketMakerFactory:MarketMakerCreated" as any,
	async ({ event, context }: any) => {
		await context.db
			.insert(marketMaker)
			.values({
				id: getAddress(event.args.marketMaker),
				name: event.args.name,
				symbol: event.args.symbol,
			})
			.onConflictDoNothing();
	}
);

ponder.on(
	"MarketMaker:RedeemRewards" as any,
	async ({ event, context }: any) => {
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
	}
);
