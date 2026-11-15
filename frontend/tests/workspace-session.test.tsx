import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/provider";
import { ApiError, type Item, type Recommendations, type View } from "@/lib/marketplace";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  command: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  seeded: false,
  seedView: null as unknown,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/lib/marketplace", async () => {
  const actual = await vi.importActual<typeof import("@/lib/marketplace")>("@/lib/marketplace");
  return { ...actual, api: mocks.api, command: mocks.command };
});

vi.mock("@/data/seed", () => ({
  get seedEnabled() { return mocks.seeded; },
  createSeedView: () => structuredClone(mocks.seedView),
  createSeedRecommendations: () => ({ recommendations: [], reason: null, retrieval: "fixtures" }),
}));

type SessionWorkspace = ReturnType<typeof useWorkspace> & {
  sessionStatus: "checking" | "authenticated" | "anonymous" | "unavailable";
  signIn: (credentials: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
};

const item: Item = {
  id: "alice-chair", owner: "alice", revision: 1,
  title: "Alice's chair", description: "A study chair", category: "Furniture", condition: "Good",
  image_id: null, value_minor: 4000, value_source: "owner", value_set_at: null,
  uncertainty: null, status: "draft", analysis: null,
};

function savedView(name = "Alice"): View {
  return {
    storage: "temporary-memory",
    integrations: { gemini_configured: false, bedrock_configured: false },
    profile: {
      id: "alice", username: "alice", name, community: "Tempe", interests: ["Monitor"],
      exclusions: ["Damaged"], gap_limit: 20, revision: 2,
    },
    members: [{ id: "alice", name, community: "Tempe" }],
    items: [structuredClone(item)],
    trades: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function Consumer() {
  // The cast describes the planned context interface without changing production
  // types. Current-code failures must be executed missing-behavior assertions.
  const workspace = useWorkspace() as SessionWorkspace;
  const invoke = (operation: Promise<unknown>) => { void operation.catch(() => undefined); };
  return (
    <>
      <output aria-label="Session status">{workspace.sessionStatus ?? "missing"}</output>
      <output aria-label="Authenticated">{String(workspace.hasSession)}</output>
      <output aria-label="Saved member">{workspace.view?.profile.name ?? ""}</output>
      <output aria-label="Private state">{JSON.stringify({
        editor: workspace.editing?.id ?? null,
        title: workspace.form.title,
        results: workspace.results?.recommendations.length ?? 0,
        selectedTrade: workspace.tradeId,
        counterpart: workspace.other,
        selectedItems: workspace.left.length + workspace.right.length,
        natural: workspace.natural,
        interpreted: workspace.interpreted,
        acknowledged: workspace.ack,
      })}</output>
      <output aria-label="Action error">{workspace.error}</output>
      <label>
        Profile name draft
        <input value={workspace.profileForm.name} onChange={(event) => workspace.setProfileForm({
          ...workspace.profileForm, name: event.target.value,
        })} />
      </label>
      <button onClick={() => invoke(workspace.signIn({ username: "alice", password: "synthetic-password" }))}>Sign in</button>
      <button onClick={() => invoke(workspace.signOut())}>Sign out</button>
      <button onClick={() => invoke(workspace.retrySession())}>Retry session</button>
      <button onClick={() => invoke(workspace.load())}>Refresh saved snapshot</button>
      <button onClick={() => invoke(workspace.run(async () => {
        await mocks.api("items", "POST", { title: "New draft" });
      }))}>Save authenticated draft</button>
      <button onClick={() => {
        workspace.edit(item);
        workspace.setForm({ ...workspace.form, title: "Private unsaved title" });
        workspace.setResults({ recommendations: [{ id: "private-recommendation" }], reason: null, retrieval: "fixture" } as Recommendations);
        workspace.setTradeId("private-trade");
        workspace.setOther("private-counterpart");
        workspace.setLeft(["alice-chair"]);
        workspace.setRight(["other-monitor"]);
        workspace.setAck(true);
        workspace.setNatural("Private interest text");
        workspace.setInterpreted(["Private interpretation"]);
        workspace.setProfileForm({ ...workspace.profileForm, name: "Private unsaved name" });
      }}>Prepare private drafts</button>
    </>
  );
}

function renderWorkspace() {
  return render(<WorkspaceProvider><Consumer /></WorkspaceProvider>);
}

function value(label: string) { return screen.getByLabelText(label).textContent; }

async function expectAuthenticated() {
  await waitFor(() => expect(value("Session status")).toBe("authenticated"));
  expect(value("Authenticated")).toBe("true");
  expect(value("Saved member")).toBe("Alice");
}

function expectPrivateStateCleared() {
  expect(value("Saved member")).toBe("");
  expect((screen.getByLabelText("Profile name draft") as HTMLInputElement).value).toBe("");
  expect(JSON.parse(value("Private state")!)).toEqual({
    editor: null, title: "", results: 0, selectedTrade: "", counterpart: "",
    selectedItems: 0, natural: "", interpreted: null, acknowledged: false,
  });
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.command.mockReset();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.seeded = false;
  mocks.seedView = savedView("Fictional Alice");
  sessionStorage.clear();
});

afterEach(cleanup);

describe("Workspace session lifecycle", () => {
  it("checks /me automatically before exposing an authenticated workspace", async () => {
    const pending = deferred<View>();
    mocks.api.mockReturnValue(pending.promise);
    renderWorkspace();

    expect(value("Session status")).toBe("checking");
    expect(value("Authenticated")).toBe("false");
    expect(value("Saved member")).toBe("");
    await waitFor(() => expect(mocks.api.mock.calls[0]?.[0]).toBe("me"));

    await act(async () => { pending.resolve(savedView()); });
    await expectAuthenticated();
  });

  it("classifies /me 401 as anonymous rather than a backend outage", async () => {
    mocks.api.mockRejectedValue(new ApiError("Sign in to continue.", 401, "UNAUTHORIZED"));
    renderWorkspace();

    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    expect(value("Authenticated")).toBe("false");
    expectPrivateStateCleared();
  });

  it("keeps a /me 503 unavailable and can retry the existing cookie session", async () => {
    mocks.api.mockRejectedValueOnce(new ApiError("MongoDB is unavailable.", 503, "DATABASE_UNAVAILABLE"));
    renderWorkspace();

    await waitFor(() => expect(value("Session status")).toBe("unavailable"));
    expect(value("Authenticated")).toBe("false");
    expect(value("Saved member")).toBe("");
    expect(value("Action error")).toMatch(/unavailable/i);
    mocks.api.mockResolvedValue(savedView());
    fireEvent.click(screen.getByRole("button", { name: "Retry session" }));
    await expectAuthenticated();
  });

  it("never treats fictional seed data as an authenticated session", async () => {
    mocks.seeded = true;
    mocks.api.mockRejectedValue(new ApiError("No session.", 401));
    renderWorkspace();

    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    expect(value("Authenticated")).toBe("false");
  });

  it("loads authoritative /me after sign-in instead of trusting the login profile alone", async () => {
    mocks.api.mockRejectedValueOnce(new ApiError("Sign in to continue.", 401));
    renderWorkspace();
    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    const refreshed = deferred<View>();
    mocks.api.mockImplementation((path: string) => {
      if (path === "auth/login") return Promise.resolve(savedView().profile);
      if (path === "me") return refreshed.promise;
      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.api.mock.calls.some(([path]) => path === "auth/login")).toBe(true));
    expect(value("Authenticated")).toBe("false");
    await act(async () => { refreshed.resolve(savedView()); });
    await expectAuthenticated();
    expect(mocks.api).toHaveBeenCalledWith("auth/login", "POST", {
      username: "alice", password: "synthetic-password",
    });
  });

  it("clears all private drafts on logout and ignores a delayed prior /me response", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.click(screen.getByRole("button", { name: "Prepare private drafts" }));
    const oldLoad = deferred<View>();
    mocks.api.mockImplementation((path: string) => path === "me" ? oldLoad.promise : Promise.resolve({ signed_out: true }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    expectPrivateStateCleared();
    await act(async () => { oldLoad.resolve(savedView()); });
    expect(value("Session status")).toBe("anonymous");
    expectPrivateStateCleared();
  });

  it("does not claim successful logout when the server returns 503", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    mocks.api.mockRejectedValue(new ApiError("Database unavailable.", 503));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(value("Action error")).toMatch(/unavailable/i));
    expect(value("Session status")).toBe("authenticated");
    expect(value("Saved member")).toBe("Alice");
  });

  it("clears the prior member's private state when an authenticated action returns 401", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.click(screen.getByRole("button", { name: "Prepare private drafts" }));
    mocks.api.mockRejectedValue(new ApiError("Session expired.", 401, "UNAUTHORIZED"));
    fireEvent.click(screen.getByRole("button", { name: "Save authenticated draft" }));

    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    expectPrivateStateCleared();
  });

  it("preserves a dirty profile draft while an unrelated refresh updates saved data", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.change(screen.getByLabelText("Profile name draft"), { target: { value: "My unsaved name" } });
    mocks.api.mockResolvedValue(savedView("Alice updated elsewhere"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));

    await waitFor(() => expect(value("Saved member")).toBe("Alice updated elsewhere"));
    expect((screen.getByLabelText("Profile name draft") as HTMLInputElement).value).toBe("My unsaved name");
  });
});
