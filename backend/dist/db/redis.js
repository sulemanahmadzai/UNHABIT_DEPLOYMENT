import IORedis, { Redis as RedisType } from "ioredis";
import crypto from "crypto";
/**
 * Redis Service - Centralized Redis client with connection management
 *
 * Features:
 * - Connection pooling and retry logic
 * - Graceful degradation (app continues if Redis fails)
 * - Structured logging
 * - Helper methods for common patterns
 */
class RedisService {
    client = null;
    isConnected = false;
    isEnabled = true;
    constructor() {
        this.initialize();
    }
    initialize() {
        const redisUrl = process.env.REDIS_URL;
        // Allow disabling Redis via env var
        if (process.env.REDIS_ENABLED === "false") {
            console.log("📦 Redis: Disabled via REDIS_ENABLED=false");
            this.isEnabled = false;
            return;
        }
        if (!redisUrl) {
            console.warn("⚠️  Redis: REDIS_URL not configured, running without cache");
            this.isEnabled = false;
            return;
        }
        try {
            const options = {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => {
                    if (times > 10) {
                        console.error("❌ Redis: Max retries reached, giving up");
                        return null; // Stop retrying
                    }
                    const delay = Math.min(times * 100, 3000);
                    return delay;
                },
                reconnectOnError: (err) => {
                    const targetError = "READONLY";
                    if (err.message.includes(targetError)) {
                        return true; // Reconnect on READONLY errors
                    }
                    return false;
                },
                // TLS for rediss:// URLs
                ...(redisUrl.startsWith("rediss://") && {
                    tls: {
                        rejectUnauthorized: false, // For self-signed certs in dev
                    },
                }),
            };
            this.client = new RedisType(redisUrl, options);
            this.client.on("connect", () => {
                this.isConnected = true;
                console.log("✅ Redis: Connected successfully");
            });
            this.client.on("error", (err) => {
                console.error("❌ Redis error:", err.message);
                this.isConnected = false;
            });
            this.client.on("close", () => {
                this.isConnected = false;
                console.warn("⚠️  Redis: Connection closed");
            });
            this.client.on("reconnecting", () => {
                console.log("🔄 Redis: Reconnecting...");
            });
        }
        catch (error) {
            console.error("❌ Redis: Initialization failed:", error);
            this.isEnabled = false;
        }
    }
    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.isEnabled && this.isConnected && this.client !== null;
    }
    /**
     * Get the Redis client (use with caution, prefer helper methods)
     */
    getClient() {
        return this.client;
    }
    /**
     * Get a value from cache
     */
    async get(key) {
        if (!this.isAvailable())
            return null;
        try {
            const value = await this.client.get(key);
            if (!value)
                return null;
            // Try to parse as JSON, fallback to string
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        catch (error) {
            console.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    }
    /**
     * Set a value in cache with optional TTL
     */
    async set(key, value, ttlSeconds) {
        if (!this.isAvailable())
            return false;
        try {
            const serialized = typeof value === "string" ? value : JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, serialized);
            }
            else {
                await this.client.set(key, serialized);
            }
            return true;
        }
        catch (error) {
            console.error(`Redis SET error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Delete a key or keys
     */
    async del(...keys) {
        if (!this.isAvailable() || keys.length === 0)
            return false;
        try {
            await this.client.del(...keys);
            return true;
        }
        catch (error) {
            console.error(`Redis DEL error for keys ${keys.join(", ")}:`, error);
            return false;
        }
    }
    /**
     * Delete keys matching a pattern
     */
    async delPattern(pattern) {
        if (!this.isAvailable())
            return 0;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length === 0)
                return 0;
            await this.client.del(...keys);
            return keys.length;
        }
        catch (error) {
            console.error(`Redis DEL pattern error for ${pattern}:`, error);
            return 0;
        }
    }
    /**
     * Check if a key exists
     */
    async exists(key) {
        if (!this.isAvailable())
            return false;
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            console.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Increment a counter
     */
    async incr(key, ttlSeconds) {
        if (!this.isAvailable())
            return 0;
        try {
            const value = await this.client.incr(key);
            if (ttlSeconds && value === 1) {
                // Set TTL only on first increment
                await this.client.expire(key, ttlSeconds);
            }
            return value;
        }
        catch (error) {
            console.error(`Redis INCR error for key ${key}:`, error);
            return 0;
        }
    }
    /**
     * Get TTL of a key
     */
    async ttl(key) {
        if (!this.isAvailable())
            return -1;
        try {
            return await this.client.ttl(key);
        }
        catch (error) {
            console.error(`Redis TTL error for key ${key}:`, error);
            return -1;
        }
    }
    /**
     * Set expiration on a key
     */
    async expire(key, seconds) {
        if (!this.isAvailable())
            return false;
        try {
            await this.client.expire(key, seconds);
            return true;
        }
        catch (error) {
            console.error(`Redis EXPIRE error for key ${key}:`, error);
            return false;
        }
    }
    /**
     * Hash a value for deterministic cache keys
     */
    hash(value) {
        const str = typeof value === "string" ? value : JSON.stringify(value);
        return crypto.createHash("sha256").update(str).digest("hex").substring(0, 16);
    }
    /**
     * Graceful shutdown
     */
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            console.log("👋 Redis: Disconnected");
        }
    }
}
// Export singleton instance
const redis = new RedisService();
export default redis;
export { RedisService };
//# sourceMappingURL=redis.js.map