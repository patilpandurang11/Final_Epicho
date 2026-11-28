const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "epicho_access_token";
const REFRESH_TOKEN_KEY = "epicho_refresh_token";
const SESSION_EXPIRED_EVENT = "epicho:session-expired";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function clearSessionTokens(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  notifySessionExpired();
}

function requestHeaders(init: RequestInit, tokenOverride?: string): Headers {
  const headers = new Headers(init.headers);
  const token =
    tokenOverride ??
    (typeof window !== "undefined"
      ? window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
      : null);

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    init.body !== undefined &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");
  return headers;
}

async function refreshAccessToken(): Promise<boolean | null> {
  if (typeof window === "undefined") return false;
  const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    clearSessionTokens();
    return false;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    clearSessionTokens();
    return false;
  }

  const data: unknown = await response.json().catch(() => null);
  if (
    typeof data !== "object" ||
    data === null ||
    !("access_token" in data) ||
    typeof data.access_token !== "string" ||
    !data.access_token ||
    !("refresh_token" in data) ||
    typeof data.refresh_token !== "string" ||
    !data.refresh_token
  ) {
    clearSessionTokens();
    return false;
  }

  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  return true;
}

let refreshInFlight: Promise<boolean | null> | null = null;

function refreshOnce(): Promise<boolean | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function shouldRefresh(path: string): boolean {
  return ![
    "/auth/login",
    "/auth/admin-login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
    "/auth/mfa/verify",
  ].includes(path);
}

function errorMessage(responseBody: unknown, status: number): string {
  const detail =
    typeof responseBody === "object" &&
    responseBody !== null &&
    "detail" in responseBody
      ? responseBody.detail
      : null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String(item.msg)
          : String(item),
      )
      .join("; ");
  }
  return `Request failed with status ${status}.`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: requestHeaders(init),
    });
  } catch {
    throw new ApiError("Unable to reach EpiCho. Check your connection and retry.", 0);
  }

  if (response.status === 401 && retryAfterRefresh && shouldRefresh(path)) {
    const refreshed = await refreshOnce();
    if (refreshed === true) return request<T>(path, init, false);
    if (refreshed === null) {
      throw new ApiError("Unable to refresh your session because the service is unreachable.", 0);
    }
  }

  if (response.status === 204) return undefined as T;

  const responseBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(errorMessage(responseBody, response.status), response.status);
  }

  return responseBody as T;
}

export function apiRequest<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return request<T>(path, init);
}

export function apiUpload<T = any>(path: string, body: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

export const api = {
  createRecipe<T = any>(recipe: unknown): Promise<T> {
    return apiRequest<T>("/recipes", {
      method: "POST",
      body: JSON.stringify(recipe),
    });
  },
  createReel<T = any>(reel: unknown): Promise<T> {
    return apiRequest<T>("/reels", {
      method: "POST",
      body: JSON.stringify(reel),
    });
  },
};
