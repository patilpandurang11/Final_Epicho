"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  apiRequest,
  clearSessionTokens,
} from "@/lib/api";

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  username?: string | null;
  account_tier: string;
  tier?: string | null;
  roles: string[];
  permissions?: string[];
  is_verified: boolean;
  mfa_enabled: boolean;
  avatar_url?: string | null;
  profile?: {
    bio?: string | null;
    is_private?: boolean;
    cover_image_url?: string | null;
    cuisine_interests?: string[];
    website_url?: string | null;
    social_links?: Record<string, string>;
    city?: string | null;
    diet_preference?: string | null;
    dietary_restrictions?: string[];
    dislikes?: string[];
    available_equipment?: string[];
    allergies?: string[];
    health_data_consent?: boolean;
  } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  hasRole: (role: string) => boolean;
  login: (accessToken: string, refreshToken: string, user?: AuthUser | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCESS_TOKEN_KEY = "epicho_access_token";
const REFRESH_TOKEN_KEY = "epicho_refresh_token";
const SESSION_EXPIRED_EVENT = "epicho:session-expired";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      (!window.sessionStorage.getItem(ACCESS_TOKEN_KEY) &&
        !window.sessionStorage.getItem(REFRESH_TOKEN_KEY))
    ) {
      setUser(null);
      return null;
    }

    const currentUser = await apiRequest<AuthUser>("/auth/me");
    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    let active = true;
    const handleSessionExpired = () => {
      if (active) {
        setUser(null);
        setIsLoading(false);
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    const hasToken =
      window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
      window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!hasToken) {
      queueMicrotask(() => {
        if (active) setIsLoading(false);
      });
      return () => {
        active = false;
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      };
    }

    apiRequest<AuthUser>("/auth/me")
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          clearSessionTokens();
          if (active) setUser(null);
        } else {
          console.error("Unable to restore the current EpiCho session.", error);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const login = useCallback(
    (
      accessToken: string,
      refreshToken: string,
      authenticatedUser?: AuthUser | null,
    ) => {
      if (!accessToken || !refreshToken) {
        throw new Error("The authentication response did not include session tokens.");
      }
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      setUser(authenticatedUser ?? null);
      setIsLoading(false);
      if (!authenticatedUser) {
        void refreshUser().catch((error: unknown) => {
          console.error("Unable to load the authenticated EpiCho user.", error);
        });
      }
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error: unknown) {
      console.error("The server could not confirm EpiCho sign-out.", error);
    } finally {
      clearSessionTokens();
      setUser(null);
    }
  }, []);

  const isAdmin = Boolean(
    user &&
      user.roles.some((role) =>
        [
          "super_admin",
          "sysadmin",
          "infra_admin",
          "tech_admin",
          "content_moderator",
          "moderator",
          "verification_admin",
          "bizadmin",
          "ranking_admin",
          "finance_admin",
          "finance",
          "customer_support",
          "analytics_admin",
        ].includes(role.toLowerCase()),
      ),
  );

  const hasRole = useCallback(
    (role: string) =>
      Boolean(
        user &&
          user.roles.some((userRole) => userRole.toLowerCase() === role.toLowerCase()),
      ),
    [user],
  );

  const value = useMemo(
    () => ({ user, isLoading, isAdmin, hasRole, login, logout, refreshUser }),
    [user, isLoading, isAdmin, hasRole, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
