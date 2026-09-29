import { Worker, Job } from "bullmq";
import { QUEUE_NAMES, redisConnection } from "@/lib/queue";

/**
 * Worker sync-lms: Đồng bộ hoạt động LMS theo API/incremental.
 * FR-IMP-03: chỉ lấy dữ liệu mới kể từ lần đồng bộ thành công gần nhất.
 *
 * TODO Phase 2: Implement actual LMS API integration.
 * Hiện tại chỉ scaffold worker — logic thực sẽ thêm khi có API endpoint của LMS.
 */
const syncLmsWorker = new Worker(
  QUEUE_NAMES.SYNC_LMS,
  async (job: Job) => {
    console.log(`[sync-lms] Processing job ${job.id}`, job.data);

    const { lastSyncAt, courseSectionId } = job.data as {
      lastSyncAt?: string;
      courseSectionId?: string;
    };

    // Step 1: Determine sync window
    const syncFrom = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    console.log(
      `[sync-lms] Syncing from ${syncFrom.toISOString()} for section ${courseSectionId || "ALL"}`
    );

    // Step 2: Fetch data from LMS API
    // TODO: Replace with actual LMS API call
    console.log("[sync-lms] LMS API integration pending — skipping actual sync.");

    // Step 3: Process through import pipeline
    // Will use processImport() from import.service.ts once LMS API is connected

    return { synced: 0, message: "LMS API integration pending" };
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 60_000, // Max 5 jobs per minute
    },
  }
);

syncLmsWorker.on("completed", (job) => {
  console.log(`[sync-lms] Job ${job.id} completed:`, job.returnvalue);
});

syncLmsWorker.on("failed", (job, err) => {
  console.error(`[sync-lms] Job ${job?.id} failed:`, err.message);
});

export { syncLmsWorker };
