import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';

export function validateCron(expression: string): boolean {
  return cron.validate(expression);
}

export function getNextRunAt(expression: string, from: Date = new Date()): string {
  try {
    const interval = CronExpressionParser.parse(expression, { currentDate: from });
    return interval.next().toISOString() ?? new Date(from.getTime() + 60 * 1000).toISOString();
  } catch {
    return new Date(from.getTime() + 60 * 1000).toISOString();
  }
}

export function isCronDue(expression: string, from: Date = new Date()): boolean {
  const next = getNextRunAt(expression, from);
  return new Date(next) <= from;
}
