const TOKEN_KEY = "rytham_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export type UserView = {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  timezone: string;
  apiKey: string;
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type UsageView = {
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenBudget: number;
  remainingTokens: number;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...options, headers });
  const body = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Request failed");
  }
  return body;
}

export function loadMe(): Promise<UserView> {
  return request<UserView>("/auth/me");
}

export function loginApiKey(apiKey: string): Promise<{ token: string; user: UserView }> {
  return request<{ token: string; user: UserView }>("/auth/api-key", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export function loadMessages(): Promise<{ messages: ChatMessageView[] }> {
  return request<{ messages: ChatMessageView[] }>("/chat/messages");
}

export function sendChat(
  message: string,
): Promise<{ reply: string; clarification: boolean; executed: boolean }> {
  return request<{ reply: string; clarification: boolean; executed: boolean }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function loadUsage(): Promise<UsageView> {
  return request<UsageView>("/api/usage");
}
