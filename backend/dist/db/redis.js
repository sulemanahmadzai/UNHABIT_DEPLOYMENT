import IORedis from "ioredis";
const redis = new IORedis(process.env.REDIS_URL, {
    tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});
export default redis;
//# sourceMappingURL=redis.js.map