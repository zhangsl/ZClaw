export interface CliEnvelope {
  ok: boolean;
  identity?: string;
  data?: Record<string, unknown>;
  meta?: {
    count?: number;
    rollback?: string;
  };
  error?: CliErrorDetail;
}

export interface CliErrorDetail {
  type: string;
  code?: number;
  message: string;
  hint?: string;
  console_url?: string;
  detail?: unknown;
}

export class CliError extends Error {
  detail: CliErrorDetail;

  constructor(detail: CliErrorDetail) {
    super(detail.message);
    this.name = 'CliError';
    this.detail = detail;
  }
}
