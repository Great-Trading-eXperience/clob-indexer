import { ponder } from "ponder:registry";
import { getAddress } from "viem";
import { ERC20ABI } from "../abis/ERC20";
import { pools } from "ponder:schema";

ponder.on("PoolManager:PoolCreated" as any, async ({ event, context }: any) => {
	console.log("Pool Created Event:", event);
	const { client } = context;
	const baseSymbol = await client.readContract({
		abi: ERC20ABI,
		address: getAddress(event.args.baseCurrency),
		functionName: "symbol",
	});

	const quoteSymbol = await client.readContract({
		abi: ERC20ABI,
		address: getAddress(event.args.quoteCurrency),
		functionName: "symbol",
	});

	const coin = `${baseSymbol}/${quoteSymbol}`;
	await context.db
		.insert(pools)
		.values({
			id: getAddress(event.args.orderBook),
			coin: coin,
			orderBook: getAddress(event.args.orderBook),
			baseCurrency: getAddress(event.args.baseCurrency),
			quoteCurrency: getAddress(event.args.quoteCurrency),
			lotSize: BigInt(event.args.lotSize),
			maxOrderAmount: BigInt(event.args.maxOrderAmount),
			timestamp: Number(event.block.timestamp),
		})
		.onConflictDoNothing();
});
