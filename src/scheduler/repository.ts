import { getDb } from '../db/connection.js';
import type { ScheduledTask, ScheduledTaskRow, TaskRunInfo } from './types.js';

function rowToTask(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? undefined,
    cron: row.cron,
    enabled: Boolean(row.enabled),
    source: (row.source as 'config' | 'runtime') ?? 'runtime',
    action: {
      type: row.action_type,
      payload: JSON.parse(row.action_payload) as Record<string, unknown>,
    },
  };
}

export function syncTasksFromConfig(workspaceId: string, tasks: ScheduledTask[]): void {
  const db = getDb(workspaceId);
  const now = new Date().toISOString();

  const existingConfigIds = new Set(
    (
      db.prepare("SELECT id FROM scheduled_tasks WHERE source = 'config'").all() as { id: string }[]
    ).map((r) => r.id),
  );

  const upsert = db.prepare(
    `
    INSERT INTO scheduled_tasks (
      id, workspace_id, name, description, cron, action_type, action_payload,
      enabled, source, last_run_at, next_run_at, last_status, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      workspace_id = excluded.workspace_id,
      name = excluded.name,
      description = excluded.description,
      cron = excluded.cron,
      action_type = excluded.action_type,
      action_payload = excluded.action_payload,
      enabled = excluded.enabled,
      source = excluded.source,
      updated_at = excluded.updated_at
    `,
  );

  for (const task of tasks) {
    upsert.run(
      task.id,
      task.workspaceId,
      task.name,
      task.description ?? null,
      task.cron,
      task.action.type,
      JSON.stringify(task.action.payload),
      task.enabled ? 1 : 0,
      'config',
      null,
      null,
      null,
      null,
      now,
      now,
    );
    existingConfigIds.delete(task.id);
  }

  // Delete config tasks that are no longer present in tasks.json
  for (const removedId of existingConfigIds) {
    db.prepare("DELETE FROM scheduled_tasks WHERE id = ? AND source = 'config'").run(removedId);
  }
}

export function getTask(workspaceId: string, taskId: string): ScheduledTask | undefined {
  const db = getDb(workspaceId);
  const row = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(taskId) as ScheduledTaskRow | undefined;
  return row ? rowToTask(row) : undefined;
}

export function listEnabledTasks(workspaceId: string): ScheduledTask[] {
  const db = getDb(workspaceId);
  const rows = db
    .prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1')
    .all() as ScheduledTaskRow[];
  return rows.map(rowToTask);
}

export function listAllTasks(workspaceId: string): ScheduledTask[] {
  const db = getDb(workspaceId);
  const rows = db.prepare('SELECT * FROM scheduled_tasks').all() as ScheduledTaskRow[];
  return rows.map(rowToTask);
}

export function addTask(workspaceId: string, task: ScheduledTask): void {
  const db = getDb(workspaceId);
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO scheduled_tasks (
      id, workspace_id, name, description, cron, action_type, action_payload,
      enabled, source, last_run_at, next_run_at, last_status, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    task.id,
    task.workspaceId,
    task.name,
    task.description ?? null,
    task.cron,
    task.action.type,
    JSON.stringify(task.action.payload),
    task.enabled ? 1 : 0,
    task.source ?? 'runtime',
    null,
    null,
    null,
    null,
    now,
    now,
  );
}

export function updateTask(workspaceId: string, task: ScheduledTask): void {
  const db = getDb(workspaceId);
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE scheduled_tasks SET
      workspace_id = ?,
      name = ?,
      description = ?,
      cron = ?,
      action_type = ?,
      action_payload = ?,
      enabled = ?,
      source = ?,
      updated_at = ?
    WHERE id = ?
    `,
  ).run(
    task.workspaceId,
    task.name,
    task.description ?? null,
    task.cron,
    task.action.type,
    JSON.stringify(task.action.payload),
    task.enabled ? 1 : 0,
    task.source ?? 'runtime',
    now,
    task.id,
  );
}

export function deleteTask(workspaceId: string, taskId: string): boolean {
  const db = getDb(workspaceId);
  const result = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(taskId);
  return result.changes > 0;
}

export function updateTaskRun(workspaceId: string, taskId: string, info: TaskRunInfo): void {
  const db = getDb(workspaceId);
  db.prepare(
    `UPDATE scheduled_tasks
     SET last_run_at = ?, next_run_at = ?, last_status = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
  ).run(info.lastRunAt, info.nextRunAt, info.lastStatus, info.lastError ?? null, new Date().toISOString(), taskId);
}

export function setTaskEnabled(workspaceId: string, taskId: string, enabled: boolean): void {
  const db = getDb(workspaceId);
  db.prepare('UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    new Date().toISOString(),
    taskId,
  );
}
