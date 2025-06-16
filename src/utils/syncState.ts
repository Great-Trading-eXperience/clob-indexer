import dotenv from "dotenv";
import { getCachedData } from "./redis";

dotenv.config();

const ENABLED_WEBSOCKET = process.env.ENABLE_WEBSOCKET === 'true';


export const shouldEnableWebSocket = async (currentBlockNumber: number): Promise<boolean> => {
    try {
        const enabledWebSocket = process.env.ENABLE_WEBSOCKET === 'true' || process.env.ENABLED_WEBSOCKET === 'true';
        if (!enabledWebSocket) return false;

        const enabledBlockNumber = await getCachedData<number>('websocket:enable:block');
        if (!enabledBlockNumber) return true;

        return currentBlockNumber >= enabledBlockNumber;
    } catch (error) {
        console.error(`Error checking if websocket should be enabled:`, error);
        return false;
    }
};

export async function executeIfInSync(
    eventBlockNumber: number,
    websocketOperations: () => Promise<void>
): Promise<void> {
    if (!ENABLED_WEBSOCKET) return;

    const shouldEnableWs = await shouldEnableWebSocket(eventBlockNumber);
    if (!shouldEnableWs) return;
    await websocketOperations();
}