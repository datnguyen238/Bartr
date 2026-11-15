"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, command, type View, type Profile, type Item, type Trade, type Recommendations } from "@/lib/marketplace";
import { seedEnabled } from "@/data/seed";
import { blank } from "./constants";
import { SupersededSession, useWorkspaceSession } from "./session";
import { profileDraft, reconcileProfileDraft, type ProfileDraft, type DraftRevisions } from "./session-profile";

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
  const setTab = (value: string) => router.push(({ inventory: "/profile/inventory", preferences: "/profile/preferences", discover: "/trade", trades: "/trade" } as Record<string, string>)[value] ?? `/${value}`);
  const [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Item | null>(null),
    [form, setForm] = useState(blank),
    [results, setResults] = useState<Recommendations | null>(null),
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
    setEditing(null);
    setForm(blank);
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
    onError: setError,
    onView: (next, resetDrafts) => {
      const previous = savedProfile.current;
      const changedMember = previous?.id !== next.profile.id;
      savedProfile.current = next.profile;
      setView(next);
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
  function edit(item: Item | null) {
    setEditing(item);
    setForm(
      item
        ? {
            title: item.title,
            description: item.description,
            category: item.category,
            condition: item.condition,
            value:
              item.value_minor === null ? "" : String(item.value_minor / 100),
            status: item.status,
          }
        : blank,
    );
  }
  const facts = () => ({
    title: form.title,
    description: form.description,
    category: form.category,
    condition: form.condition,
    value_minor:
      form.value === "" ? null : Math.round(Number(form.value) * 100),
    status: form.status,
  });
  async function saveItem() {
    const generation = session.generation;
    const saved = editing
      ? await api<Item>(`items/${editing.id}`, "PATCH", {
          ...facts(),
          expected_revision: editing.revision,
        })
      : await api<Item>("items", "POST", facts());
    session.assertCurrent(generation);
    edit(saved);
    await load();
    setResults(null);
    setMessage("Listing saved.");
    return saved;
  }
  async function submitOffer(counter = false) {
    if (!view) return;
    if (
      !ack &&
      !window.confirm(
        "Review the exact selected items. Submitting records your consent to this version; it does not reserve items until the other member accepts. Continue?",
      )
    )
      return;
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
    const effects: Record<string, string> = {
      accept:
        "Accept these exact terms? This records mutual agreement and reserves every included item together.",
      handoff:
        "Confirm you report that the physical handoff occurred? Completion requires both members.",
      cancel: trade.handoffs.length
        ? "Request cancellation? After a reported handoff, both members must approve before items are released."
        : "Cancel this agreement and release all reserved items?",
      decline: "Decline the current offer and close the proposal?",
      withdraw: "Withdraw your current offer and close the proposal?",
    };
    if (effects[kind] && !window.confirm(effects[kind])) return;
    await run(async () => {
      await command(`trades/${trade.id}/actions`, {
        kind,
        expected_revision: trade.revision,
        note,
        acknowledged: ack,
      });
      await load();
      setMessage(
        "Action saved. The displayed trade is the current recorded outcome.",
      );
      setAck(false);
    });
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
