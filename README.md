# 📊 GTX CLOB DEX Indexer

> 🚀 Supercharge your DEX experience with real-time order book data indexing

A high-performance blockchain indexer powered by [Ponder](https://ponder.sh) that processes events from the GTX CLOB DEX (Central Limit Order Book Decentralized Exchange).

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

## 👨‍💻 Development

Key files for customization:
- 🏊‍♂️ `src/poolManager.ts`
- 📚 `src/index.ts` (OrderBook events)
- 💰 `src/balanceManager.ts`

Schema modifications: 🔧 `ponder.schema.ts`