import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../src/db/connection.js';
import { validateCron, getNextRunAt } from '../src/scheduler/parser.js';
import {
  syncTasksFromConfig,
  listEnabledTasks,
  listAllTasks,
  updateTaskRun,
  getTask,
  addTask,
  updateTask,
  deleteTask,
} from '../src/scheduler/repository.js';
import { SchedulerEngine } from '../src/scheduler/engine.js';
import { registerAction } from '../src/scheduler/actions.js';
import type { ScheduledTask, TaskExecutionContext } from '../src/scheduler/types.js';

const WORKSPACE_ID = 'test-scheduler';

function makeTask(id: string, cron: string): ScheduledTask {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    name: id,
    cron,
    enabled: true,
    action: { type: 'noop', payload: {} },
  };
}

describe('scheduler', () => {
  beforeEach(() => {
    closeDb(WORKSPACE_ID);
    initDb(WORKSPACE_ID, ':memory:');
  });

  afterEach(() => {
    closeDb(WORKSPACE_ID);
  });

  it('validates cron expressions', () => {
    expect(validateCron('*/5 * * * *')).toBe(true);
    expect(validateCron('invalid')).toBe(false);
  });

  it('computes next run time', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const next = getNextRunAt('*/5 * * * *', now);
    expect(new Date(next).getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it('syncs tasks from config', () => {
    syncTasksFromConfig(WORKSPACE_ID, [makeTask('task_a', '0 * * * *')]);
    const tasks = listEnabledTasks(WORKSPACE_ID);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe('task_a');
    expect(tasks[0]?.source).toBe('config');
  });

  it('does not delete runtime tasks when syncing config', () => {
    syncTasksFromConfig(WORKSPACE_ID, [makeTask('config_task', '0 * * * *')]);
    addTask(WORKSPACE_ID, makeTask('runtime_task', '0 9 * * *'));

    syncTasksFromConfig(WORKSPACE_ID, [makeTask('config_task', '0 * * * *')]);

    const tasks = listAllTasks(WORKSPACE_ID);
    expect(tasks.map((t) => t.id).sort()).toEqual(['config_task', 'runtime_task']);
  });

  it('deletes removed config tasks on sync', () => {
    syncTasksFromConfig(WORKSPACE_ID, [
      makeTask('keep_task', '0 * * * *'),
      makeTask('remove_task', '0 9 * * *'),
    ]);

    syncTasksFromConfig(WORKSPACE_ID, [makeTask('keep_task', '0 * * * *')]);

    const tasks = listAllTasks(WORKSPACE_ID);
    expect(tasks.map((t) => t.id)).toEqual(['keep_task']);
  });

  it('adds and retrieves a task', () => {
    const task = makeTask('task_b', '0 9 * * *');
    addTask(WORKSPACE_ID, task);

    const found = getTask(WORKSPACE_ID, 'task_b');
    expect(found).toBeDefined();
    expect(found?.source).toBe('runtime');
    expect(found?.cron).toBe('0 9 * * *');
  });

  it('updates a task', () => {
    addTask(WORKSPACE_ID, makeTask('task_c', '0 9 * * *'));

    updateTask(WORKSPACE_ID, {
      ...getTask(WORKSPACE_ID, 'task_c')!,
      cron: '0 10 * * *',
      enabled: false,
    });

    const updated = getTask(WORKSPACE_ID, 'task_c');
    expect(updated?.cron).toBe('0 10 * * *');
    expect(updated?.enabled).toBe(false);
  });

  it('deletes a task', () => {
    addTask(WORKSPACE_ID, makeTask('task_d', '0 9 * * *'));
    expect(getTask(WORKSPACE_ID, 'task_d')).toBeDefined();

    const removed = deleteTask(WORKSPACE_ID, 'task_d');
    expect(removed).toBe(true);
    expect(getTask(WORKSPACE_ID, 'task_d')).toBeUndefined();

    const notFound = deleteTask(WORKSPACE_ID, 'missing');
    expect(notFound).toBe(false);
  });

  it('updates task run info', () => {
    syncTasksFromConfig(WORKSPACE_ID, [makeTask('task_a', '0 * * * *')]);
    updateTaskRun(WORKSPACE_ID, 'task_a', {
      lastRunAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      lastStatus: 'success',
    });
    const tasks = listAllTasks(WORKSPACE_ID);
    expect(tasks[0]?.id).toBe('task_a');
  });

  it('engine schedules and executes noop task', async () => {
    let called = false;
    registerAction('noop', async () => {
      called = true;
    });

    const task: ScheduledTask = {
      id: 'noop_task',
      workspaceId: WORKSPACE_ID,
      name: 'noop',
      cron: '* * * * * *', // every second
      enabled: true,
      action: { type: 'noop', payload: {} },
    };

    syncTasksFromConfig(WORKSPACE_ID, [task]);

    const ctx: TaskExecutionContext = {
      config: {} as TaskExecutionContext['config'],
      cliRunner: {} as TaskExecutionContext['cliRunner'],
      dispatcher: {} as TaskExecutionContext['dispatcher'],
      workspaceId: WORKSPACE_ID,
      accounts: [],
    };

    const engine = new SchedulerEngine(ctx);
    engine.start();

    await new Promise((resolve) => setTimeout(resolve, 1100));

    engine.stop();
    expect(called).toBe(true);
  });
});
