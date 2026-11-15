"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ApiError,
  api,
  type FieldIssue,
  type Profile,
  type View,
} from "@/lib/marketplace";

type Phase = "loading" | "ready" | "anonymous" | "error";

interface MarketplaceContextValue {
  view: View | null;
  phase: Phase;
  busy: boolean;
  fieldErrors: Record<string, string>;
  problem: string | null;
  refresh: () => Promise<View>;
  run: <T>(
    action: () => Promise<T>,
    success?: string,
  ) => Promise<T | undefined>;
  login: (username: string, password: string) => Promise<Profile>;
  register: (input: {
    username: string;
    password: string;
    name: string;
    community: string;
  }) => Promise<Profile>;
  logout: () => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Sign in to continue. Your saved information is unchanged.";
    if (error.status === 429)
      return "Too many requests in a short time. Wait a moment, then try again.";
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Reload to check the saved outcome before retrying.";
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api<View>("me");
      setView(next);
      setPhase("ready");
      setFieldErrors({});
      setProblem(null);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setView(null);
        setPhase("anonymous");
        setProblem(null);
        return null as unknown as View;
      }
      setPhase("error");
      setProblem(errorMessage(error));
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    api<View>("me")
      .then((next) => {
        if (!active) return;
        setView(next);
        setPhase("ready");
        setProblem(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setView(null);
          setPhase("anonymous");
          setProblem(null);
        } else {
          setPhase("error");
          setProblem(errorMessage(error));
          toast.error(errorMessage(error), { duration: 10000 });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: string) => {
      setBusy(true);
      setFieldErrors({});
      const loading = toast.loading("Working…", {
        description: "Saved data stays in place.",
      });
      try {
        const result = await action();
        toast.dismiss(loading);
        if (success) toast.success(success);
        return result;
      } catch (error) {
        toast.dismiss(loading);
        toast.error(errorMessage(error), { duration: 10000 });
        if (error instanceof ApiError) {
          if (error.fields.length) {
            setFieldErrors(
              Object.fromEntries(
                error.fields.map((field: FieldIssue) => [
                  field.field,
                  field.message,
                ]),
              ),
            );
          }
          if (error.status === 401) {
            setView(null);
            setPhase("anonymous");
          }
        }
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const profile = await api<Profile>("auth/login", "POST", {
        username,
        password,
      });
      await refresh();
      return profile;
    },
    [refresh],
  );

  const register = useCallback(
    async (input: {
      username: string;
      password: string;
      name: string;
      community: string;
    }) => {
      const profile = await api<Profile>("auth/register", "POST", input);
      await refresh();
      toast.success(`Welcome to Bartr, ${profile.name}.`);
      return profile;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api("auth/logout", "POST", {});
    setView(null);
    setPhase("anonymous");
    toast.success("Signed out.");
  }, []);

  return (
    <MarketplaceContext.Provider
      value={{
        view,
        phase,
        busy,
        fieldErrors,
        problem,
        refresh,
        run,
        login,
        register,
        logout,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context)
    throw new Error("useMarketplace must be used inside MarketplaceProvider");
  return context;
}
