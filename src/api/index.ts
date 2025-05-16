import { Hono } from "hono";
import { and, client, eq, graphql, gte, lte } from "ponder";
import { db } from "ponder:api";
import schema, {
  dailyBuckets,
  fiveMinuteBuckets,
  hourBuckets,
  minuteBuckets,
  pools,
  thirtyMinuteBuckets
} from "ponder:schema";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Define types for Binance Kline data format
type BinanceKlineData = [
  number,    // Open time
  string,    // Open price
  string,    // High price
  string,    // Low price
  string,    // Close price
  string,    // Volume (base asset)
  number,    // Close time
  string,    // Quote asset volume
  number,    // Number of trades
  string,    // Taker buy base asset volume
  string,    // Taker buy quote asset volume
  string     // Unused field (ignored)
];

// Interface for our bucket data
interface BucketData {
  id: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  average: number;
  count: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  poolId: string;
}

// Define supported interval types
type IntervalType = "1m" | "5m" | "30m" | "1h" | "1d";

app.get("/api/kline/mocks", async (c) => {
  const symbol = c.req.query("symbol");
  const interval = c.req.query("interval") || "1m";
  const startTime = parseInt(c.req.query("startTime") || "0");
  const endTime = parseInt(c.req.query("endTime") || Date.now().toString());
  const limit = parseInt(c.req.query("limit") || "1000");

  if (!symbol) {
    return c.json({ error: "Symbol parameter is required" }, 400);
  }
  
  // Generate mock data that matches Binance Kline format
  const mockData = generateMockKlineData(symbol, interval, startTime, endTime, limit);
  return c.json(mockData);
});

app.get("/api/kline", async (c) => {
  const symbol = c.req.query("symbol");
  const interval = c.req.query("interval") || "1m";
  const startTime = parseInt(c.req.query("startTime") || "0");
  const endTime = parseInt(c.req.query("endTime") || Date.now().toString());
  const limit = parseInt(c.req.query("limit") || "1000");

  if (!symbol) {
    return c.json({ error: "Symbol parameter is required" }, 400);
  }

  const queriedPools = await db.select().from(pools).where(eq(pools.coin, symbol));

  // In a production scenario, uncomment this to ensure the pool exists
  if (!queriedPools || queriedPools.length === 0) {
    return c.json({ error: "Pool not found" }, 404);
  }

  const intervalTableMap = {
    "1m": minuteBuckets,
    "5m": fiveMinuteBuckets,
    "30m": thirtyMinuteBuckets,
    "1h": hourBuckets,
    "1d": dailyBuckets,
  };


  const bucketTable = intervalTableMap[interval as IntervalType] || minuteBuckets;

  try {
    const poolId = queriedPools[0]!.orderBook;

    const klineData = await db
      .select()
      .from(bucketTable)
      .where(
        and(
          eq(bucketTable.poolId, poolId),
          gte(bucketTable.openTime, Math.floor(startTime / 1000)),
          lte(bucketTable.openTime, Math.floor(endTime / 1000)),
        )
      )
      .orderBy(bucketTable.openTime)
      .limit(limit)
      .execute();

    const formattedData = klineData.map((bucket: BucketData) => formatKlineData(bucket));
    
    return c.json(formattedData);
  } catch (error) {
    return c.json({ error: `Failed to fetch kline data: ${error}` }, 500);
  }
});

// Function to format our bucket data into Binance Kline format
function formatKlineData(bucket: BucketData): BinanceKlineData {
  // Binance Kline format is an array with specific index positions:
  // [
  //   0: openTime,
  //   1: open,
  //   2: high,
  //   3: low,
  //   4: close,
  //   5: volume,
  //   6: closeTime,
  //   7: quoteVolume,
  //   8: numberOfTrades,
  //   9: takerBuyBaseVolume,
  //   10: takerBuyQuoteVolume,
  //   11: ignored
  // ]

  return [
    bucket.openTime * 1000,                
    bucket.open.toString(),           
    bucket.high.toString(),          
    bucket.low.toString(),            
    bucket.close.toString(),        
    bucket.volume.toString(),        
    bucket.closeTime * 1000,           
    bucket.quoteVolume.toString(),
    bucket.count,               
    bucket.takerBuyBaseVolume.toString(), 
    bucket.takerBuyQuoteVolume.toString(),
    "0"     
  ];
}

// Function to generate mock data when real data isn't available
function generateMockKlineData(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit: number
): BinanceKlineData[] {
  const intervalInMs = getIntervalInMs(interval);
  const mockData: BinanceKlineData[] = [];

  // Determine how many data points to generate
  const timeRange = endTime - startTime;
  const numPoints = Math.min(limit, Math.ceil(timeRange / intervalInMs));

  // Generate a starting price based on the symbol (just for variety in mocks)
  const symbolHash = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  let basePrice = 100 + (symbolHash % 900); // Price between 100 and 999

  // Generate the mock data points
  for (let i = 0; i < numPoints; i++) {
    const openTime = startTime + (i * intervalInMs);
    const closeTime = openTime + intervalInMs - 1;

    // Create some price movement
    const priceChange = (Math.random() - 0.5) * 2; // Between -1 and 1
    const open = basePrice;
    const close = open * (1 + priceChange * 0.01); // Up to 1% change
    const high = Math.max(open, close) * (1 + Math.random() * 0.005); // Up to 0.5% higher
    const low = Math.min(open, close) * (1 - Math.random() * 0.005); // Up to 0.5% lower

    // Generate volume data
    const volume = 10 + Math.random() * 90; // Between 10 and 100
    const quoteVolume = volume * ((open + close) / 2);
    const count = Math.floor(10 + Math.random() * 90); // Between 10 and 100 trades

    // Taker volumes
    const takerBuyPercent = Math.random(); // Between 0 and 1
    const takerBuyBaseVolume = volume * takerBuyPercent;
    const takerBuyQuoteVolume = quoteVolume * takerBuyPercent;

    mockData.push([
      openTime,                       // Open time
      open.toFixed(8),                // Open price
      high.toFixed(8),                // High price
      low.toFixed(8),                 // Low price
      close.toFixed(8),               // Close price
      volume.toFixed(8),              // Volume
      closeTime,                      // Close time
      quoteVolume.toFixed(8),         // Quote asset volume
      count,                          // Number of trades
      takerBuyBaseVolume.toFixed(8),  // Taker buy base asset volume
      takerBuyQuoteVolume.toFixed(8), // Taker buy quote asset volume
      "0"                             // Unused field (ignored)
    ]);

    // Update the base price for the next iteration
    basePrice = close;
  }

  return mockData;
}

// Helper function to convert interval strings to milliseconds
function getIntervalInMs(interval: string): number {
  const value = parseInt(interval);
  const unit = interval.slice(-1);

  switch (unit) {
    case 'm': return value * 60 * 1000;        // minutes
    case 'h': return value * 60 * 60 * 1000;   // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
    case 'M': return value * 30 * 24 * 60 * 60 * 1000; // months (approximate)
    default: return 60 * 1000; // default to 1 minute
  }
}

export default app;