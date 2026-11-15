"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, command, type View, type Profile, type Item, type Trade, type Recommendations } from "@/lib/marketplace";
import { seedEnabled } from "@/data/seed";
import { SupersededSession, useWorkspaceSession } from "./session";
import { profileDraft, reconcileProfileDraft, type ProfileDraft, type DraftRevisions } from "./session-profile";
import { useListingDrafts } from "./listing-drafts";

// Empty page state is not an authenticated identity or sample account.
const emptyWorkspace: Omit<View, "storage"> & { storage: "unloaded" } = {
  storage: "unloaded",
  integrations: { gemini_configured: false, bedrock_configured: false },
  profile: { id: "", username: "", name: "", community: "", interests: [], exclusions: [], gap_limit: 20, revision: 0 },
  members: [], items: [], trades: [],
};

function useWorkspaceState() {
  const router = useRouter();
  const pathname = usePathname();
  const tab = pathname.split("/")[1] || "home";
  const setTab = (value: string) => router.push(({ inventory: "/profile/inventory", preferences: "/profile/preferences", discover: "/discover", trades: "/trades" } as Record<string, string>)[value] ?? `/${value}`);
  const [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setErrorState] = useState("");
  const [actionError, setActionError] = useState<ApiError | null>(null);
  function setError(value: SetStateAction<string>) {
    setErrorState(value);
    setActionError(null);
  }
  const listingDrafts = useListingDrafts();
  const { editing, setEditing, form, setForm, edit, replaceItemDraft, listingDirty, hasListingDrafts } = listingDrafts;
  const [results, setResults] = useState<Recommendations | null>(null),
    [semantic, setSemantic] = useState(true);
  const [tradeId, setTradeId] = useState(""),
    [other, setOther] = useState(""),
    [left, setLeft] = useState<string[]>([]),
    [right, setRight] = useState<string[]>([]),
    [ack, setAck] = useState(false),
    [natural, setNatural] = useState(""),
    [interpreted, setInterpreted] = useState<string[] | null>(null);
  const [profileForm, setProfileFormState] = useState(profileDraft(emptyWorkspace.profile));
  const profileFormRef = useRef(profileForm);
  function setProfileForm(value: SetStateAction<ProfileDraft>) {
    const next = typeof value === "function" ? value(profileFormRef.current) : value;
    profileFormRef.current = next;
    setProfileFormState(next);
  }
  const [profileDraftRevision, setProfileDraftRevisionState] = useState({ account: 0, preferences: 0 });
  const draftRevisionsRef = useRef(profileDraftRevision);
  function setProfileDraftRevision(value: DraftRevisions) {
    draftRevisionsRef.current = value;
    setProfileDraftRevisionState(value);
  }
  const savedProfile = useRef<Profile | null>(null);
  function clearPrivateState() {
    savedProfile.current = null;
    setView(null);
    listingDrafts.resetListingDrafts();
    setResults(null);
    setTradeId("");
    setOther("");
    setLeft([]);
    setRight([]);
    setAck(false);
    setNatural("");
    setInterpreted(null);
    setProfileForm(profileDraft(emptyWorkspace.profile));
    setProfileDraftRevision({ account: 0, preferences: 0 });
    setMessage("");
    setError("");
    setBusy(false);
  }
  const session = useWorkspaceSession({
    seeded: seedEnabled,
    onClear: clearPrivateState,
    onError: (message, error) => {
      setErrorState(message);
      setActionError(error instanceof ApiError ? error : null);
    },
    onView: (next, resetDrafts) => {
      const previous = savedProfile.current;
      const changedMember = previous?.id !== next.profile.id;
      savedProfile.current = next.profile;
      setView(next);
      listingDrafts.reconcileListings(next.items.filter((item) => item.owner === next.profile.id));
      if (resetDrafts || changedMember) {
        setProfileForm(profileDraft(next.profile));
        setProfileDraftRevision({ account: next.profile.revision, preferences: next.profile.revision });
      } else if (previous) {
        const merged = reconcileProfileDraft(profileFormRef.current, previous, next.profile, draftRevisionsRef.current);
        setProfileForm(merged.draft);
        setProfileDraftRevision(merged.revisions);
      }
    },
  });
  const { load, guardSession, retrySession, sessionStatus } = session;
  const authenticationAttempt = useRef(0);
  async function authenticationAction(action: () => Promise<void>) {
    const attempt = ++authenticationAttempt.current;
    const pending = action();
    setBusy(true);
    try { await pending; } finally {
      if (attempt === authenticationAttempt.current) setBusy(false);
    }
  }
  const signIn = (credentials: Parameters<typeof session.signIn>[0]) => authenticationAction(() => session.signIn(credentials));
  const signUp = (credentials: Parameters<typeof session.signUp>[0]) => authenticationAction(() => session.signUp(credentials));
  const signOut = () => authenticationAction(session.signOut);
  const loading = sessionStatus === "checking";
  function resetProfileDraft(section: "account" | "preferences", profile = savedProfile.current) {
    if (!profile) return;
    const saved = profileDraft(profile);
    setProfileForm((current) => section === "account"
      ? { ...current, name: saved.name, community: saved.community }
      : { ...current, interests: saved.interests, exclusions: saved.exclusions, gap_limit: saved.gap_limit });
    setProfileDraftRevision({ ...draftRevisionsRef.current, [section]: profile.revision });
  }
  async function run(action: () => Promise<void>) {
    if (seedEnabled) {
      setMessage("Frontend seed data only. Backend actions are disabled and no changes are saved.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const generation = session.generation;
    try {
      await action();
    } catch (e) {
      if (!(e instanceof SupersededSession)) session.handleActionError(e, generation);
    } finally {
      if (session.isCurrent(generation)) setBusy(false);
    }
  }
  const who = view?.profile.id;
  const mine = view?.items.filter((x) => x.owner === who) || [];
  const trade = view?.trades.find((x) => x.id === tradeId);
  const offer = trade?.offers.at(-1);
  const name = (id: string) =>
    view?.members.find((x) => x.id === id)?.name || "Member";
  const facts = () => ({
    title: form.title,
    description: form.description,
    category: form.category,
    condition: form.condition,
    value_minor:
      form.value === "" ? null : Math.round(Number(form.value) * 100),
    status: form.status,
  });
  async function saveItem(options: { status?: Item["status"]; analysisId?: string } = {}) {
    const generation = session.generation;
    const submitted = { ...form };
    const previousItem = editing;
    const data = { ...facts(), ...(options.status ? { status: options.status } : {}) };
    const saved = editing
      ? await api<Item>(`items/${editing.id}`, "PATCH", {
          ...data,
          expected_revision: editing.revision,
          ...(options.analysisId ? { analysis_id: options.analysisId } : {}),
        })
      : await api<Item>("items", "POST", data);
    session.assertCurrent(generation);
    listingDrafts.savedListing(saved, submitted, previousItem);
    await load();
    setResults(null);
    setMessage("Listing saved.");
    return saved;
  }
  async function submitOffer(counter = false) {
    if (!view) return;
    if (!ack) return;
    await run(async () => {
      let t: Trade;
      if (counter && trade) {
        t = await command<Trade>(`trades/${trade.id}/actions`, {
          kind: "counter",
          expected_revision: trade.revision,
          left,
          right,
          acknowledged: ack,
        });
      } else {
        t = await command<Trade>("trades", {
          other,
          left,
          right,
          acknowledged: ack,
          command_id: crypto.randomUUID(),
        });
      }
      await load();
      setTradeId(t.id);
      setTab("trades");
      setMessage("Offer submitted. Only your consent is recorded.");
      setLeft([]);
      setRight([]);
      setAck(false);
    });
  }
  async function act(kind: string, note = "") {
    if (!trade) return;
    let saved = false;
    await run(async () => {
      await command(`trades/${trade.id}/actions`, {
        kind,
        expected_revision: trade.revision,
        note,
        acknowledged: ack,
      });
      await load();
      saved = true;
      setMessage(
        "Action saved. The displayed trade is the current recorded outcome.",
      );
      setAck(false);
    });
    return saved;
  }
  function toggle(side: "left" | "right", id: string) {
    const set = side === "left" ? setLeft : setRight;
    set((values) =>
      values.includes(id)
        ? values.filter((x) => x !== id)
        : values.length < 3
          ? [...values, id]
          : values,
    );
  }

  return {
    view: view ?? emptyWorkspace,
    hasSession: sessionStatus === "authenticated" && view !== null && !seedEnabled,
    sessionStatus,
    signIn,
    signUp,
    signOut,
    retrySession,
    guardSession,
    seeded: seedEnabled,
    setView,
    tab,
    setTab,
    busy,
    setBusy,
    message,
    setMessage,
    error,
    actionError,
    setError,
    loading,
    editing,
    setEditing,
    form,
    setForm,
    results,
    setResults,
    semantic,
    setSemantic,
    tradeId,
    setTradeId,
    other,
    setOther,
    left,
    setLeft,
    right,
    setRight,
    ack,
    setAck,
    natural,
    setNatural,
    interpreted,
    setInterpreted,
    profileForm,
    profileDraftRevision,
    resetProfileDraft,
    setProfileForm,
    load,
    run,
    who,
    mine,
    trade,
    offer,
    name,
    edit,
    replaceItemDraft,
    listingDirty,
    hasListingDrafts,
    facts,
    saveItem,
    submitOffer,
    act,
    toggle,
  };
}

const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceState();
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is required.");
  return workspace;
}
