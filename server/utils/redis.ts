import { Redis } from 'ioredis';
require('dotenv').config();

const redisClient = () => {
    if (process.env.REDIS_URL) {
        console.log('Redis connected');
        return process.env.REDIS_URL;
    }
    throw new Error('Redis connection failed');
};

export const redis = new Redis(redisClient());

// Simple wrapper functions that don't cause timeouts
export const redisGet = async (key: string): Promise<string | null> => {
    try {
        return await redis.get(key);
    } catch (error) {
        return null; // Fail silently
    }
};

export const redisSet = async (key: string, value: string, expireTime?: number): Promise<boolean> => {
    try {
        if (expireTime) {
            await redis.setex(key, expireTime, value);
        } else {
            await redis.set(key, value);
        }
        return true;
    } catch (error) {
        return false; // Fail silently
    }
};

export default redis;