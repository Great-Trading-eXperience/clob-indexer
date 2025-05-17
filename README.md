# 📊 GTX CLOB DEX Indexer

> 🚀 Supercharge your DEX experience with real-time order book data indexing

A high-performance blockchain indexer powered by [Ponder](https://ponder.sh) that processes events from the GTX CLOB DEX (Central Limit Order Book Decentralized Exchange). It also exposes a real‑time WebSocket API so front‑ends can stream depth, trades, tickers, and personal order reports without polling.

## 🌟 Overview

This indexer is the backbone of the GTX CLOB DEX, processing and storing on-chain events in real-time. It maintains a structured database of all trading activities and market data for seamless DeFi operations.

## 🔧 Core Components

### 🎯 Event Handlers

- **🏊‍♂️ PoolManager**
  - Pool creation & configuration
  - Trading pair setup
  
- **📚 OrderBook**
  - 📝 Order placement
  - ⚡ Order matching
  - 🗑️ Order cancellation
  - 🔄 Order updates
  
- **💰 BalanceManager**
  - 📥 Deposits
  - 📤 Withdrawals
  - 🔁 Transfers
  - 💸 Fee distribution

## 🔌 Real-time WebSocket Gateway

The indexer spins up a WebSocket gateway on **ws://localhost:42080**.

| What you can stream | Subscribe with | Notes |
| ------------------- | -------------- | ----- |
| Order‑book deltas   | `<symbol>@depth` or `<symbol>@depth5@100ms` | Emits every time bids or asks change. |
| Live trades         | `<symbol>@trade` | Tick‑by‑tick last price. |
| 1‑minute candlesticks | `<symbol>@kline_1m` | Any interval supported: 1m, 5m, 1h, 1d … |
| 24 h mini‑ticker    | `<symbol>@miniTicker` | Last price / high / low / volume widget. |

**User streams**  
Open a second socket to `ws://localhost:42080/ws/<walletAddress>` to receive:

* `executionReport` – order status & fills  
* `balanceUpdate`   – deposits, withdrawals, fee distributions

No REST auth is required; simply connect to the address‑specific socket.

**Example with the bundled CLI**

```text
pnpm ts-node websocket-client.ts
> subscribe ethusdc@depth
> subscribe ethusdc@trade
> list
```

**cURL depth snapshot**

```bash
curl 'http://localhost:42080/api/v3/depth?symbol=ethusdc&limit=20'
```

### 📊 Data Models

- **🏊‍♂️ Pools**: Trading pair configs
- **📝 Orders**: Live & historical orders
- **🤝 Trades**: Executed trades
- **📈 OrderBookTrades**: Detailed executions
- **💎 Balances**: User token holdings
- **📊 Candlestick Data**:
  ```
  📈 1m  |  📊 5m  |  📉 30m  |  📈 1h  |  📊 1d
  ```

## 🗄️ Database Schema

### 🏊‍♂️ Pools
```typescript
{
  id: hex,                  // 🏷️ Pool address
  coin: string,            // 💱 Trading pair (ETH/USDC)
  orderBook: hex,          // 📚 OrderBook contract
  baseCurrency: hex,       // 🔵 Base token
  quoteCurrency: hex,      // 🟡 Quote token
  lotSize: bigint,         // 📏 Min order size
  maxOrderAmount: bigint,  // 🔝 Max order size
  timestamp: integer       // ⏰ Creation time
}
```

### 📝 Orders
```typescript
{
  id: string,              // 🆔 Unique ID
  poolId: hex,            // 🏊‍♂️ Pool address
  orderId: bigint,        // 🔢 Chain order ID
  user: hex,              // 👤 User address
  side: string,           // 📗 Buy / 📕 Sell
  timestamp: integer,     // ⏰ Order time
  price: bigint,          // 💰 Price
  quantity: bigint,       // 📦 Quantity
  filled: bigint,         // ✅ Filled amount
  type: string,           // 🎯 Market/Limit
  status: string,         // 📊 Order status
  expiry: integer        // ⌛ Expiration
}
```

## 🚀 Quick Start

1. 📦 Install dependencies:
```bash
pnpm install
```

2. ⚙️ Setup environment:
```bash
cp .env.example .env
```

3. 🏃‍♂️ Launch indexer:
```bash
pnpm dev
```

4. 🛰  Start the WebSocket CLI (optional):
   ```bash
   pnpm ts-node websocket-client.ts
   ```

## 👨‍💻 Development

Key files for customization:
- 🏊‍♂️ `src/poolManager.ts`
- 📚 `src/index.ts` (OrderBook events)
- 💰 `src/balanceManager.ts`

Schema modifications: 🔧 `ponder.schema.ts`