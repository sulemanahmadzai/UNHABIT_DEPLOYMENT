import IORedis from "ioredis";

const redis = new (IORedis as any)(process.env.REDIS_URL as string, {
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

export default redis;
