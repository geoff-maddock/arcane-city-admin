import axios, { AxiosInstance } from "axios";
import fs from "fs/promises";
import path from "path";
import type {
  EventRequest,
  EventResponse,
  EntityResponse,
  Tag,
  EventTypeResponse,
  EventStatusResponse,
  Visibility,
  SeriesResponse,
  PaginatedResponse,
} from "@/types/api";
import type { RequestLog } from "@/types/queue";

// Set by processQueue before each item is processed; interceptors push here.
let _activeLogs: RequestLog[] | null = null;
export function setActiveLogs(logs: RequestLog[] | null): void {
  _activeLogs = logs;
}

// ── Token management ────────────────────────────────────────────────────────

const TOKEN_FILE = path.join(process.cwd(), "data", "token.json");
let cachedToken: string | null = null;

async function loadTokenFromFile(): Promise<string | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf-8");
    return (JSON.parse(raw) as { token: string }).token || null;
  } catch {
    return null;
  }
}

async function saveTokenToFile(token: string): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify({ token }), "utf-8");
}

async function invalidateToken(): Promise<void> {
  cachedToken = null;
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}

async function fetchNewToken(): Promise<string> {
  const baseURL = process.env.ARCANE_CITY_API_URL || "https://arcane.city";
  const username = process.env.ARCANE_CITY_USERNAME || "";
  const password = process.env.ARCANE_CITY_PASSWORD || "";
  const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  const res = await axios.post<{ token: string }>(
    `${baseURL}/api/tokens/create`,
    { token_name: "arcane-city-admin" },
    {
      headers: {
        Authorization: basicAuth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const token = res.data.token;
  cachedToken = token;
  await saveTokenToFile(token);
  return token;
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const fileToken = await loadTokenFromFile();
  if (fileToken) {
    cachedToken = fileToken;
    return fileToken;
  }
  return fetchNewToken();
}

// ── Axios client ─────────────────────────────────────────────────────────────

function getClient(): AxiosInstance {
  const baseURL = process.env.ARCANE_CITY_API_URL || "https://arcane.city";

  const client = axios.create({
    baseURL: `${baseURL}/api`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 20000,
  });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    config.headers.Authorization = `Bearer ${token}`;

    if (_activeLogs !== null) {
      const base = (config.baseURL ?? "").replace(/\/$/, "");
      const urlPath = config.url ?? "";
      const qs = config.params
        ? "?" + new URLSearchParams(
            Object.entries(config.params as Record<string, string>).map(([k, v]) => [k, String(v)])
          ).toString()
        : "";
      _activeLogs.push({
        ts: new Date().toISOString(),
        method: (config.method ?? "GET").toUpperCase(),
        url: `${base}${urlPath}${qs}`,
        requestBody: config.data ?? undefined,
      });
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      if (_activeLogs?.length) {
        const last = _activeLogs[_activeLogs.length - 1];
        last.status = response.status;
        last.responseBody = response.data;
      }
      return response;
    },
    async (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !(error.config as Record<string, unknown>)._retried
      ) {
        await invalidateToken();
        const newToken = await fetchNewToken();
        const retryConfig = {
          ...error.config,
          _retried: true,
          headers: { ...error.config?.headers, Authorization: `Bearer ${newToken}` },
        };
        return axios.request(retryConfig);
      }

      if (_activeLogs?.length && axios.isAxiosError(error)) {
        const last = _activeLogs[_activeLogs.length - 1];
        last.status = error.response?.status;
        last.error = error.message;
        last.responseBody = error.response?.data;
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const arcaneApi = {
  async createEvent(data: EventRequest): Promise<EventResponse> {
    const res = await getClient().post<EventResponse>("/events", data);
    return res.data;
  },

  async updateEvent(
    slug: string,
    data: Partial<EventRequest>
  ): Promise<EventResponse> {
    const res = await getClient().put<EventResponse>(`/events/${slug}`, data);
    return res.data;
  },

  async getEvent(slug: string): Promise<EventResponse> {
    const res = await getClient().get<EventResponse>(`/events/${slug}`);
    return res.data;
  },

  async getEvents(params?: {
    name?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<EventResponse>> {
    const queryParams: Record<string, string> = {};
    if (params?.name) queryParams["filters[name]"] = params.name;
    if (params?.page) queryParams["page"] = String(params.page);
    if (params?.limit) queryParams["limit"] = String(params.limit);
    const res = await getClient().get<PaginatedResponse<EventResponse>>(
      "/events",
      { params: queryParams }
    );
    return res.data;
  },

  // Photo upload uses integer event id (NOT slug) per the API spec
  async uploadEventPhoto(
    eventId: number,
    file: { name: string; dataUrl: string; mimeType: string }
  ): Promise<void> {
    const base64Data = file.dataUrl.includes(",")
      ? file.dataUrl.split(",")[1]
      : file.dataUrl;
    const buffer = Buffer.from(base64Data, "base64");

    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", buffer, {
      filename: file.name,
      contentType: file.mimeType,
    });

    const baseURL = process.env.ARCANE_CITY_API_URL || "https://arcane.city";
    const token = await getToken();

    await axios.post(`${baseURL}/api/events/${eventId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });
  },

  async getEntities(params?: {
    name?: string;
    entity_type?: string;
    role?: string;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<EntityResponse>> {
    const queryParams: Record<string, string> = {};
    if (params?.name) queryParams["filters[name]"] = params.name;
    if (params?.entity_type)
      queryParams["filters[entity_type]"] = params.entity_type;
    if (params?.role) queryParams["filters[role]"] = params.role;
    if (params?.limit) queryParams["limit"] = String(params.limit);
    if (params?.page) queryParams["page"] = String(params.page);
    const res = await getClient().get<PaginatedResponse<EntityResponse>>(
      "/entities",
      { params: queryParams }
    );
    return res.data;
  },

  async getTags(params?: {
    name?: string;
    limit?: number;
  }): Promise<PaginatedResponse<Tag>> {
    const queryParams: Record<string, string> = {};
    if (params?.name) queryParams["filters[name]"] = params.name;
    if (params?.limit) queryParams["limit"] = String(params.limit);
    const res = await getClient().get<PaginatedResponse<Tag>>("/tags", {
      params: queryParams,
    });
    return res.data;
  },

  async getEventTypes(): Promise<PaginatedResponse<EventTypeResponse>> {
    const res =
      await getClient().get<PaginatedResponse<EventTypeResponse>>(
        "/event-types"
      );
    return res.data;
  },

  async getEventStatuses(): Promise<PaginatedResponse<EventStatusResponse>> {
    const res =
      await getClient().get<PaginatedResponse<EventStatusResponse>>(
        "/event-statuses"
      );
    return res.data;
  },

  async getVisibilities(): Promise<PaginatedResponse<Visibility>> {
    const res =
      await getClient().get<PaginatedResponse<Visibility>>("/visibilities");
    return res.data;
  },

  async getSeries(params?: {
    name?: string;
    limit?: number;
  }): Promise<PaginatedResponse<SeriesResponse>> {
    const queryParams: Record<string, string> = {};
    if (params?.name) queryParams["filters[name]"] = params.name;
    if (params?.limit) queryParams["limit"] = String(params.limit);
    const res = await getClient().get<PaginatedResponse<SeriesResponse>>(
      "/series",
      { params: queryParams }
    );
    return res.data;
  },

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    const baseURL = process.env.ARCANE_CITY_API_URL || "https://arcane.city";
    const url = `${baseURL}/api/event-types`;
    try {
      await getClient().get("/event-types");
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      if (axios.isAxiosError(err)) {
        if (err.response) {
          const status = err.response.status;
          if (status === 401 || status === 403) {
            return { ok: false, latencyMs, error: `HTTP ${status}: Invalid credentials (${url})` };
          }
          return { ok: false, latencyMs, error: `HTTP ${status}: ${err.response.statusText || "Request failed"} (${url})` };
        }
        if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
          return { ok: false, latencyMs, error: `Cannot reach ${url} — check ARCANE_CITY_API_URL` };
        }
        if (err.code === "ECONNABORTED") {
          return { ok: false, latencyMs, error: `Request timed out (${url})` };
        }
        return { ok: false, latencyMs, error: `${err.message} (${url})` };
      }
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, latencyMs, error: `${msg} (${url})` };
    }
  },
};
