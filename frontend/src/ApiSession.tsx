import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { login, logout, getCompanies, type Company } from "./live-api";

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
  token: string;
  companyId: string;
  companies: Company[];
  session: ApiSessionData | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (id: string) => void;
  refreshCompanies: () => Promise<void>;
}

const ApiSessionContext = createContext<ApiSessionContextType | null>(null);

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>("");
  const [refreshToken, setRefreshToken] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [user, setUser] = useState<any>(null);

  // Restore session from localStorage on startup
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        const tok = parsed.token || parsed.access || "";
        const ref = parsed.refresh || "";
        const cId =
          parsed.companyId ||
          (parsed.companies && parsed.companies[0]?.id) ||
          "";
        const comps: Company[] = parsed.companies || [];

        setToken(tok);
        setRefreshToken(ref);
        setCompanyId(cId);
        setCompanies(comps);
        setUser(parsed.user || null);

        // Background update companies if token is present
        if (tok) {
          getCompanies(tok)
            .then((fresh) => {
              if (Array.isArray(fresh) && fresh.length > 0) {
                setCompanies(fresh);
                if (!cId || !fresh.some((c) => c.id === cId)) {
                  setCompanyId(fresh[0].id);
                }
              }
            })
            .catch((err) => {
              console.warn("Could not sync companies on load:", err);
            });
        }
      }
    } catch (e) {
      console.error("Failed to parse erp_api_session:", e);
    }
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
      try {
        fetchedCompanies = await getCompanies(access);
      } catch (err) {
        console.warn("Failed to fetch companies right after login:", err);
        if ((res as any).companies && Array.isArray((res as any).companies)) {
          fetchedCompanies = (res as any).companies;
        }
      }

      setCompanies(fetchedCompanies);

      let initialCompanyId = "";
      if (fetchedCompanies.length > 0) {
        initialCompanyId = fetchedCompanies[0].id;
        setCompanyId(initialCompanyId);
        localStorage.setItem("erp_company_id", initialCompanyId);
      }

      const activeComp =
        fetchedCompanies.find((c) => c.id === initialCompanyId) ||
        (fetchedCompanies.length > 0 ? fetchedCompanies[0] : null);

      const sessionObj: ApiSessionData = {
        token: access,
        access,
        access_token: access,
        refresh,
        companyId: initialCompanyId,
        companies: fetchedCompanies,
        company: activeComp,
        user: (res as any).user || null,
      };

      setUser((res as any).user || null);
      localStorage.setItem("erp_api_session", JSON.stringify(sessionObj));
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
      token,
      companyId,
      companies,
      session,
      signIn,
      signOut,
      selectCompany,
      refreshCompanies,
    }),
    [
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
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        fallbackToken = parsed.token || parsed.access || "";
        fallbackCompanyId = parsed.companyId || "";
        fallbackCompanies = parsed.companies || [];
      }
    } catch {}

    return {
      token: fallbackToken,
      companyId: fallbackCompanyId,
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
