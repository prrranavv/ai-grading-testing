const WAYGROUND_BASE_URL = "https://wayground.com/_quizserver/main";
const WAYGROUND_AUTH_URL =
  "https://wayground.com/_authserver/public/public/v1/auth/login/local";
const WAYGROUND_LOGIN_PAGE_URL = "https://wayground.com/login?backTo=/admin";

const SESSION_TTL_MS = 30 * 60 * 1000;

interface WaygroundSession {
  cookieHeader: string;
  csrfToken: string;
  fetchedAt: number;
}

let sessionCache: WaygroundSession | null = null;
let sessionPromise: Promise<WaygroundSession> | null = null;
const BROWSER_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  priority: "u=1, i",
  "sec-ch-ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"macOS\"",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
} as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value.trim();
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

function parseCookiePairs(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const idx = entry.indexOf("=");
      if (idx <= 0) return;
      const key = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      if (!key) return;
      map.set(key, value);
    });
  return map;
}

function getSetCookieValues(headers: Headers): string[] {
  const maybeNodeHeaders = headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof maybeNodeHeaders.getSetCookie === "function") {
    return maybeNodeHeaders.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=[^;,]+=)/g).map((part) => part.trim());
}

function cookieHeaderFromMap(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function mergeCookieHeaders(...cookieHeaders: string[]): string {
  const merged = new Map<string, string>();
  for (const header of cookieHeaders) {
    if (!header) continue;
    const map = parseCookiePairs(header);
    for (const [key, value] of map.entries()) {
      merged.set(key, value);
    }
  }
  return cookieHeaderFromMap(merged);
}

function seedSessionFromEnv(): WaygroundSession | null {
  const cookie = getOptionalEnv("WAYGROUND_LOGIN_SEED_COOKIE");
  const csrf =
    getOptionalEnv("WAYGROUND_LOGIN_CSRF_TOKEN") ??
    (cookie ? parseCookiePairs(cookie).get("x-csrf-token") ?? parseCookiePairs(cookie).get("_csrf") ?? null : null);
  if (!cookie || !csrf) return null;
  return {
    cookieHeader: cookie,
    csrfToken: csrf,
    fetchedAt: Date.now(),
  };
}

async function warmupLoginSession(
  referer: string
): Promise<{ cookieHeader: string; csrfToken: string | null }> {
  const response = await fetch(WAYGROUND_LOGIN_PAGE_URL, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      referer,
      origin: "https://wayground.com",
      ...BROWSER_HEADERS,
    },
  });

  if (response.headers.get("x-amzn-waf-action") === "challenge") {
    throw new Error(
      "Wayground warmup blocked by WAF challenge while fetching login page."
    );
  }

  const cookieMap = new Map<string, string>();
  for (const setCookie of getSetCookieValues(response.headers)) {
    const pair = setCookie.split(";", 1)[0]?.trim();
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    cookieMap.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }

  return {
    cookieHeader: cookieHeaderFromMap(cookieMap),
    csrfToken: cookieMap.get("x-csrf-token") ?? cookieMap.get("_csrf") ?? null,
  };
}

