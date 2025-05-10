import {ponder} from "ponder:registry";
import * as orderBookHandler from "./handlers/orderBookHandler";
import * as balanceManagerHandler from "./handlers/balanceManagerHandler";
import * as poolManagerHandler from "./handlers/poolManagerHandler";

// Pool Manager Events
ponder.on("PoolManager:PoolCreated" as any, poolManagerHandler.handlePoolCreated);

// Balance Manager Events
ponder.on("BalanceManager:Deposit" as any, balanceManagerHandler.handleDeposit);
ponder.on("BalanceManager:Withdrawal" as any, balanceManagerHandler.handleWithdrawal);
ponder.on("BalanceManager:TransferFrom" as any, balanceManagerHandler.handleTransferFrom);
ponder.on("BalanceManager:TransferLockedFrom" as any, balanceManagerHandler.handleTransferLockedFrom);
ponder.on("BalanceManager:Lock" as any, balanceManagerHandler.handleLock);
ponder.on("BalanceManager:Unlock" as any, balanceManagerHandler.handleUnlock);

// Order Book Events
ponder.on("OrderBook:OrderPlaced" as any, orderBookHandler.handleOrderPlaced);
ponder.on("OrderBook:OrderMatched" as any, orderBookHandler.handleOrderMatched);
ponder.on("OrderBook:OrderCancelled" as any, orderBookHandler.handleOrderCancelled);
ponder.on("OrderBook:UpdateOrder" as any, orderBookHandler.handleUpdateOrder);
