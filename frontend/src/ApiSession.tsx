import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { login, logout, getCompanies, clearLiveApiGetCache, type Company } from "./live-api";
import { clearWarmSnapshots, warmCompanyWorkspaceData } from "./company-prefetch";

export interface ApiSessionData {
  token: string;
  access?: string;
  access_token?: string;
  refresh?: string;
  companyId: string;
  companies: Company[];
  company?: Company | null;
  user?: any;
}

export interface ApiSessionContextType {
  restoring: boolean;
  token: string;
  companyId: string;
  company: Company | null;
  companies: Company[];
  session: ApiSessionData | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (id: string) => void;
  refreshCompanies: () => Promise<void>;
}

const ApiSessionContext = createContext<ApiSessionContextType | null>(null);

function readInitialSessionState(): {
  token: string;
  refreshToken: string;
  companyId: string;
  companies: Company[];
  user: any;
} {
  try {
    const raw = localStorage.getItem("erp_api_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      const tok = String(parsed.token || parsed.access || localStorage.getItem("erp_token") || "");
      const ref = String(parsed.refresh || localStorage.getItem("erp_refresh") || "");
      const comps: Company[] = Array.isArray(parsed.companies) ? parsed.companies : [];
      const storedCompId = localStorage.getItem("erp_company_id") || "";
      const cId = String(
        (storedCompId && comps.some((c) => c.id === storedCompId) ? storedCompId : "") ||
          parsed.companyId ||
          comps[0]?.id ||
          storedCompId ||
          ""
      );
      return {
        token: tok,
        refreshToken: ref,
        companyId: cId,
        companies: comps,
        user: parsed.user || null,
      };
    }
    const fallbackToken = localStorage.getItem("erp_token") || "";
    const fallbackRefresh = localStorage.getItem("erp_refresh") || "";
    const fallbackCompId = localStorage.getItem("erp_company_id") || "";
    if (fallbackToken) {
      return {
        token: fallbackToken,
        refreshToken: fallbackRefresh,
        companyId: fallbackCompId,
        companies: [],
        user: null,
      };
    }
  } catch (e) {
    console.error("Failed to parse erp_api_session synchronously:", e);
  }
  return {
    token: "",
    refreshToken: "",
    companyId: "",
    companies: [],
    user: null,
  };
}

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => readInitialSessionState(), []);
  // Only mark restoring=true when a bare token exists without cached companies yet
  const [restoring, setRestoring] = useState<boolean>(
    () => Boolean(initial.token && initial.companies.length === 0)
  );
  const [token, setToken] = useState<string>(initial.token);
  const [refreshToken, setRefreshToken] = useState<string>(initial.refreshToken);
  const [companyId, setCompanyId] = useState<string>(initial.companyId);
  const [companies, setCompanies] = useState<Company[]>(initial.companies);
  const [user, setUser] = useState<any>(initial.user);

  useEffect(() => {
    const onTokenChanged = (event: Event) => {
      const session = (event as CustomEvent<ApiSessionData>).detail;
      if (!session) return;
      if (session.token) setToken(session.token);
      if (session.refresh !== undefined) setRefreshToken(session.refresh || "");
      if (session.companyId) setCompanyId(session.companyId);
      if (Array.isArray(session.companies) && session.companies.length > 0) {
        setCompanies(session.companies);
      }
      if (session.user !== undefined) setUser(session.user);
    };
    const onSessionExpired = () => {
      setToken("");
      setRefreshToken("");
      setCompanyId("");
      setCompanies([]);
      setUser(null);
    };
    window.addEventListener("erp_api_token_changed", onTokenChanged);
    window.addEventListener("erp_api_session_expired", onSessionExpired);
    return () => {
      window.removeEventListener("erp_api_token_changed", onTokenChanged);
      window.removeEventListener("erp_api_session_expired", onSessionExpired);
    };
  }, []);

  // Restore session from localStorage on startup
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        const tok = initial.token || parsed.token || parsed.access || "";
        const ref = initial.refreshToken || parsed.refresh || "";
        const cId =
          initial.companyId ||
          parsed.companyId ||
          (parsed.companies && parsed.companies[0]?.id) ||
          "";

        // Background update companies if token is present
        if (tok) {
          getCompanies(tok)
            .then((fresh) => {
              const currentRaw = localStorage.getItem("erp_api_session");
              if (!currentRaw && !localStorage.getItem("erp_token")) return;
              try {
                if (currentRaw) {
                  const currentParsed = JSON.parse(currentRaw);
                  const currentTok = currentParsed.token || currentParsed.access || "";
                  if (currentTok && currentTok !== tok) return;
                }
              } catch {
                return;
              }
              if (Array.isArray(fresh) && fresh.length > 0) {
                setCompanies(fresh);
                let resolvedId = cId;
                if (!cId || !fresh.some((c) => c.id === cId)) {
                  const preferred = fresh.find((c) => c.status === "ACTIVE" || !c.status) || fresh[0];
                  resolvedId = preferred.id;
                  setCompanyId(resolvedId);
                }
                const firstAny = fresh[0] as any;
                const nextUser = parsed.user || (firstAny?.user_email ? { email: firstAny.user_email, full_name: firstAny.user_full_name } : null);
                if (nextUser) setUser(nextUser);
                try {
                  localStorage.setItem(
                    "erp_api_session",
                    JSON.stringify({
                      ...parsed,
                      token: tok,
                      access: tok,
                      access_token: tok,
                      refresh: ref,
                      companyId: resolvedId,
                      companies: fresh,
                      company: fresh.find((c) => c.id === resolvedId) || fresh[0],
                      user: nextUser,
                    })
                  );
                } catch {}
              }
            })
            .catch((err) => {
              console.warn("Could not sync companies on load:", err);
            })
            .finally(() => {
              setRestoring(false);
            });
          return;
        }
      } else if (initial.token) {
        getCompanies(initial.token)
          .then((fresh) => {
            if (Array.isArray(fresh) && fresh.length > 0) {
              setCompanies(fresh);
              const resolvedId =
                (initial.companyId && fresh.some((c) => c.id === initial.companyId)
                  ? initial.companyId
                  : (fresh.find((c) => c.status === "ACTIVE" || !c.status) || fresh[0]).id);
              setCompanyId(resolvedId);
              localStorage.setItem("erp_company_id", resolvedId);
              try {
                localStorage.setItem(
                  "erp_api_session",
                  JSON.stringify({
                    token: initial.token,
                    access: initial.token,
                    access_token: initial.token,
                    refresh: initial.refreshToken,
                    companyId: resolvedId,
                    companies: fresh,
                    company: fresh.find((c) => c.id === resolvedId) || fresh[0],
                  })
                );
              } catch {}
            }
          })
          .catch(() => {})
          .finally(() => {
            setRestoring(false);
          });
        return;
      }
    } catch (e) {
      console.error("Failed to parse erp_api_session:", e);
    }
    setRestoring(false);
  }, [initial.companyId, initial.refreshToken, initial.token]);

  // Listen for background token updates or session expiry
  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string }>;
      if (customEvent.detail?.token) {
        setToken(customEvent.detail.token);
      }
    };
    const handleExpired = () => {
      setToken("");
      setRefreshToken("");
      setCompanyId("");
      setCompanies([]);
      setUser(null);
    };

    window.addEventListener("erp_token_updated", handleUpdated);
    window.addEventListener("erp_session_expired", handleExpired);
    return () => {
      window.removeEventListener("erp_token_updated", handleUpdated);
      window.removeEventListener("erp_session_expired", handleExpired);
    };
  }, []);

  const selectCompany = useCallback((id: string) => {
    setCompanyId(id);
    localStorage.setItem("erp_company_id", id);
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.companyId = id;
        parsed.company = (parsed.companies || []).find((c: Company) => c.id === id) || null;
        localStorage.setItem("erp_api_session", JSON.stringify(parsed));
      }
    } catch {}
  }, []);

  const refreshCompanies = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getCompanies(token);
      if (Array.isArray(fresh)) {
        setCompanies(fresh);
        if (fresh.length > 0 && !fresh.some((c) => c.id === companyId)) {
          selectCompany(fresh[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to refresh companies:", err);
    }
  }, [token, companyId, selectCompany]);

  const signIn = useCallback(
    async (identifier: string, pass: string) => {
      const res = await login(identifier, pass);
      const access = res.access;
      const refresh = res.refresh;

      setToken(access);
      setRefreshToken(refresh);
      localStorage.setItem("erp_token", access);
      localStorage.setItem("erp_refresh", refresh);

      let fetchedCompanies: Company[] = [];
      const inlineCompanies = (res as any).companies;
      if (Array.isArray(inlineCompanies) && inlineCompanies.length > 0) {
        // Fast-path: /api/token/ already returned enriched companies + roles in 1 round-trip
        fetchedCompanies = inlineCompanies;
      } else {
        try {
          fetchedCompanies = await getCompanies(access);
        } catch (err) {
          console.warn("Failed to fetch companies right after login:", err);
        }
      }

      setCompanies(fetchedCompanies);

      let initialCompanyId = "";
      if (fetchedCompanies.length > 0) {
        const preferred =
          fetchedCompanies.find((c) => c.code === "ABC") ||
          fetchedCompanies.find((c) => c.status === "ACTIVE" || !c.status) ||
          fetchedCompanies[0];
        initialCompanyId = preferred.id;
        setCompanyId(initialCompanyId);
        localStorage.setItem("erp_company_id", initialCompanyId);
      }

      const activeComp =
        fetchedCompanies.find((c) => c.id === initialCompanyId) ||
        (fetchedCompanies.length > 0 ? fetchedCompanies[0] : null);

      const firstAny = (activeComp || fetchedCompanies[0]) as any;
      const resolvedUser =
        (res as any).user ||
        (firstAny?.user_email
          ? { email: firstAny.user_email, full_name: firstAny.user_full_name }
          : { email: identifier });

      const sessionObj: ApiSessionData = {
        token: access,
        access,
        access_token: access,
        refresh,
        companyId: initialCompanyId,
        companies: fetchedCompanies,
        company: activeComp,
        user: resolvedUser,
      };

      setUser(resolvedUser);
      localStorage.setItem("erp_api_session", JSON.stringify(sessionObj));
      if (initialCompanyId) {
        void warmCompanyWorkspaceData(access, initialCompanyId);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch (e) {
        console.warn("Logout error:", e);
      }
    }
    setToken("");
    setRefreshToken("");
    setCompanyId("");
    setCompanies([]);
    setUser(null);

    clearLiveApiGetCache();
    clearWarmSnapshots();
    localStorage.removeItem("erp_api_session");
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_refresh");
    localStorage.removeItem("erp_company_id");
  }, [refreshToken]);

  const session = useMemo<ApiSessionData | null>(() => {
    if (!token) return null;
    const activeComp =
      companies.find((c) => c.id === companyId) ||
      (companies.length > 0 ? companies[0] : null);

    return {
      token,
      access: token,
      access_token: token,
      refresh: refreshToken,
      companyId: companyId || (activeComp ? activeComp.id : ""),
      companies,
      company: activeComp,
      user,
    };
  }, [token, refreshToken, companyId, companies, user]);

  const value = useMemo<ApiSessionContextType>(
    () => ({
      restoring,
      token,
      companyId,
      company: session?.company || null,
      companies,
      session,
      signIn,
      signOut,
      selectCompany,
      refreshCompanies,
    }),
    [
      restoring,
      token,
      companyId,
      companies,
      session,
      signIn,
      signOut,
      selectCompany,
      refreshCompanies,
    ]
  );

  return (
    <ApiSessionContext.Provider value={value}>
      {children}
    </ApiSessionContext.Provider>
  );
}

