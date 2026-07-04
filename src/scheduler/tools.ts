import type Anthropic from '@anthropic-ai/sdk';

export const schedulerListTasksTool: Anthropic.Messages.Tool = {
  name: 'scheduler_list_tasks',
  description: 'List scheduled tasks for a workspace. Defaults to the current workspace.',
  input_schema: {
    type: 'object',
    properties: {
      workspace_id: {
        type: 'string',
        description: 'Workspace ID (account ID or "shared"). Defaults to current workspace.',
      },
      enabled_only: {
        type: 'boolean',
        description: 'If true, only return enabled tasks.',
      },
    },
  },
};

export const schedulerCreateTaskTool: Anthropic.Messages.Tool = {
  name: 'scheduler_create_task',
  description: 'Create a new scheduled task. The task will be persisted and, if enabled, scheduled immediately.',
  input_schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique task ID (e.g. "daily-report").',
      },
      name: {
        type: 'string',
        description: 'Human-readable task name.',
      },
      cron: {
        type: 'string',
        description: 'Cron expression such as "0 18 * * 1-5".',
      },
      action_type: {
        type: 'string',
        description: 'Action type, e.g. "send_message", "run_lark_cli", "invoke_claude", "cleanup_media".',
      },
      action_payload: {
        type: 'object',
        description: 'Action-specific payload. For send_message: { chat_id, text }.',
      },
      description: {
        type: 'string',
        description: 'Optional task description.',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the task is enabled. Defaults to true.',
      },
      workspace_id: {
        type: 'string',
        description: 'Workspace ID (account ID or "shared"). Defaults to current workspace.',
      },
    },
    required: ['id', 'name', 'cron', 'action_type', 'action_payload'],
  },
};

export const schedulerUpdateTaskTool: Anthropic.Messages.Tool = {
  name: 'scheduler_update_task',
  description: 'Update an existing scheduled task. Only provided fields are changed.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to update.',
      },
      workspace_id: {
        type: 'string',
        description: 'Workspace ID where the task lives. Defaults to current workspace.',
      },
      name: { type: 'string' },
      description: { type: 'string' },
      cron: { type: 'string' },
      enabled: { type: 'boolean' },
      action_type: { type: 'string' },
      action_payload: { type: 'object' },
    },
    required: ['task_id'],
  },
};

export const schedulerDeleteTaskTool: Anthropic.Messages.Tool = {
  name: 'scheduler_delete_task',
  description: 'Delete a scheduled task by ID.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to delete.',
      },
      workspace_id: {
        type: 'string',
        description: 'Workspace ID where the task lives. Defaults to current workspace.',
      },
    },
    required: ['task_id'],
  },
};

export function getSchedulerTools(): Anthropic.Messages.Tool[] {
  return [
    schedulerListTasksTool,
    schedulerCreateTaskTool,
    schedulerUpdateTaskTool,
    schedulerDeleteTaskTool,
  ];
}
