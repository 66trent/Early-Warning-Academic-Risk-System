import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  SYNC_LMS: "sync-lms",
  CALCULATE_RISK_SCORE: "calculate-risk-score",
  EVALUATE_HARD_TRIGGERS: "evaluate-hard-triggers",
  SEND_NOTIFICATIONS: "send-notifications",
} as const;

export const syncLmsQueue = new Queue(QUEUE_NAMES.SYNC_LMS, { connection });
export const calculateRiskScoreQueue = new Queue(QUEUE_NAMES.CALCULATE_RISK_SCORE, { connection });
export const evaluateHardTriggersQueue = new Queue(QUEUE_NAMES.EVALUATE_HARD_TRIGGERS, {
  connection,
});
export const sendNotificationsQueue = new Queue(QUEUE_NAMES.SEND_NOTIFICATIONS, { connection });

export { connection as redisConnection };
