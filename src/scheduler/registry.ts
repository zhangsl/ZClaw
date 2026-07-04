import { SchedulerEngine } from './engine.js';

const engines = new Map<string, SchedulerEngine>();

export function registerSchedulerEngine(workspaceId: string, engine: SchedulerEngine): void {
  engines.set(workspaceId, engine);
}

export function unregisterSchedulerEngine(workspaceId: string): void {
  const engine = engines.get(workspaceId);
  if (engine) {
    engine.stop();
    engines.delete(workspaceId);
  }
}

export function getSchedulerEngine(workspaceId: string): SchedulerEngine | undefined {
  return engines.get(workspaceId);
}

export function reloadSchedulerWorkspace(workspaceId: string): void {
  const engine = engines.get(workspaceId);
  if (engine) {
    engine.reload();
  }
}

export function listSchedulerWorkspaces(): string[] {
  return Array.from(engines.keys());
}
