import { Worker } from "bullmq";
import { QUEUE_NAMES, redisConnection } from "../lib/queue";
import { syncLmsWorker } from "./sync-lms.worker";
import { processEvaluationJob } from "./evaluate-hard-triggers.worker";
import { sendNotificationsWorker } from "./send-notifications.worker";

console.log("🚀 Starting CTUET-EWARS BullMQ Worker...");

const calculateRiskScoreWorker = new Worker(
  QUEUE_NAMES.CALCULATE_RISK_SCORE,
  async (job) => {
    console.log(`[calculate-risk-score] Processing job ${job.id}`);
    return { success: true };
  },
  { connection: redisConnection, concurrency: 5 }
);

const evaluateHardTriggersWorker = new Worker(
  QUEUE_NAMES.EVALUATE_HARD_TRIGGERS,
  processEvaluationJob,
  { connection: redisConnection, concurrency: 3 }
);

const workers = [
  syncLmsWorker,
  calculateRiskScoreWorker,
  evaluateHardTriggersWorker,
  sendNotificationsWorker,
];

workers.forEach((w) => {
  w.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed on queue ${w.name}`);
  });
  w.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed on queue ${w.name}:`, err.message);
  });
});

process.on("SIGTERM", async () => {
  console.log("Shutting down workers gracefully...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
