import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountScreen } from "@/components/profile/account-screen";
import { PreferencesScreen } from "@/components/profile/preferences-screen";
import { AuthGate } from "@/components/workspace/auth-gate";

const mocks = vi.hoisted(() => ({
  api: vi.fn(), replace: vi.fn(), pathname: "/profile/preferences", workspace: {} as Record<string, unknown>,
}));

vi.mock("@/components/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/marketplace", async () => ({
  ...await vi.importActual<typeof import("@/lib/marketplace")>("@/lib/marketplace"), api: mocks.api,
}));

const saved = {
  id: "alice", username: "alice.test", name: "Saved Alice", community: "Saved Campus",
  interests: ["Saved Monitor"], exclusions: ["Damaged"], gap_limit: 20, revision: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/profile/preferences";
  mocks.workspace = {
    sessionStatus: "authenticated", seeded: false, busy: false,
    view: { profile: { ...saved } },
    profileForm: {
      name: "Unsaved Alice", community: "Unsaved Campus", interests: "Unsaved desk",
      exclusions: "Unsaved broken", gap_limit: 15,
    },
    profileDraftRevision: { account: 5, preferences: 6 },
    setProfileForm: vi.fn(), resetProfileDraft: vi.fn(),
    run: vi.fn(async (action: () => Promise<void>) => action()),
    guardSession: vi.fn(async <T,>(promise: Promise<T>) => promise),
    load: vi.fn(async () => ({ profile: saved })), setResults: vi.fn(), setMessage: vi.fn(),
    natural: "", setNatural: vi.fn(), interpreted: null, setInterpreted: vi.fn(), retrySession: vi.fn(),
  };
  mocks.api.mockResolvedValue({ ...saved, revision: 8 });
});

describe("section-scoped profile saves", () => {
  it("saves only account draft fields while preserving saved preferences and the reviewed account revision", async () => {
    render(<AccountScreen />);
    expect(screen.getByRole("heading", { name: "Your profile" })).toBeVisible();
    expect(screen.getByLabelText("Username", { exact: true })).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("profile", "PATCH", {
      name: "Unsaved Alice", community: "Unsaved Campus", interests: ["Saved Monitor"],
      exclusions: ["Damaged"], gap_limit: 20, expected_revision: 5,
    }));
    expect(mocks.workspace.load).toHaveBeenCalledWith();
    expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("account", { ...saved, revision: 8 });
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalledWith("preferences", expect.anything());
  });

  it("saves only preference draft fields while preserving saved account details and the reviewed preference revision", async () => {
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("profile", "PATCH", {
      name: "Saved Alice", community: "Saved Campus", interests: ["Unsaved desk"],
      exclusions: ["Unsaved broken"], gap_limit: 15, expected_revision: 6,
    }));
    expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("preferences", { ...saved, revision: 8 });
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalledWith("account", expect.anything());
  });

  it("does not reset a draft when its save is rejected", async () => {
    mocks.api.mockRejectedValue(new Error("Profile changed"));
    mocks.workspace.run = vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* shared feedback handles the rejection */ } });
    render(<AccountScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Display name", { exact: true })).toHaveValue("Unsaved Alice");
  });

  it("reloads only the chosen section after the member requests renewed review", async () => {
    const { unmount } = render(<AccountScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Reload profile" }));
    await waitFor(() => expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("account", saved));
    expect(mocks.api).not.toHaveBeenCalled();
    unmount();
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Reload preferences" }));
    await waitFor(() => expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("preferences", saved));
  });

  it("allows account fields to be edited without making the username editable", () => {
    render(<AccountScreen />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Reviewed member" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ name: "Reviewed member" }));
    fireEvent.change(screen.getByLabelText("Community"), { target: { value: "New Campus" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ community: "New Campus" }));
    expect(screen.getByLabelText("Username")).toHaveAttribute("readonly");
  });

  it("keeps AI interpretation advisory until the member puts it in their draft", async () => {
    mocks.workspace.natural = "A screen for studying";
    mocks.api.mockResolvedValue({ interests: ["Computer monitor"], summary: "Suggested a study screen." });
    const { rerender } = render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Interpret with Gemini" }));
    await waitFor(() => expect(mocks.workspace.setInterpreted).toHaveBeenCalledWith(["Computer monitor"]));
    expect(mocks.workspace.setProfileForm).not.toHaveBeenCalled();
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    expect(mocks.api).toHaveBeenCalledWith("preferences/interpret", "POST", { text: "A screen for studying" });
    mocks.workspace.interpreted = ["Computer monitor"];
    rerender(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Use these interests in the form" }));
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ interests: "Computer monitor", name: "Unsaved Alice", exclusions: "Unsaved broken" }));
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("edits interests, exclusions and the bounded percentage independently", () => {
    render(<PreferencesScreen />);
    fireEvent.change(screen.getByLabelText("Interests (comma-separated)"), { target: { value: "Monitor, Furniture" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ interests: "Monitor, Furniture" }));
    fireEvent.change(screen.getByLabelText("Exclusions (comma-separated)"), { target: { value: "Broken items" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ exclusions: "Broken items" }));
    fireEvent.change(screen.getByLabelText("Maximum recommendation gap (%)"), { target: { value: "30" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ gap_limit: 30 }));
    fireEvent.change(screen.getByLabelText("Describe what you’re looking for"), { target: { value: "Study supplies" } });
    expect(mocks.workspace.setNatural).toHaveBeenCalledWith("Study supplies");
    expect(screen.getByLabelText("Maximum recommendation gap (%)")).toHaveAttribute("max", "100");
    expect(screen.getByLabelText("Maximum recommendation gap (%)")).toHaveAttribute("min", "0");
  });
});

describe("protected profile presentation", () => {
  it("withholds private children while checking the cookie session", () => {
    mocks.workspace.sessionStatus = "checking";
    render(<AuthGate><p>Private form</p></AuthGate>);
    expect(screen.queryByText("Private form")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/checking/i);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors to Home with the requested internal profile route", async () => {
    mocks.workspace.sessionStatus = "anonymous";
    mocks.workspace.seeded = true;
    render(<AuthGate><p>Private form</p></AuthGate>);
    expect(screen.queryByText("Private form")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/home?next=%2Fprofile%2Fpreferences"));
  });

  it("keeps unavailable sessions distinct from anonymous sessions and exposes retry", () => {
    mocks.workspace.sessionStatus = "unavailable";
    render(<AuthGate><p>Private form</p></AuthGate>);
    expect(screen.getByRole("heading", { name: "Session unavailable" })).toBeVisible();
    expect(screen.queryByText("Private form")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Retry/ }));
    expect(mocks.workspace.retrySession).toHaveBeenCalledOnce();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows private children only after an authenticated session is established", () => {
    render(<AuthGate><p>Private form</p></AuthGate>);
    expect(screen.getByText("Private form")).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
