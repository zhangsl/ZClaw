import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LarkCliRunner } from '../src/lark-cli/runner.js';
import { CliError } from '../src/lark-cli/types.js';

const mockSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (p: string) => p === '/usr/local/bin/lark',
  },
  existsSync: (p: string) => p === '/usr/local/bin/lark',
}));

function createMockChild(stdout: string, stderr: string, exitCode: number) {
  const stdoutListeners = new Map<string, Array<(chunk: unknown) => void>>();
  const stderrListeners = new Map<string, Array<(chunk: unknown) => void>>();
  const closeListeners: Array<(code: number) => void> = [];

  const child = {
    stdout: {
      on(event: string, cb: (chunk: unknown) => void) {
        if (!stdoutListeners.has(event)) stdoutListeners.set(event, []);
        stdoutListeners.get(event)!.push(cb);
      },
    },
    stderr: {
      on(event: string, cb: (chunk: unknown) => void) {
        if (!stderrListeners.has(event)) stderrListeners.set(event, []);
        stderrListeners.get(event)!.push(cb);
      },
    },
    on(event: string, cb: (code: number) => void) {
      if (event === 'close') closeListeners.push(cb);
    },
  };

  setTimeout(() => {
    for (const cb of stdoutListeners.get('data') ?? []) cb(stdout);
    for (const cb of stderrListeners.get('data') ?? []) cb(stderr);
    for (const cb of closeListeners) cb(exitCode);
  }, 0);

  return child;
}

describe('LarkCliRunner', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('parses successful JSON envelope', async () => {
    mockSpawn.mockReturnValue(createMockChild(JSON.stringify({ ok: true, data: { message_id: 'om_123' } }), '', 0));

    const runner = new LarkCliRunner('/usr/local/bin/lark');
    const result = await runner.sendMessage({ chatId: 'oc_123', text: 'hello' });

    expect(result.ok).toBe(true);
    expect(result.data?.message_id).toBe('om_123');
  });

  it('throws CliError on failure envelope', async () => {
    mockSpawn.mockReturnValue(
      createMockChild(JSON.stringify({ ok: false, error: { type: 'auth', message: 'not logged in' } }), '', 0),
    );

    const runner = new LarkCliRunner('/usr/local/bin/lark');
    await expect(runner.exec(['im', '+messages-send', '--chat-id', 'oc_123', '--text', 'hello'])).rejects.toThrow(
      CliError,
    );
  });
});
