// Hashu Operator: calls to a mint's operator API (bearer token) or a
// supplier mint's dashboard API (dashboard key), from another origin.

export type MintKind = "operator" | "supplier";

/** A mint this app is signed into. Saved in this app's own storage. */
export type OperatorMint = {
  id: string;
  kind: MintKind;
  /** Name shown in the list: the mint's own name once read. */
  label: string;
  /** Base of the API: `<mint>/operator` for an operator mint, the mint URL
   * for a supplier mint. Paths like `/api/operator` are appended. */
  api: string;
  /** Public mint URL (what wallets use). */
  mintUrl: string;
  /** Operator mints: bearer token from `POST /api/session`. */
  token?: string;
  tokenExpiresMs?: number;
  user?: string;
  /** Supplier mints: the dashboard key from sign-up. */
  key?: string;
  addedMs: number;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** `https://mint.example.com/` → `https://mint.example.com`. */
export function cleanUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) {
    const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(u);
    u = (local ? "http://" : "https://") + u;
  }
  return u.replace(/\/+$/, "");
}

async function errorText(r: Response): Promise<string> {
  const text = await r.text().catch(() => "");
  try {
    const v = JSON.parse(text);
    return v.error || v.detail || text;
  } catch {
    return text || `${r.status} ${r.statusText}`;
  }
}

/** One call to `m`'s API. Throws [`ApiError`] on a non-2xx answer. */
export async function call<T = any>(
  m: Pick<OperatorMint, "kind" | "api" | "token" | "key">,
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (m.kind === "operator" && m.token) {
    headers["Authorization"] = `Bearer ${m.token}`;
  }
  if (m.kind === "supplier" && m.key) headers["x-hashu-key"] = m.key;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(m.api + path, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "omit",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError(
      0,
      "Can't reach the mint. Check the address and your connection."
    );
  }
  if (!r.ok) throw new ApiError(r.status, await errorText(r));
  if (r.status === 204) return undefined as T;
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Where an operator mint's API answers, for the address typed: the mint URL
 * (Caddy serves the API under `/operator/`), its `/operator` URL itself, or a
 * control port reached directly (`http://127.0.0.1:3334`).
 */
export function operatorApiCandidates(url: string): string[] {
  const u = cleanUrl(url);
  if (/\/operator$/i.test(u)) return [u];
  return [u + "/operator", u];
}

export type SessionAnswer = {
  token: string;
  user: string;
  expires_in_s: number;
};

/** Sign into an operator mint. Returns the API base that answered. */
export async function signInOperator(
  url: string,
  user: string,
  password: string
): Promise<{ api: string; session: SessionAnswer }> {
  let last: ApiError | null = null;
  for (const api of operatorApiCandidates(url)) {
    try {
      const session = await call<SessionAnswer>(
        { kind: "operator", api },
        "/api/session",
        { body: { user, password } }
      );
      if (session && typeof session === "object" && session.token) {
        return { api, session };
      }
      last = new ApiError(0, "That address answered, but not as a Hashu mint.");
    } catch (e: any) {
      // 404/405: not the operator API at this base; try the next one.
      // 403 too: a control port reached directly refuses the cross-site
      // POST to a path it doesn't serve (`/operator/...`).
      if (
        e instanceof ApiError &&
        (e.status === 403 || e.status === 404 || e.status === 405)
      ) {
        last = new ApiError(
          e.status,
          "No operator sign-in here. The mint may be on an older version, or its login is off."
        );
        continue;
      }
      throw e;
    }
  }
  throw last ?? new ApiError(0, "No operator sign-in at that address.");
}

/** Check a supplier mint's dashboard key; returns its status. */
export async function signInSupplier(url: string, key: string) {
  const api = cleanUrl(url);
  const m = { kind: "supplier" as const, api, key };
  await call(m, "/api/settings");
  return { api, status: await call<any>(m, "/api/supplier") };
}
