import { faucetDeposits, faucetRequests, faucetTokens } from "../../ponder.schema";

export async function handleRequestToken({ event, context }: any) {
  const chainId = Number(context.network.chainId);

  await context.db.insert(faucetRequests).values({
    id: `${chainId}-${event.transaction.hash}-${event.logIndex}`,
    chainId,
    requester: event.args.requester,
    receiver: event.args.receiver,
    token: event.args.token,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    transactionId: event.transaction.hash,
  });
}

export async function handleDepositToken({ event, context }: any) {
  const chainId = Number(context.network.chainId);

  await context.db.insert(faucetDeposits).values({
    id: `${chainId}-${event.transaction.hash}-${event.logIndex}`,
    chainId,
    depositor: event.args.depositor,
    token: event.args.token,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    transactionId: event.transaction.hash,
  });
}

export async function handleAddToken({ event, context }: any) {
  const chainId = Number(context.network.chainId);

  await context.db.insert(faucetTokens).values({
    id: `${chainId}-${event.transaction.hash}-${event.logIndex}`,
    chainId,
    token: event.args.token,
    timestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    transactionId: event.transaction.hash,
  });
}
