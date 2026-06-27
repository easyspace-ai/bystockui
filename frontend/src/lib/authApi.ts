export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthMeResponse {
  user: CurrentUser | null;
  loggedIn: boolean;
  mode?: string;
}

export interface AuthLoginResponse {
  user: CurrentUser;
  loggedIn: boolean;
  token: string;
}

export const AUTH_TOKEN_KEY = "gusheng_auth_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const t = getStoredToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

export async function getMe(): Promise<AuthMeResponse> {
  const res = await fetch("/api/v1/auth/me", { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`auth me failed: ${res.status}`);
  }
  return res.json() as Promise<AuthMeResponse>;
}

export async function loginRequest(login: string, password: string): Promise<AuthLoginResponse> {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: login.trim(), password }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AuthLoginResponse>;
  if (!res.ok) {
    throw new Error(data.error || `登录失败 (${res.status})`);
  }
  if (!data.token || !data.user) {
    throw new Error("登录响应无效");
  }
  return data as AuthLoginResponse;
}

export async function registerRequest(
  username: string,
  contact: string,
  password: string,
): Promise<AuthLoginResponse> {
  const res = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.trim(),
      contact: contact.trim(),
      password,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AuthLoginResponse>;
  if (!res.ok) {
    throw new Error(data.error || `注册失败 (${res.status})`);
  }
  if (!data.token || !data.user) {
    throw new Error("注册响应无效");
  }
  return data as AuthLoginResponse;
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", { method: "POST", headers: authHeaders() });
  } catch {
    /* ignore */
  }
  setStoredToken(null);
}

export async function sendVerificationCode(_contact: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/v1/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`发送验证码失败 (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; message?: string }>;
}
