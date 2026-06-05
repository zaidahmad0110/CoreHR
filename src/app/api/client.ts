import type { ApiResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const AUTH_TOKEN_STORAGE_KEY = "corehr_auth_token";
let inMemoryAuthToken: string | null = null;

const buildUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const looksLikeHtml = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<");
};

export const authTokenStore = {
  get() {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? inMemoryAuthToken;
  },
  set(token: string) {
    inMemoryAuthToken = token;
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  },
  clear() {
    inMemoryAuthToken = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  },
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | FormData | null;
}

export interface ApiFileResponse {
  blob: Blob;
  mimeType: string | null;
  fileName: string | null;
}

const parseFileNameFromDisposition = (disposition: string | null) => {
  if (!disposition) {
    return null;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const token = authTokenStore.get();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      method,
      credentials: "omit",
      headers,
      body: options.body
        ? isFormData
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
    });
  } catch {
    throw new ApiError(
      `Unable to reach ${buildUrl(path)}. If this happened while sending email or SMS, check that the backend is online and the SMTP/SMS provider is reachable from the server.`,
      0,
    );
  }

  const text = await response.text();
  let parsed: ApiResponse<T> | { message?: string } | null = null;

  if (text) {
    if (looksLikeHtml(text)) {
      throw new ApiError(
        `API returned HTML instead of JSON for ${buildUrl(path)}. Check VITE_API_BASE_URL, deployment rewrites, and backend availability.`,
        response.status || 500,
      );
    }

    try {
      parsed = JSON.parse(text) as ApiResponse<T> | { message?: string };
    } catch {
      throw new ApiError(
        `API returned a non-JSON response for ${buildUrl(path)}. Check the deployed backend endpoint and logs.`,
        response.status || 500,
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      authTokenStore.clear();
    }

    const message =
      (parsed && "message" in parsed && parsed.message) || "Request failed. Please try again.";
    throw new ApiError(message, response.status);
  }

  if (parsed && "data" in parsed) {
    return parsed.data;
  }

  return null as T;
}

export async function apiFileRequest(path: string): Promise<ApiFileResponse> {
  const token = authTokenStore.get();

  const headers: Record<string, string> = {
    Accept:
      "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    method: "GET",
    credentials: "omit",
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = "Request failed. Please try again.";

    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        message = text;
      }
    }

    throw new ApiError(message, response.status);
  }

  return {
    blob: await response.blob(),
    mimeType: response.headers.get("Content-Type"),
    fileName: parseFileNameFromDisposition(response.headers.get("Content-Disposition")),
  };
}
