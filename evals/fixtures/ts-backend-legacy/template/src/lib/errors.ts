/** The `{ code, message }` error body newer routes return. Controllers still use `{ error }`. */
export function apiError(code: string, message: string) {
  return { code, message };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
