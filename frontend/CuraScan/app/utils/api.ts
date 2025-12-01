// app/utils/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type ApiResponse = { status: number; ok: boolean; body: any };

// priority: EXPO_PUBLIC_BACKEND env -> AsyncStorage CURASCAN_BACKEND -> default local fallback
const ENV_BACKEND = (process?.env as any)?.EXPO_PUBLIC_BACKEND ?? "";

/** read backend base dynamically */
async function resolveBackendBase(): Promise<string> {
  if (ENV_BACKEND && ENV_BACKEND.length > 0) {
    return ENV_BACKEND;
  }
  const stored = await AsyncStorage.getItem("CURASCAN_BACKEND");
  if (stored && stored.length > 0) return stored;
  // fallback local dev host (only works if device on same LAN)
  // Replace 192.168.1.100 with your dev machine IP if you want LAN fallback
  const lanFallback = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  return lanFallback;
}

async function getUrl(path: string) {
  const base = await resolveBackendBase();
  // remove trailing slash collisions
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : "/" + path}`;
}

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<ApiResponse> {
  try {
    const url = await getUrl(path);
    const token = await AsyncStorage.getItem("CURASCAN_JWT");
    const incomingHeaders = (opts.headers as Record<string, string> | undefined) ?? {};
    const headers: Record<string, string> = { ...incomingHeaders };
    const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
    if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token && !headers["Authorization"]) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { ...opts, headers });
    const tex = await res.text();
    try {
      const body = tex ? JSON.parse(tex) : {};
      return { status: res.status, ok: res.ok, body };
    } catch {
      return { status: res.status, ok: res.ok, body: tex };
    }
  } catch (err: any) {
    console.error("[apiFetch] network error", err);
    return { status: 0, ok: false, body: { msg: "Network error", error: String(err) } };
  }
}

/**
 * uploadFile (multipart) — same semantics as your helper
 */
export async function uploadFile(uri: string, name: string, mimeType: string, extraFields: Record<string,string> = {}): Promise<ApiResponse> {
  try {
    const url = await getUrl("/api/upload");
    console.log("📌 Final upload URL:", url);
    const form = new FormData();
    // RN expects object with uri,name,type
    // @ts-ignore
    form.append("file", { uri, name, type: mimeType });
    Object.keys(extraFields).forEach(k => form.append(k, extraFields[k]));
    const token = await AsyncStorage.getItem("CURASCAN_JWT");
    const headers: Record<string,string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // DO NOT set Content-Type header; fetch will set boundary

    // longer timeout logic can be added (AbortController) — keep 120s for uploads
    const controller = new AbortController();
    const timeoutMs = 150000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { method: "POST", body: form as any, headers, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    try {
      const body = text ? JSON.parse(text) : {};
      return { status: res.status, ok: res.ok, body };
    } catch {
      return { status: res.status, ok: res.ok, body: text };
    }
  } catch (err:any) {
    console.error("[uploadFile] error:", err);
    const message = err?.name === "AbortError" ? "Request timed out" : String(err);
    return { status: 0, ok: false, body: { msg: "Network error", error: message } };
  }
}

/** upload image file endpoint (image pipeline, returns pipeline inline) */
export async function uploadImageFile(uri:string, name:string, mimeType:string, extraFields:Record<string,string> = {}) {
  try {
    const url = await getUrl("/api/uploadimage");
    const form = new FormData();
    // @ts-ignore
    form.append("file", { uri, name, type: mimeType });
    Object.keys(extraFields).forEach(k => form.append(k, extraFields[k]));
    const token = await AsyncStorage.getItem("CURASCAN_JWT");
    const headers: Record<string,string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutMs = 150000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { method: "POST", body: form as any, headers, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    try {
      const body = text ? JSON.parse(text) : {};
      return { status: res.status, ok: res.ok, body };
    } catch {
      return { status: res.status, ok: res.ok, body: text };
    }
  } catch (err:any) {
    console.error("[uploadImageFile] error:", err);
    const message = err?.name === "AbortError" ? "Request timed out" : String(err);
    return { status: 0, ok: false, body: { msg: "Network error", error: message } };
  }
}

// convenience helpers
export async function getReports() { return apiFetch("/api/reports", { method: "GET" }); }
export async function getReport(reportId:string) { return apiFetch(`/api/reports/${reportId}`, { method: "GET" }); }

export function getReportFileUrl(reportId:string) {
  // returns file endpoint; must resolve in consumer using resolveBackendBase (async) if needed
  // For convenience return string built from EXPO_PUBLIC_BACKEND if present.
  const env = (process as any)?.env?.EXPO_PUBLIC_BACKEND;
  if (env) return `${env.replace(/\/$/,"")}/api/reports/${reportId}/file`;
  return `/api/reports/${reportId}/file`; // consumer should resolve via apiFetch/getUrl
}

export default apiFetch;
