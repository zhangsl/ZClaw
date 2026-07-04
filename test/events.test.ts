import { describe, it, expect } from 'vitest';
import { parseCardActionEvent } from '../src/feishu/events.js';

describe('events', () => {
  it('parses card action event', () => {
    const data = {
      operator: { open_id: 'ou_user' },
      open_chat_id: 'oc_chat',
      open_message_id: 'om_msg',
      open_thread_id: 'ot_thread',
      action: {
        tag: 'button',
        name: 'btn_confirm',
        value: { action: 'confirm', id: '123' },
        form_value: { reason: 'approved' },
      },
    };

    const ctx = parseCardActionEvent(data);
    expect(ctx).toBeDefined();
    expect(ctx?.openId).toBe('ou_user');
    expect(ctx?.chatId).toBe('oc_chat');
    expect(ctx?.messageId).toBe('om_msg');
    expect(ctx?.threadId).toBe('ot_thread');
    expect(ctx?.actionValue).toEqual({ action: 'confirm', id: '123' });
    expect(ctx?.formValue).toEqual({ reason: 'approved' });
    expect(ctx?.actionTag).toBe('button');
    expect(ctx?.actionName).toBe('btn_confirm');
  });

  it('falls back to context fields', () => {
    const data = {
      operator: { open_id: 'ou_user' },
      context: {
        open_chat_id: 'oc_chat_ctx',
        open_message_id: 'om_msg_ctx',
      },
      action: {
        value: { action: 'click' },
      },
    };

    const ctx = parseCardActionEvent(data);
    expect(ctx?.chatId).toBe('oc_chat_ctx');
    expect(ctx?.messageId).toBe('om_msg_ctx');
  });

  it('returns undefined for invalid event', () => {
    expect(parseCardActionEvent({})).toBeUndefined();
    expect(parseCardActionEvent({ action: { value: {} } })).toBeUndefined();
  });
});
