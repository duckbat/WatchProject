export class CollectorError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** A bot wall or rate limit is a persistent condition, not a failed refresh: it must not force constant re-collection. */
export const failureStatus = (e: unknown): 'blocked' | 'error' =>
  e instanceof CollectorError && e.code === 'blocked' ? 'blocked' : 'error';
