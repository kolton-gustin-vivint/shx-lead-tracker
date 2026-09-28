import type { z } from 'zod';

/** Error type endpoints throw to control the HTTP status the client sees. */
export type ApiErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(opts: { code: ApiErrorCode; message: string }) {
    super(opts.message);
    this.name = 'ApiError';
    this.code = opts.code;
  }
}

/** Kept as an alias so endpoints written against the old runtime keep compiling. */
export const ZiteError = ApiError;

export const HTTP_STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

/**
 * The signed-in user as seen by endpoints. `enrichCurrentUser` copies the
 * user's SHX Team row onto this object, so after that call `id` is the
 * Airtable record id and `role`, `assignedLeads1`, … are available.
 */
export interface RequestUser {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  [key: string]: unknown;
}

export interface EndpointContext {
  user: RequestUser;
  requestId: string;
}

export interface EndpointDef<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> {
  description: string;
  authenticated: boolean;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (args: { input: z.infer<TInput>; context: EndpointContext }) => Promise<z.infer<TOutput>>;
}

export function createEndpoint<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  def: EndpointDef<TInput, TOutput>,
): EndpointDef<TInput, TOutput> {
  return def;
}

export type AnyEndpoint = EndpointDef<z.ZodTypeAny, z.ZodTypeAny>;
