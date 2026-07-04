import { listActiveDbWorkspaces } from '../db/connection.js';
import {
  addTask,
  deleteTask,
  getTask,
  listAllTasks,
  listEnabledTasks,
  updateTask,
} from './repository.js';
import { validateCron } from './parser.js';
import { reloadSchedulerWorkspace } from './registry.js';
import type { ScheduledTask } from './types.js';

function resolveWorkspaceId(input: Record<string, unknown>, defaultWorkspaceId: string): string {
  const workspaceId = input.workspace_id ?? input.workspaceId;
  return typeof workspaceId === 'string' && workspaceId.length > 0 ? workspaceId : defaultWorkspaceId;
}

function ensureWorkspaceActive(workspaceId: string): void {
  const active = listActiveDbWorkspaces();
  if (!active.includes(workspaceId)) {
    throw new Error(
      `Workspace "${workspaceId}" is not active. Active workspaces: ${active.join(', ') || 'none'}`,
    );
  }
}

export async function executeSchedulerTool(
  defaultWorkspaceId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const workspaceId = resolveWorkspaceId(input, defaultWorkspaceId);
  ensureWorkspaceActive(workspaceId);

  switch (name) {
    case 'scheduler_list_tasks': {
      const enabledOnly = input.enabled_only === true;
      const tasks = enabledOnly ? listEnabledTasks(workspaceId) : listAllTasks(workspaceId);
      return JSON.stringify({ ok: true, workspace_id: workspaceId, tasks: tasks.map(sanitizeTask) });
    }

    case 'scheduler_create_task': {
      const id = requireString(input, 'id');
      const name_ = requireString(input, 'name');
      const cron = requireString(input, 'cron');
      const actionType = requireString(input, 'action_type');
      const actionPayload = requireObject(input, 'action_payload');

      if (!validateCron(cron)) {
        return JSON.stringify({ ok: false, error: `Invalid cron expression: ${cron}` });
      }

      if (getTask(workspaceId, id)) {
        return JSON.stringify({ ok: false, error: `Task "${id}" already exists in workspace "${workspaceId}"` });
      }

      const task: ScheduledTask = {
        id,
        workspaceId,
        name: name_,
        description: optionalString(input.description),
        cron,
        enabled: input.enabled !== false,
        source: 'runtime',
        action: { type: actionType, payload: actionPayload },
      };

      addTask(workspaceId, task);
      reloadSchedulerWorkspace(workspaceId);
      return JSON.stringify({ ok: true, workspace_id: workspaceId, task: sanitizeTask(task) });
    }

    case 'scheduler_update_task': {
      const taskId = requireString(input, 'task_id');
      const existing = getTask(workspaceId, taskId);
      if (!existing) {
        return JSON.stringify({ ok: false, error: `Task "${taskId}" not found in workspace "${workspaceId}"` });
      }

      const cron = optionalString(input.cron);
      if (cron !== undefined && !validateCron(cron)) {
        return JSON.stringify({ ok: false, error: `Invalid cron expression: ${cron}` });
      }

      const actionType = optionalString(input.action_type);
      const actionPayload = input.action_payload !== undefined ? requireObject(input, 'action_payload') : undefined;

      const updated: ScheduledTask = {
        ...existing,
        name: optionalString(input.name) ?? existing.name,
        description: input.description !== undefined ? optionalString(input.description) : existing.description,
        cron: cron ?? existing.cron,
        enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled,
        action: {
          type: actionType ?? existing.action.type,
          payload: actionPayload ?? existing.action.payload,
        },
      };

      updateTask(workspaceId, updated);
      reloadSchedulerWorkspace(workspaceId);
      return JSON.stringify({ ok: true, workspace_id: workspaceId, task: sanitizeTask(updated) });
    }

    case 'scheduler_delete_task': {
      const taskId = requireString(input, 'task_id');
      const removed = deleteTask(workspaceId, taskId);
      if (!removed) {
        return JSON.stringify({ ok: false, error: `Task "${taskId}" not found in workspace "${workspaceId}"` });
      }
      reloadSchedulerWorkspace(workspaceId);
      return JSON.stringify({ ok: true, workspace_id: workspaceId, deleted_task_id: taskId });
    }

    default:
      throw new Error(`Unknown scheduler tool: ${name}`);
  }
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing or invalid required parameter: ${key}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  return value.length > 0 ? value : undefined;
}

function requireObject(input: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = input[key];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Missing or invalid required parameter: ${key} (must be an object)`);
  }
  return value as Record<string, unknown>;
}

function sanitizeTask(task: ScheduledTask): Record<string, unknown> {
  return {
    id: task.id,
    workspace_id: task.workspaceId,
    name: task.name,
    description: task.description,
    cron: task.cron,
    enabled: task.enabled,
    source: task.source,
    action: task.action,
  };
}
