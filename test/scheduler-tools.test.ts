import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../src/db/connection.js';
import { executeSchedulerTool } from '../src/scheduler/tool-executor.js';
import { getTask } from '../src/scheduler/repository.js';
import { registerSchedulerEngine } from '../src/scheduler/registry.js';
import { SchedulerEngine } from '../src/scheduler/engine.js';

const WORKSPACE_ID = 'test-scheduler-tools';

describe('scheduler tools', () => {
  beforeEach(() => {
    closeDb(WORKSPACE_ID);
    initDb(WORKSPACE_ID, ':memory:');
    registerSchedulerEngine(
      WORKSPACE_ID,
      new SchedulerEngine({
        config: {} as any,
        cliRunner: {} as any,
        dispatcher: {} as any,
        workspaceId: WORKSPACE_ID,
        accounts: [],
      }),
    );
  });

  afterEach(() => {
    closeDb(WORKSPACE_ID);
  });

  it('creates a task', async () => {
    const result = JSON.parse(
      await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
        id: 'daily-report',
        name: 'Daily Report',
        cron: '0 18 * * 1-5',
        action_type: 'send_message',
        action_payload: { chat_id: 'oc_xxx', text: '请填写日报' },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.task.id).toBe('daily-report');

    const stored = getTask(WORKSPACE_ID, 'daily-report');
    expect(stored).toBeDefined();
    expect(stored?.source).toBe('runtime');
  });

  it('lists tasks', async () => {
    await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
      id: 't1',
      name: 'T1',
      cron: '0 * * * *',
      action_type: 'noop',
      action_payload: {},
      enabled: true,
    });

    await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
      id: 't2',
      name: 'T2',
      cron: '0 0 * * *',
      action_type: 'noop',
      action_payload: {},
      enabled: false,
    });

    const all = JSON.parse(await executeSchedulerTool(WORKSPACE_ID, 'scheduler_list_tasks', {}));
    expect(all.ok).toBe(true);
    expect(all.tasks).toHaveLength(2);

    const enabled = JSON.parse(
      await executeSchedulerTool(WORKSPACE_ID, 'scheduler_list_tasks', { enabled_only: true }),
    );
    expect(enabled.tasks).toHaveLength(1);
    expect(enabled.tasks[0]?.id).toBe('t1');
  });

  it('rejects invalid cron', async () => {
    const result = JSON.parse(
      await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
        id: 'bad',
        name: 'Bad',
        cron: 'not-a-cron',
        action_type: 'noop',
        action_payload: {},
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('deletes a task', async () => {
    await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
      id: 'to-delete',
      name: 'To Delete',
      cron: '0 * * * *',
      action_type: 'noop',
      action_payload: {},
    });

    const result = JSON.parse(
      await executeSchedulerTool(WORKSPACE_ID, 'scheduler_delete_task', { task_id: 'to-delete' }),
    );
    expect(result.ok).toBe(true);
    expect(getTask(WORKSPACE_ID, 'to-delete')).toBeUndefined();
  });

  it('updates a task', async () => {
    await executeSchedulerTool(WORKSPACE_ID, 'scheduler_create_task', {
      id: 'to-update',
      name: 'To Update',
      cron: '0 * * * *',
      action_type: 'noop',
      action_payload: {},
      enabled: true,
    });

    const result = JSON.parse(
      await executeSchedulerTool(WORKSPACE_ID, 'scheduler_update_task', {
        task_id: 'to-update',
        cron: '0 9 * * *',
        enabled: false,
      }),
    );
    expect(result.ok).toBe(true);

    const updated = getTask(WORKSPACE_ID, 'to-update');
    expect(updated?.cron).toBe('0 9 * * *');
    expect(updated?.enabled).toBe(false);
  });
});
