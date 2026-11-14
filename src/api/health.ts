// GET /api/v1/health (ADR 0052).
export interface HealthResponse {
  readonly status: 'ok';
  readonly database: 'ok' | 'unexpected';
  /** The ruleset new series use, as loaded from its frozen bundle. */
  readonly ruleset: number;
}
