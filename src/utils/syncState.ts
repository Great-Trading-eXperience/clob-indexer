const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === 'true';

export async function isInSyncState(context: any, eventBlockNumber: number, eventTimestamp: number): Promise<boolean> {
    try {
        // const latestBlockNumber = await context.network.getBlockNumber();
        // const currentTime = Math.floor(Date.now() / 1000);
        
        // const blocksBehind = latestBlockNumber - eventBlockNumber;
        // const timeBehind = currentTime - eventTimestamp;
        // const isSyncedByBlocks = blocksBehind <= 5;
        // const isSyncedByTime = timeBehind <= 300; 
        
        // return isSyncedByBlocks || isSyncedByTime;
        return true;
    } catch (error) {
        console.log("Error checking sync state:", error);
        return false;
    }
}

/**
 * Wrapper function to conditionally execute WebSocket operations only when in sync
 */
export async function executeIfInSync(
    context: any, 
    eventBlockNumber: number, 
    eventTimestamp: number, 
    websocketOperations: () => Promise<void>
): Promise<void> {
    if (!ENABLED_WEBSOCKET) return;
    
    const isInSync = await isInSyncState(context, eventBlockNumber, eventTimestamp);
    if (isInSync) {
        await websocketOperations();
    }
}