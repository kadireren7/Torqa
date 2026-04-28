export type PublicApiSuccess<T> = {
  ok: true;
  data: T;
  meta: {
    requestId: string;
  };
};

export type PublicApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  meta: {
    requestId: string;
  };
};

export function wrapPublicSuccess<T>(data: T, requestId: string): PublicApiSuccess<T> {
  return {
    ok: true,
    data,
    meta: { requestId },
  };
}

export function wrapPublicError(code: string, message: string, requestId: string): PublicApiError {
  return {
    ok: false,
    error: { code, message },
    meta: { requestId },
  };
}
