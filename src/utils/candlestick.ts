import {createBucketId} from "./hash";

export function updateCandlestickBucket(
    bucketTable: any,
    intervalInSeconds: number,
    price: BigInt,
    quantity: BigInt,
    timestamp: number,
    context: any,
    event: any,
    isTakerBuy: boolean,
    chainId: number,
    baseDecimals: number = 18,
    quoteDecimals: number = 6
) {
    const openTime = Math.floor(timestamp / intervalInSeconds) * intervalInSeconds;
    const closeTime = openTime + intervalInSeconds - 1;

    const bucketId = createBucketId(event.log.address!, openTime, chainId);

    const priceDecimal = Number(price) / (10 ** quoteDecimals);

    const baseVolume = Number(quantity) / (10 ** baseDecimals);
    const quoteVolume = Number(Number(quantity) * Number(price)) / (10 ** (baseDecimals + quoteDecimals));

    const takerBuyBaseVolume = isTakerBuy ? baseVolume : 0;
    const takerBuyQuoteVolume = isTakerBuy ? quoteVolume : 0;

    return context.db
        .insert(bucketTable)
        .values({
            id: bucketId,
            chainId: chainId,
            openTime: openTime,
            closeTime: closeTime,
            open: priceDecimal,
            close: priceDecimal,
            low: priceDecimal,
            high: priceDecimal,
            average: priceDecimal,
            volume: baseVolume,
            quoteVolume: quoteVolume,
            count: 1,
            takerBuyBaseVolume: takerBuyBaseVolume,
            takerBuyQuoteVolume: takerBuyQuoteVolume,
            poolId: event.log.address!,
        })
        .onConflictDoUpdate((row: any) => ({
            close: priceDecimal,
            low: Math.min(Number(row.low), priceDecimal),
            high: Math.max(Number(row.high), priceDecimal),
            average:
                (Number(row.average) * Number(row.count) + priceDecimal) /
                (Number(row.count) + 1),
            count: row.count + 1,
            volume: Number(row.volume) + baseVolume,
            quoteVolume: Number(row.quoteVolume) + quoteVolume,
            takerBuyBaseVolume: Number(row.takerBuyBaseVolume) + takerBuyBaseVolume,
            takerBuyQuoteVolume: Number(row.takerBuyQuoteVolume) + takerBuyQuoteVolume,
        }));
}
