import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountScreen } from "@/components/profile/account-screen";
import { PreferencesScreen } from "@/components/profile/preferences-screen";
import { AuthGate } from "@/components/workspace/auth-gate";
import { ApiError } from "@/lib/marketplace";

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
    view: { profile: { ...saved }, integrations: { gemini_configured: true, bedrock_configured: false } },
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
  it("embeds account details without a second page title", () => {
    render(<AccountScreen embedded />);
    expect(screen.queryByRole("heading", { name: "Your profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public details" })).toBeVisible();
    expect(screen.getByLabelText("Display name", { exact: true })).toHaveValue("Unsaved Alice");
    expect(screen.getByText(/Your display name and community are visible to other members/)).toBeVisible();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("embeds preferences without a second page title while retaining privacy guidance", () => {
    render(<PreferencesScreen embedded />);
    expect(screen.queryByRole("heading", { name: "Your preferences" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What you’re looking for" })).toBeVisible();
    expect(screen.getByText(/These preferences stay private/)).toBeVisible();
    expect(screen.getByLabelText("Interests", { exact: true })).toBeEnabled();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("finishes profile editing only after the save and refreshed account are confirmed", async () => {
    let finishLoad: (value: { profile: typeof saved }) => void = () => {};
    mocks.workspace.load = vi.fn(() => new Promise<{ profile: typeof saved }>(resolve => { finishLoad = resolve; }));
    const onSaved = vi.fn();
    render(<AccountScreen embedded onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(mocks.workspace.load).toHaveBeenCalledOnce());
    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    finishLoad({ profile: saved });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("account", { ...saved, revision: 8 });
    expect(vi.mocked(mocks.workspace.resetProfileDraft as () => void).mock.invocationCallOrder[0]).toBeLessThan(onSaved.mock.invocationCallOrder[0]);
  });

  it.each(["save", "refresh"] as const)("keeps profile editing open when its %s fails", async failureStage => {
    const onSaved = vi.fn();
    if (failureStage === "save") mocks.api.mockRejectedValue(new Error("Profile changed. Review your latest saved details."));
    else mocks.workspace.load = vi.fn(async () => { throw new Error("Connection interrupted. Your edits are still here."); });
    mocks.workspace.run = vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* Provider preserves the failure outcome. */ } });
    render(<AccountScreen embedded onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Display name", { exact: true })).toHaveValue("Unsaved Alice");
  });

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
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard edits and reload" }));
    await waitFor(() => expect(mocks.workspace.resetProfileDraft).toHaveBeenCalledWith("account", saved));
    expect(mocks.api).not.toHaveBeenCalled();
    unmount();
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Reload preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard edits and reload" }));
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
    fireEvent.click(screen.getByText("Get help choosing interests"));
    fireEvent.click(screen.getByRole("button", { name: "Suggest interests" }));
    await waitFor(() => expect(mocks.workspace.setInterpreted).toHaveBeenCalledWith(["Computer monitor"]));
    expect(mocks.workspace.setProfileForm).not.toHaveBeenCalled();
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    expect(mocks.api).toHaveBeenCalledWith("preferences/interpret", "POST", { text: "A screen for studying" });
    mocks.workspace.interpreted = ["Computer monitor"];
    rerender(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Add suggested interests" }));
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ interests: "Unsaved desk, Computer monitor", name: "Unsaved Alice", exclusions: "Unsaved broken" }));
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("edits interests, exclusions and the bounded percentage independently", () => {
    render(<PreferencesScreen />);
    fireEvent.change(screen.getByLabelText("Interests", { exact: true }), { target: { value: "Monitor" } });
    fireEvent.keyDown(screen.getByLabelText("Interests", { exact: true }), { key: "Enter" });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ interests: "Unsaved desk, Monitor" }));
    fireEvent.change(screen.getByLabelText("Exclusions", { exact: true }), { target: { value: "Broken items" } });
    fireEvent.click(screen.getByRole("button", { name: "Add exclusion" }));
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ exclusions: "Unsaved broken, Broken items" }));
    fireEvent.change(screen.getByLabelText("Estimated value difference (%)"), { target: { value: "30" } });
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ gap_limit: 30 }));
    fireEvent.click(screen.getByText("Get help choosing interests"));
    fireEvent.change(screen.getByLabelText("Describe what you’re looking for"), { target: { value: "Study supplies" } });
    expect(mocks.workspace.setNatural).toHaveBeenCalledWith("Study supplies");
    expect(screen.getByLabelText("Estimated value difference (%)")).toHaveAttribute("max", "100");
    expect(screen.getByLabelText("Estimated value difference (%)")).toHaveAttribute("min", "0");
  });

  it("keeps pending interest text when saving without a separate Add action", async () => {
    render(<PreferencesScreen />);
    fireEvent.change(screen.getByLabelText("Interests", { exact: true }), { target: { value: "Monitor" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("profile", "PATCH", expect.objectContaining({ interests: ["Unsaved desk", "Monitor"] })));
  });

  it("removes one interest without saving or altering the other preference fields", () => {
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Remove interest Unsaved desk" }));
    expect(mocks.workspace.setProfileForm).toHaveBeenCalledWith(expect.objectContaining({ interests: "", exclusions: "Unsaved broken", gap_limit: 15 }));
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("does not replace a dirty profile when reload is cancelled", () => {
    render(<AccountScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Reload profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(mocks.workspace.load).not.toHaveBeenCalled();
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Display name")).toHaveValue("Unsaved Alice");
  });

  it("associates backend field errors with the affected profile input", async () => {
    mocks.api.mockRejectedValue(new ApiError("Review your name.", 422, "VALIDATION_ERROR", [{ field: "body.name", message: "Choose a display name." }]));
    mocks.workspace.run = vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* provider preserves the error outcome */ } });
    render(<AccountScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Display name")).toHaveAccessibleDescription("Choose a display name.");
    expect(screen.getByRole("alert")).toHaveTextContent("Review the highlighted fields. Your changes are still here.");
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
  });

  it("keeps manual entry usable when AI assistance is unavailable", () => {
    (mocks.workspace.view as { integrations: { gemini_configured: boolean } }).integrations.gemini_configured = false;
    mocks.workspace.natural = "Study supplies";
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByText("Get help choosing interests"));
    expect(screen.getByRole("button", { name: "Suggest interests" })).toBeDisabled();
    expect(screen.getByLabelText("Interests", { exact: true })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("rejects a twenty-first interest without dropping the existing list or submitting", () => {
    (mocks.workspace.profileForm as { interests: string }).interests = Array.from({ length: 20 }, (_, index) => `Interest ${index + 1}`).join(", ");
    render(<PreferencesScreen />);
    fireEvent.change(screen.getByLabelText("Interests", { exact: true }), { target: { value: "Another interest" } });
    fireEvent.click(screen.getByRole("button", { name: "Add interest" }));
    expect(mocks.workspace.setProfileForm).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Interests", { exact: true })).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your changes are still here");
    expect(mocks.api).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /Remove interest Interest/ })).toHaveLength(20);
  });

  it("associates an indexed preference validation error with the interest entry", async () => {
    mocks.api.mockRejectedValue(new ApiError("Review an interest.", 422, "VALIDATION_ERROR", [{ field: "body.interests.0", message: "Use a shorter interest." }]));
    mocks.workspace.run = vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* provider preserves the error outcome */ } });
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(screen.getByLabelText("Interests", { exact: true })).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Interests", { exact: true })).toHaveAccessibleDescription(expect.stringContaining("Use a shorter interest."));
    expect(mocks.workspace.resetProfileDraft).not.toHaveBeenCalled();
  });

  it("retains the description and manual interests when AI suggestions fail", async () => {
    mocks.workspace.natural = "A screen for studying";
    mocks.api.mockRejectedValue(new Error("Suggestions are temporarily unavailable. Try again."));
    mocks.workspace.run = vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* provider preserves the error outcome */ } });
    render(<PreferencesScreen />);
    fireEvent.click(screen.getByText("Get help choosing interests"));
    fireEvent.click(screen.getByRole("button", { name: "Suggest interests" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Suggestions are temporarily unavailable"));
    expect(screen.getByLabelText("Describe what you’re looking for")).toHaveValue("A screen for studying");
    expect(mocks.workspace.setProfileForm).not.toHaveBeenCalled();
    expect(mocks.workspace.setInterpreted).not.toHaveBeenCalled();
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