async function loginWayground(): Promise<WaygroundSession> {
  const username = getEnv("WAYGROUND_LOGIN_USERNAME");
  const password = getEnv("WAYGROUND_LOGIN_PASSWORD");
  const seedCookie = getOptionalEnv("WAYGROUND_LOGIN_SEED_COOKIE") ?? "";
  const initialCsrf = getOptionalEnv("WAYGROUND_LOGIN_CSRF_TOKEN") ?? "";
  const loginReferer =
    getOptionalEnv("WAYGROUND_LOGIN_REFERER") ??
    WAYGROUND_LOGIN_PAGE_URL;

  let warmupCookie = "";
  let warmupCsrf: string | null = null;
  try {
    const warmup = await warmupLoginSession(loginReferer);
    warmupCookie = warmup.cookieHeader;
    warmupCsrf = warmup.csrfToken;
  } catch {
    // Warmup may fail intermittently due WAF; fallback to seed cookie strategy.
  }

  const loginCookie = mergeCookieHeaders(seedCookie, warmupCookie);
  const csrfForLogin = warmupCsrf ?? initialCsrf;

  const response = await fetch(WAYGROUND_AUTH_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      origin: "https://wayground.com",
      referer: loginReferer,
      "x-csrf-token": csrfForLogin,
      "x-q-request-context-path": "LoginPage",
      ...BROWSER_HEADERS,
      ...(loginCookie ? { cookie: loginCookie } : {}),
    },
    body: JSON.stringify({
      username,
      password,
      requestId: "",
    }),
  });

  const wafAction = response.headers.get("x-amzn-waf-action");
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (wafAction === "challenge") {
    throw new Error(
      "Wayground login blocked by WAF challenge. Provide a fresher login seed cookie/CSRF in env vars."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Wayground login failed with ${response.status}: ${text || "Unexpected response"}`
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Wayground login returned non-JSON response (status ${response.status}, content-type: ${contentType || "unknown"}).`
    );
  }

  const cookieMap = parseCookiePairs(loginCookie);
  for (const setCookie of getSetCookieValues(response.headers)) {
    const pair = setCookie.split(";", 1)[0]?.trim();
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!key) continue;
    cookieMap.set(key, value);
  }

  const cookieHeader = cookieHeaderFromMap(cookieMap);
  const csrfToken =
    cookieMap.get("x-csrf-token") ??
    cookieMap.get("_csrf") ??
    csrfForLogin;

  if (!cookieHeader || !csrfToken) {
    throw new Error(
      "Wayground login succeeded but required session cookies/CSRF were missing."
    );
  }

  return {
    cookieHeader,
    csrfToken,
    fetchedAt: Date.now(),
  };
}

async function getWaygroundSession(forceRefresh = false): Promise<WaygroundSession> {
  if (
    !forceRefresh &&
    sessionCache &&
    Date.now() - sessionCache.fetchedAt < SESSION_TTL_MS
  ) {
    return sessionCache;
  }

  if (!forceRefresh && sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = loginWayground()
    .then((session) => {
      sessionCache = session;
      return session;
    })
    .catch((error) => {
      if (sessionCache) return sessionCache;
      const seed = seedSessionFromEnv();
      if (seed) {
        sessionCache = seed;
        return seed;
      }
      throw error;
    })
    .finally(() => {
      sessionPromise = null;
    });

  return sessionPromise;
}

export async function initializeWaygroundSession(forceRefresh = true): Promise<void> {
  await getWaygroundSession(forceRefresh);
}

function getWaygroundHeaders(session: WaygroundSession): HeadersInit {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://wayground.com",
    referer: process.env.WAYGROUND_REFERER ?? "https://wayground.com/admin/quiz",
    "x-component-type": "adminv3",
    "x-csrf-token": session.csrfToken,
    "x-q-request-context-path": "QuizPage",
    cookie: session.cookieHeader,
  };
}

async function parseWaygroundResponse(response: Response) {
  const wafAction = response.headers.get("x-amzn-waf-action");
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (wafAction === "challenge") {
    throw new Error(
      "Wayground WAF challenge blocked the request. Refresh your Wayground session and copy a fresh full Cookie + CSRF token (including any WAF cookies)."
    );
  }

  if (response.ok && (!text || !contentType.includes("application/json"))) {
    throw new Error(
      `Wayground returned non-JSON response (status ${response.status}, content-type: ${contentType || "unknown"}).`
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `Wayground returned invalid JSON (status ${response.status}): ${
        text || "Unexpected response"
      }`
    );
  }
  if (!response.ok) {
    const errorValue = data?.error;
    const message =
      (typeof errorValue === "object" &&
      errorValue &&
      "message" in errorValue &&
      typeof (errorValue as { message?: unknown }).message === "string"
        ? (errorValue as { message: string }).message
        : undefined) ||
      (typeof errorValue === "string" ? errorValue : undefined) ||
      (typeof data?.message === "string" ? data.message : undefined) ||
      `Wayground API failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function waygroundRequest(
  path: string,
  init?: RequestInit
): Promise<unknown> {
  async function run(session: WaygroundSession) {
    const response = await fetch(`${WAYGROUND_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...getWaygroundHeaders(session),
        ...(init?.headers ?? {}),
      },
    });
    return parseWaygroundResponse(response);
  }

  try {
    const session = await getWaygroundSession(false);
    return await run(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldRetry =
      message.includes("401") ||
      message.includes("403") ||
      message.includes("WAF challenge") ||
      message.includes("non-JSON response");

    if (!shouldRetry) throw error;

    const freshSession = await getWaygroundSession(true);
    return run(freshSession);
  }
}
