import { useEffect, useMemo, useState } from "react";
import { useApiSession } from "./ApiSession";
import { ApiError, request } from "./live-api";
import { createApiWriter, errorText, FormDataError, type ApiWriter } from "./misa-api-writes";

type ApiRow = Record<string, any>;
type ApiList = ApiRow[] | { results: ApiRow[]; next?: string | null };

/** Read the existing module tables from the company-scoped backend. */
export function useMisaApiLists(
  companyId: string,
  resources: Record<string, string>,
  notify: (message: string) => void,
) {
  const { token } = useApiSession();
  const key = useMemo(() => JSON.stringify(resources), [resources]);
  const [rows, setRows] = useState<Record<string, ApiRow[]>>({});
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!token || !companyId) {
      setRows({});
      return;
    }
    let active = true;
    const entries = Object.entries(JSON.parse(key) as Record<string, string>);
    const empty = Object.fromEntries(entries.map(([name]) => [name, [] as ApiRow[]]));
    setRows(empty);
    Promise.allSettled(entries.map(async ([name, path]) => {
      const separator = path.includes("?") ? "&" : "?";
      let nextPath: string | null = `${path}${separator}company_id=${encodeURIComponent(companyId)}`;
      const collected: ApiRow[] = [];
      let pages = 0;
      while (nextPath && pages < 50) {
        const response: ApiList = await request<ApiList>(nextPath, token);
        collected.push(...(Array.isArray(response) ? response : response.results));
        if (Array.isArray(response) || !response.next) break;
        const nextUrl: URL = new URL(response.next, window.location.origin);
        nextPath = `${nextUrl.pathname}${nextUrl.search}`;
        pages += 1;
      }
      return [name, collected] as const;
    })).then((results) => {
      if (!active) return;
      const next: Record<string, ApiRow[]> = { ...empty };
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
        else if (!(result.reason instanceof ApiError && result.reason.status === 401)) {
          errors.push(`${entries[index][0]}: ${result.reason instanceof Error ? result.reason.message : "lỗi tải dữ liệu"}`);
        }
      });
      setRows(next);
      if (errors.length) notify(`Không tải được dữ liệu ${errors.join("; ")}`);
    });
    return () => { active = false; };
  }, [token, companyId, key, revision]);

  return { rows, connected: Boolean(token && companyId), reload: () => setRevision((value) => value + 1) };
}

/**
 * Saves a form through the backend: each call gets a fresh writer (fresh catalog lookups),
 * reports the outcome and reloads the tables. Resolves false when nothing was saved.
 */
export function useMisaApiSave(companyId: string, notify: (message: string) => void, reload: () => void) {
  const { token } = useApiSession();
  return async (save: (writer: ApiWriter) => Promise<{ message: string }>) => {
    if (!token || !companyId) return false;
    try {
      const result = await save(createApiWriter(companyId, (path, init) => request(path, token, init)));
      notify(result.message);
      reload();
      return true;
    } catch (error) {
      notify(error instanceof FormDataError ? error.message : `Không lưu được: ${errorText(error)}`);
      return false;
    }
  };
}

export function apiDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = value.slice(0, 10).split("-");
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
}

export function apiNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Items only carry the unit id; resolve its display name from the loaded unit list. */
export function apiUnitName(units: Record<string, any>[] | undefined, id: unknown) {
  const unit = units?.find((row) => row.id === id);
  return unit ? unit.symbol || unit.name || unit.code || "" : "";
}
