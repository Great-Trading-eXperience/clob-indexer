import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '3600'); 

let redisClient: ReturnType<typeof createClient> | null = null;

export const initRedisClient = async () => {
  try {
    if (!redisClient) {
      redisClient = createClient({
        url: REDIS_URL
      });
      
      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });
      
      await redisClient.connect();
      console.log('Redis client connected');
    }
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await initRedisClient();
    if (!client) return null;
    
    const data = await client.get(key);
    return data ? JSON.parse(data, jsonReviver) as T : null;
  } catch (error) {
    console.error(`Error getting cached data for key ${key}:`, error);
    return null;
  }
};

const jsonReplacer = (_key: string, value: any) => {
  if (typeof value === 'bigint') {
    return { __type: 'bigint', value: value.toString() };
  }
  return value;
};

const jsonReviver = (_key: string, value: any) => {
  if (value && value.__type === 'bigint' && typeof value.value === 'string') {
    return BigInt(value.value);
  }
  return value;
};

export const setCachedData = async <T>(key: string, data: T, ttl: number = REDIS_CACHE_TTL): Promise<void> => {
  try {
    const client = await initRedisClient();
    if (!client) return;
    
    await client.set(key, JSON.stringify(data, jsonReplacer), { EX: ttl });
  } catch (error) {
    console.error(`Error setting cached data for key ${key}:`, error);
  }
};

export const deleteCachedData = async (key: string): Promise<void> => {
  try {
    const client = await initRedisClient();
    if (!client) return;
    
    await client.del(key);
  } catch (error) {
    console.error(`Error deleting cached data for key ${key}:`, error);
  }
};

export const createPoolCacheKey = (orderBook: string, chainId: number): string => {
  return `pool:${orderBook.toLowerCase()}:${chainId}`;
};
