export interface ResultOk<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ResultErr {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

export type Result<T> = ResultOk<T> | ResultErr;

export function ok<T>(data: T): ResultOk<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, details?: Record<string, unknown>): ResultErr {
  return details !== undefined
    ? { ok: false, error: { code, message, details } }
    : { ok: false, error: { code, message } };
}
