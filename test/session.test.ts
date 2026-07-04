import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, closeDb } from '../src/db/connection.js';
import * as sessionsDb from '../src/db/sessions.js';
import * as messagesDb from '../src/db/messages.js';

const WORKSPACE_ID = 'test-workspace';

describe('session and messages', () => {
  beforeEach(() => {
    closeDb(WORKSPACE_ID);
    initDb(WORKSPACE_ID, ':memory:');
  });

  it('creates and retrieves a session', () => {
    const { session, created } = sessionsDb.getOrCreateSession(WORKSPACE_ID, {
      accountId: 'default',
      chatId: 'oc_test',
      chatType: 'group',
      senderId: 'ou_user',
    });
    expect(created).toBe(true);
    expect(session.chatId).toBe('oc_test');

    const second = sessionsDb.getOrCreateSession(WORKSPACE_ID, {
      accountId: 'default',
      chatId: 'oc_test',
      chatType: 'group',
      senderId: 'ou_user',
    });
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(session.id);
  });

  it('stores and lists messages', () => {
    const { session } = sessionsDb.getOrCreateSession(WORKSPACE_ID, {
      accountId: 'default',
      chatId: 'oc_test',
      chatType: 'group',
      senderId: 'ou_user',
    });

    messagesDb.insertMessage(WORKSPACE_ID, { sessionId: session.id, role: 'user', content: 'hello' });
    messagesDb.insertMessage(WORKSPACE_ID, { sessionId: session.id, role: 'assistant', content: 'hi' });

    const messages = messagesDb.listMessages(WORKSPACE_ID, session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
  });

  it('trims old messages', () => {
    const { session } = sessionsDb.getOrCreateSession(WORKSPACE_ID, {
      accountId: 'default',
      chatId: 'oc_test',
      chatType: 'group',
      senderId: 'ou_user',
    });

    for (let i = 0; i < 5; i++) {
      messagesDb.insertMessage(WORKSPACE_ID, { sessionId: session.id, role: 'user', content: String(i) });
    }
    messagesDb.deleteOldMessages(WORKSPACE_ID, session.id, 2);

    const messages = messagesDb.listMessages(WORKSPACE_ID, session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe('3');
    expect(messages[1]?.content).toBe('4');
  });
});
