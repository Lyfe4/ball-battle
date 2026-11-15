// GET /api/v1/health (ADR 0052): 200 when every check passes, 503 naming the checks that failed.
// Why one failed is never in the answer, only in the function's log line.
export interface HealthResponse {
  readonly status: 'ok' | 'down';
  readonly database: 'ok' | 'down';
  /** The ruleset new series use, as loaded from its frozen bundle; null when it didn't load. */
  readonly ruleset: number | null;
  readonly failed: readonly ('database' | 'ruleset')[];
}
