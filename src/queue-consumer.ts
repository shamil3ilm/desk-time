// Cloudflare Queues consumer for cron fan-out.
// Only invoked when POLL_DISPATCH_MODE=queue AND the queue binding is configured.
// Each message triggers a runPoll for one user in its own Worker invocation
// (own 50-subrequest budget), same isolation as self-fetch but with built-in
// retries + dead-letter queue.

import type { Env } from "./worker.js";
import { getConfig } from "./config.js";
import { runPoll } from "./ats/poll.js";

export interface PollMessage {
  user_id: number;
  triggered_at: string; // ISO timestamp for debugging
  trigger: "cron" | "manual";
}

export async function pollQueueConsumer(
  batch: MessageBatch<PollMessage>,
  env: Env,
): Promise<void> {
  const config = getConfig(env);
  console.log(`queue consumer: ${batch.messages.length} messages`);
  for (const message of batch.messages) {
    const { user_id } = message.body;
    try {
      const result = await runPoll(env.DB, config, user_id, { syncFirst: true });
      if (result.ok) {
        message.ack();
      } else {
        // Non-throw failure (e.g. ATS 500, network) — let Queues retry with backoff.
        // After max_retries the message goes to the DLQ.
        console.warn(`user ${user_id} poll returned not ok, retrying: ${result.message}`);
        message.retry({ delaySeconds: 30 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`queue consumer user ${user_id} threw:`, msg);
      message.retry({ delaySeconds: 60 });
    }
  }
}