export function useApiSession(): ApiSessionContextType {
  const ctx = useContext(ApiSessionContext);
  if (!ctx) {
    // Return a safe fallback object so components calling without Provider don't immediately crash
    let fallbackToken = "";
    let fallbackCompanyId = "";
    let fallbackCompanies: Company[] = [];
    let fallbackCompany: Company | null = null;
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        fallbackToken = parsed.token || parsed.access || "";
        fallbackCompanyId = parsed.companyId || "";
        fallbackCompanies = parsed.companies || [];
        fallbackCompany = parsed.company || fallbackCompanies.find((c: any) => c.id === fallbackCompanyId) || (fallbackCompanies.length > 0 ? fallbackCompanies[0] : null);
      }
    } catch {}

    return {
      restoring: false,
      token: fallbackToken,
      companyId: fallbackCompanyId,
      company: fallbackCompany,
      companies: fallbackCompanies,
      session: fallbackToken
        ? {
            token: fallbackToken,
            access: fallbackToken,
            access_token: fallbackToken,
            companyId: fallbackCompanyId,
            companies: fallbackCompanies,
          }
        : null,
      signIn: async () => {},
      signOut: async () => {},
      selectCompany: () => {},
      refreshCompanies: async () => {},
    };
  }
  return ctx;
}
