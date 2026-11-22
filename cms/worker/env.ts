/**
 * Minimal Cloudflare binding types.
 *
 * The project deliberately avoids `@cloudflare/workers-types` so the admin
 * bundle and the Worker can share one DOM-based tsconfig without global type
 * collisions. These interfaces only cover the APIs this Worker actually uses.
 */

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2HttpMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
}

export interface R2Object {
  key: string;
  size: number;
  etag?: string;
  uploaded: Date;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}

export interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
  include?: Array<'httpMetadata' | 'customMetadata'>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: {
      httpMetadata?: R2HttpMetadata;
      customMetadata?: Record<string, string>;
    },
  ): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA?: R2Bucket;
  /** Bearer token for the admin UI / API. Set with `wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN?: string;
  /** Comma-separated emails allowed through Cloudflare Access, e.g. "you@bluebook.blue". */
  ACCESS_ALLOWED_EMAILS?: string;
  /** Comma-separated browser origins allowed to call this API cross-origin. */
  ALLOWED_ORIGINS?: string;
}
