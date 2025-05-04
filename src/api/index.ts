import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { sql } from "drizzle-orm";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// app.get("/api", async (c) => {
//   const symbol = c.req.query("symbol");
//   const interval = c.req.query("interval") || "1m";
//   const startTime = parseInt(c.req.query("startTime") || "0");
//   const endTime = parseInt(c.req.query("endTime") || Date.now().toString());
//   const limit = parseInt(c.req.query("limit") || "1000");

//   if (!symbol) {
//     return c.json({ error: "Symbol parameter is required" }, 400);
//   }

//   // Map Binance intervals to our bucket tables
//   const intervalTableMap = {
//     "1m": "minute_buckets",
//     "5m": "five_minute_buckets",
//     "30m": "thirty_minute_buckets",
//     "1h": "hour_buckets",
//     "1d": "daily_buckets",
//   };

//   const tableName = intervalTableMap[interval] || "minute_buckets";

//   try {
//     const result = await db.query(sql`
//       SELECT 
//         timestamp * 1000 as openTime,
//         open,
//         high,
//         low,
//         close,
//         count as volume,
//         timestamp * 1000 as closeTime,
//         count * average as quoteAssetVolume,
//         count as numberOfTrades,
//         0 as takerBuyBaseAssetVolume,
//         0 as takerBuyQuoteAssetVolume,
//         0 as ignore
//       FROM ${sql.identifier(tableName)}
//       WHERE poolId = ${symbol}
//         AND timestamp >= ${Math.floor(startTime / 1000)}
//         AND timestamp <= ${Math.floor(endTime / 1000)}
//       ORDER BY timestamp ASC
//       LIMIT ${limit}
//     `);

//     // Transform the results to match Binance format
//     const klines = result.map(row => [
//       row.openTime,
//       row.open.toString(),
//       row.high.toString(),
//       row.low.toString(),
//       row.close.toString(),
//       row.volume.toString(),
//       row.closeTime,
//       row.quoteAssetVolume.toString(),
//       row.numberOfTrades,
//       row.takerBuyBaseAssetVolume.toString(),
//       row.takerBuyQuoteAssetVolume.toString(),
//       row.ignore.toString()
//     ]);

//     return c.json(klines);
//   } catch (error) {
//     return c.json({ error: "Internal server error" }, 500);
//   }
// });

export default app;