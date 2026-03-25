import type { ApiResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const buildUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const getCookieValue = (name: string) => {
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  const prefix = `${name}=`;
  return decodeURIComponent(cookie.slice(prefix.length));
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function ensureCsrfCookie() {
  await fetch(buildUrl("/sanctum/csrf-cookie"), {
    method: "GET",
    credentials: "include",
  });
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
  const csrfToken = getCookieValue("XSRF-TOKEN");

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (csrfToken && method !== "GET") {
    headers["X-XSRF-TOKEN"] = csrfToken;
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: "include",
    headers,
    body: options.body
      ? isFormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as ApiResponse<T> | { message?: string }) : null;

  if (!response.ok) {
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
  const response = await fetch(buildUrl(path), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,application/json",
    },
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
