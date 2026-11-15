"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type Profile, type View } from "@/lib/marketplace";

export type SessionStatus = "checking" | "authenticated" | "anonymous" | "unavailable";
export type Credentials = { username: string; password: string };
export type Registration = Credentials & { name: string; community?: string };

export class SupersededSession extends Error {
  constructor() { super("This action belongs to an earlier session. Its response was ignored."); }
}

export function clearCommandKeys() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("bartr-command:")) sessionStorage.removeItem(key);
    }
  } catch {
    // Browsers may disable storage. Clearing the in-memory workspace still works.
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The service is unavailable. Try again.";
}

type SessionCallbacks = {
  seeded: boolean;
  onView: (view: View, resetDrafts: boolean) => void;
  onClear: () => void;
  onError: (message: string, error?: unknown) => void;
};

export function useWorkspaceSession(options: SessionCallbacks) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const mounted = useRef(false);
  const memberId = useRef<string | null>(null);
  const currentGeneration = useRef(0);
  const latestViewRequest = useRef(0);
  const [generation, setGeneration] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(options.seeded ? "anonymous" : "checking");

  function isCurrent(token: number) {
    return mounted.current && token === currentGeneration.current;
  }
  function assertCurrent(token: number) {
    if (!isCurrent(token)) throw new SupersededSession();
  }
  function advance() {
    const token = ++currentGeneration.current;
    setGeneration(token);
    return token;
  }
  function becomeAnonymous() {
    currentGeneration.current += 1;
    setGeneration(currentGeneration.current);
    clearCommandKeys();
    memberId.current = null;
    callbacks.current.onClear();
    setSessionStatus("anonymous");
  }
  function recordFailure(error: unknown, token: number, unavailable: boolean) {
    if (error instanceof SupersededSession || !isCurrent(token)) return;
    if (error instanceof ApiError && error.status === 401) becomeAnonymous();
    else if (unavailable) setSessionStatus("unavailable");
    callbacks.current.onError(errorMessage(error), error);
  }
  async function fetchView(token: number, resetDrafts: boolean) {
    assertCurrent(token);
    const request = ++latestViewRequest.current;
    let view: View;
    try {
      view = await api<View>("me");
    } catch (error) {
      assertCurrent(token);
      if (request !== latestViewRequest.current) throw new SupersededSession();
      throw error;
    }
    assertCurrent(token);
    if (request !== latestViewRequest.current) throw new SupersededSession();
    const changedMember = memberId.current !== null && memberId.current !== view.profile.id;
    if (changedMember) {
      advance();
      clearCommandKeys();
      callbacks.current.onClear();
    }
    memberId.current = view.profile.id;
    callbacks.current.onView(view, resetDrafts);
    callbacks.current.onError("");
    setSessionStatus("authenticated");
    if (changedMember) throw new SupersededSession();
    return view;
  }

  async function retrySession() {
    if (callbacks.current.seeded) {
      becomeAnonymous();
      return;
    }
    const restoringMember = memberId.current !== null;
    const token = advance();
    setSessionStatus("checking");
    callbacks.current.onError("");
    try {
      await fetchView(token, true);
    } catch (error) {
      if (!restoringMember && isCurrent(token) && error instanceof ApiError && error.status === 401) {
        becomeAnonymous();
        callbacks.current.onError("");
      } else recordFailure(error, token, true);
    }
  }

  async function authenticate(path: string, credentials: Credentials | Registration) {
    if (callbacks.current.seeded) throw new Error("Seed data cannot create an authenticated session. Disable seed mode to sign in.");
    const token = advance();
    memberId.current = null;
    callbacks.current.onClear();
    clearCommandKeys();
    callbacks.current.onError("");
    setSessionStatus("checking");
    let authenticated = false;
    try {
      await api<Profile>(path, "POST", credentials);
      authenticated = true;
      assertCurrent(token);
      await fetchView(token, true);
    } catch (error) {
      if (isCurrent(token) && !authenticated && error instanceof ApiError && error.status >= 400 && error.status < 500) {
        becomeAnonymous();
        callbacks.current.onError(errorMessage(error), error);
      } else recordFailure(error, token, true);
      throw error;
    }
  }

  async function signIn(credentials: Credentials) { await authenticate("auth/login", credentials); }
  async function signUp(credentials: Registration) { await authenticate("auth/register", credentials); }

  async function signOut() {
    const token = advance();
    callbacks.current.onError("");
    try {
      await api("auth/logout", "POST", {});
      assertCurrent(token);
      becomeAnonymous();
    } catch (error) {
      if (isCurrent(token) && error instanceof ApiError && error.status === 401) {
        becomeAnonymous();
        return;
      }
      recordFailure(error, token, false);
      throw error;
    }
  }

  // Each rendered caller retains its generation. An action started before an
  // account change cannot refresh or repopulate the next account's workspace.
  async function load(options: { resetDrafts?: boolean } = {}) {
    assertCurrent(generation);
    try {
      return await fetchView(generation, options.resetDrafts ?? false);
    } catch (error) {
      recordFailure(error, generation, false);
      throw error;
    }
  }

  async function guardSession<T>(operation: Promise<T>): Promise<T> {
    try {
      const result = await operation;
      assertCurrent(generation);
      return result;
    } catch (error) {
      assertCurrent(generation);
      throw error;
    }
  }

  function handleActionError(error: unknown, token: number) {
    recordFailure(error, token, false);
  }

  useEffect(() => {
    mounted.current = true;
    void retrySession();
    return () => {
      mounted.current = false;
      currentGeneration.current += 1;
    };
    // Mount checks the browser's existing cookie once; callback refs remain fresh.
  }, []);

  return { sessionStatus, generation, isCurrent, assertCurrent, guardSession, signIn, signUp, signOut, retrySession, load, handleActionError };
}
