import cron from 'node-cron';
import type { ScheduledTask, TaskExecutionContext } from './types.js';
import { getActionHandler } from './actions.js';
import { listEnabledTasks, updateTaskRun } from './repository.js';
import { getNextRunAt, validateCron } from './parser.js';

export class SchedulerEngine {
  private ctx: TaskExecutionContext;
  private scheduledJobs = new Map<string, ReturnType<typeof cron.schedule>>();
  private running = false;

  constructor(ctx: TaskExecutionContext) {
    this.ctx = ctx;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const tasks = listEnabledTasks(this.ctx.workspaceId);
    for (const task of tasks) {
      this.scheduleTask(task);
    }

    console.info(`[scheduler] Started with ${tasks.length} enabled task(s) in workspace ${this.ctx.workspaceId}`);
  }

  stop(): void {
    this.running = false;
    for (const job of this.scheduledJobs.values()) {
      job.stop();
    }
    this.scheduledJobs.clear();
  }

  reload(): void {
    this.stop();
    this.start();
  }

  private scheduleTask(task: ScheduledTask): void {
    if (!task.enabled || !validateCron(task.cron)) {
      console.warn(`[scheduler] Skipping invalid/disabled task: ${task.id}`);
      return;
    }

    // Stop existing job if rescheduling
    const existing = this.scheduledJobs.get(task.id);
    if (existing) {
      existing.stop();
    }

    const job = cron.schedule(task.cron, async () => {
      await this.executeTask(task);
    });

    this.scheduledJobs.set(task.id, job);
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const handler = getActionHandler(task.action.type);
    if (!handler) {
      console.error(`[scheduler:${task.id}] Unknown action type: ${task.action.type}`);
      this.recordRun(task, false, `Unknown action type: ${task.action.type}`);
      return;
    }

    console.info(`[scheduler:${task.id}] Executing action ${task.action.type}`);
    const startedAt = new Date();

    try {
      await handler(this.ctx, task.action.payload);
      this.recordRun(task, true);
      console.info(`[scheduler:${task.id}] Completed in ${Date.now() - startedAt.getTime()}ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler:${task.id}] Failed: ${message}`);
      this.recordRun(task, false, message);
    }
  }

  private recordRun(task: ScheduledTask, success: boolean, error?: string): void {
    const now = new Date().toISOString();
    const nextRunAt = getNextRunAt(task.cron);
    updateTaskRun(this.ctx.workspaceId, task.id, {
      lastRunAt: now,
      nextRunAt,
      lastStatus: success ? 'success' : 'failed',
      lastError: error,
    });
  }
}
