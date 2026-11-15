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
  signUp: (credentials: { username: string; password: string; name: string; community: string }) => Promise<void>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
  guardSession: <T>(operation: Promise<T>) => Promise<T>;
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
      <output aria-label="Busy">{String(workspace.busy)}</output>
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
      <output aria-label="Draft revisions">{JSON.stringify(workspace.profileDraftRevision)}</output>
      <label>
        Profile name draft
        <input value={workspace.profileForm.name} onChange={(event) => workspace.setProfileForm({
          ...workspace.profileForm, name: event.target.value,
        })} />
      </label>
      <label>
        Interests draft
        <input value={workspace.profileForm.interests} onChange={(event) => workspace.setProfileForm({
          ...workspace.profileForm, interests: event.target.value,
        })} />
      </label>
      <button onClick={() => invoke(workspace.signIn({ username: "alice", password: "synthetic-password" }))}>Sign in</button>
      <button onClick={() => invoke(workspace.signUp({ username: "alice", password: "synthetic-password", name: "Alice", community: "Tempe" }))}>Register</button>
      <button onClick={() => invoke(workspace.signOut())}>Sign out</button>
      <button onClick={() => invoke(workspace.retrySession())}>Retry session</button>
      <button onClick={() => invoke(workspace.load())}>Refresh saved snapshot</button>
      <button onClick={() => invoke(workspace.run(async () => {
        await mocks.api("items", "POST", { title: "New draft" });
      }))}>Save authenticated draft</button>
      <button onClick={() => invoke(workspace.run(async () => {
        const updated = await workspace.guardSession(mocks.api("items/late"));
        workspace.edit(updated as Item);
      }))}>Save delayed item</button>
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

  it("ignores delayed item callbacks after confirmed logout", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    const pending = deferred<Item>();
    mocks.api.mockImplementation((path: string) => path === "items/late" ? pending.promise : Promise.resolve({ signed_out: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save delayed item" }));
    await act(async () => {});
    expect(value("Action error")).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(value("Session status")).toBe("anonymous"));

    await act(async () => { pending.resolve(item); });
    expectPrivateStateCleared();
  });

  it("clears all previous private drafts if /me identifies a different member", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.click(screen.getByRole("button", { name: "Prepare private drafts" }));
    sessionStorage.setItem("bartr-command:previous-member", "pending-command");
    const bob = savedView("Bob");
    bob.profile.id = "bob";
    bob.profile.username = "bob";
    bob.members = [{ id: "bob", name: "Bob", community: "Tempe" }];
    bob.items = [];
    mocks.api.mockResolvedValue(bob);
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));

    await waitFor(() => expect(value("Saved member")).toBe("Bob"));
    expect(JSON.parse(value("Private state")!)).toEqual({
      editor: null, title: "", results: 0, selectedTrade: "", counterpart: "",
      selectedItems: 0, natural: "", interpreted: null, acknowledged: false,
    });
    expect((screen.getByLabelText("Profile name draft") as HTMLInputElement).value).toBe("Bob");
    expect(sessionStorage.getItem("bartr-command:previous-member")).toBeNull();
  });

  it("does not expire a newer signed-in account after an old guarded action returns 401", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    const oldAction = deferred<Item>();
    const bob = savedView("Bob");
    bob.profile.id = "bob";
    mocks.api.mockImplementation((path: string) => {
      if (path === "items/late") return oldAction.promise;
      if (path === "auth/login") return Promise.resolve(bob.profile);
      if (path === "me") return Promise.resolve(bob);
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    fireEvent.click(screen.getByRole("button", { name: "Save delayed item" }));
    await act(async () => {});
    expect(value("Action error")).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(value("Saved member")).toBe("Bob"));

    await act(async () => { oldAction.reject(new ApiError("Old session expired.", 401)); });
    expect(value("Session status")).toBe("authenticated");
    expect(value("Saved member")).toBe("Bob");
    expect(value("Action error")).toBe("");
  });

  it("keeps rejected registration editable as anonymous rather than calling validation an outage", async () => {
    mocks.api.mockRejectedValueOnce(new ApiError("Sign in to continue.", 401));
    renderWorkspace();
    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    mocks.api.mockRejectedValue(new ApiError("That username is unavailable.", 409, "USERNAME_TAKEN"));

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(value("Action error")).toBe("That username is unavailable."));
    expect(value("Session status")).toBe("anonymous");
    expect(value("Authenticated")).toBe("false");
  });

  it("reports an outage if login succeeds but the authoritative workspace cannot be restored", async () => {
    mocks.api.mockRejectedValueOnce(new ApiError("Sign in to continue.", 401));
    renderWorkspace();
    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    mocks.api.mockImplementation((path: string) => path === "auth/login"
      ? Promise.resolve(savedView().profile)
      : Promise.reject(new ApiError("Saved profile unavailable.", 503)));

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(value("Session status")).toBe("unavailable"));
    expect(value("Authenticated")).toBe("false");
    expect(value("Saved member")).toBe("");
    expect(value("Action error")).toBe("Saved profile unavailable.");
  });

  it("advances a preference draft's revision across an unrelated account update without erasing the draft", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.change(screen.getByLabelText("Interests draft"), { target: { value: "My unsaved interests" } });
    const updated = savedView("Alice renamed");
    updated.profile.revision = 3;
    mocks.api.mockResolvedValue(updated);
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));

    await waitFor(() => expect(value("Saved member")).toBe("Alice renamed"));
    expect((screen.getByLabelText("Interests draft") as HTMLInputElement).value).toBe("My unsaved interests");
    expect((screen.getByLabelText("Profile name draft") as HTMLInputElement).value).toBe("Alice renamed");
    expect(JSON.parse(value("Draft revisions")!)).toEqual({ account: 3, preferences: 3 });
  });

  it("retains a dirty account draft's reviewed revision if the same saved section changes elsewhere", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    fireEvent.change(screen.getByLabelText("Profile name draft"), { target: { value: "My unsaved name" } });
    const updated = savedView("Different saved name");
    updated.profile.revision = 3;
    mocks.api.mockResolvedValue(updated);
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));

    await waitFor(() => expect(value("Saved member")).toBe("Different saved name"));
    expect((screen.getByLabelText("Profile name draft") as HTMLInputElement).value).toBe("My unsaved name");
    expect(JSON.parse(value("Draft revisions")!)).toEqual({ account: 2, preferences: 3 });
  });

  it("keeps a newer /me snapshot when an older same-session refresh finishes later", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    const older = deferred<View>();
    const newer = deferred<View>();
    mocks.api.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));
    const newView = savedView("Newest saved name");
    newView.profile.revision = 5;
    await act(async () => { newer.resolve(newView); });
    expect(value("Saved member")).toBe("Newest saved name");

    const oldView = savedView("Outdated saved name");
    oldView.profile.revision = 3;
    await act(async () => { older.resolve(oldView); });
    expect(value("Saved member")).toBe("Newest saved name");
    expect(JSON.parse(value("Draft revisions")!)).toEqual({ account: 5, preferences: 5 });
    expect(value("Action error")).toBe("");
  });

  it("ignores an older /me failure after a newer same-session refresh establishes the session", async () => {
    mocks.api.mockResolvedValue(savedView());
    renderWorkspace();
    await expectAuthenticated();
    const older = deferred<View>();
    const newer = deferred<View>();
    mocks.api.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved snapshot" }));
    await act(async () => { newer.resolve(savedView()); });

    await act(async () => { older.reject(new ApiError("Old request saw an expired session.", 401)); });
    expect(value("Session status")).toBe("authenticated");
    expect(value("Saved member")).toBe("Alice");
    expect(value("Action error")).toBe("");
  });

  it("keeps authentication busy when a superseded attempt finishes during the newer attempt", async () => {
    mocks.api.mockRejectedValueOnce(new ApiError("No session.", 401));
    renderWorkspace();
    await waitFor(() => expect(value("Session status")).toBe("anonymous"));
    const firstLogin = deferred<View["profile"]>();
    const newerRegistration = deferred<View["profile"]>();
    mocks.api.mockImplementation((path: string) => {
      if (path === "auth/login") return firstLogin.promise;
      if (path === "auth/register") return newerRegistration.promise;
      if (path === "me") return Promise.resolve(savedView());
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(value("Busy")).toBe("true");
    await act(async () => { firstLogin.resolve(savedView().profile); });
    expect(value("Session status")).toBe("checking");
    expect(value("Busy")).toBe("true");

    await act(async () => { newerRegistration.resolve(savedView().profile); });
    await expectAuthenticated();
    expect(value("Busy")).toBe("false");
  });
});
