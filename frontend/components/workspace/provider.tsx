"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, api, command, type View, type Item, type Trade, type Recommendations } from "@/lib/marketplace";
import { seedEnabled, createSeedView, createSeedRecommendations } from "@/data/seed";
import { blank } from "./constants";

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
  const tab = pathname.split("/")[1] || "inventory";
  const setTab = (value: string) => router.push(`/${value}`);
  const [view, setView] = useState<View | null>(() => seedEnabled ? createSeedView() : null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!seedEnabled),
    [anonymous, setAnonymous] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null),
    [form, setForm] = useState(blank),
    [results, setResults] = useState<Recommendations | null>(() => seedEnabled ? createSeedRecommendations() : null),
    [semantic, setSemantic] = useState(true);
  const [tradeId, setTradeId] = useState(seedEnabled ? "seed-open-trade" : ""),
    [other, setOther] = useState(""),
    [left, setLeft] = useState<string[]>([]),
    [right, setRight] = useState<string[]>([]),
    [ack, setAck] = useState(false),
    [natural, setNatural] = useState(""),
    [interpreted, setInterpreted] = useState<string[] | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: seedEnabled ? createSeedView().profile.name : "",
    community: seedEnabled ? createSeedView().profile.community : "",
    interests: seedEnabled ? createSeedView().profile.interests.join(", ") : "",
    exclusions: seedEnabled ? createSeedView().profile.exclusions.join(", ") : "",
    gap_limit: 20,
  });
  async function load() {
    const v = seedEnabled ? createSeedView() : await api<View>("me");
    setView(v);
    setAnonymous(false);
    setError("");
    setProfileForm({
      name: v.profile.name,
      community: v.profile.community,
      interests: v.profile.interests.join(", "),
      exclusions: v.profile.exclusions.join(", "),
      gap_limit: v.profile.gap_limit,
    });
    return v;
  }
  useEffect(() => {
    if (seedEnabled) {
      setLoading(false);
      return;
    }
    let active = true;
    load()
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setAnonymous(true);
          setView(null);
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Bartr could not load your saved data. Check the backend and try again.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Initial session discovery only; subsequent refreshes call load() explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function run(action: () => Promise<void>) {
    if (seedEnabled) {
      setMessage("Frontend seed data only. Backend actions are disabled and no changes are saved.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Action failed. Reload to check the saved outcome.",
      );
    } finally {
      setBusy(false);
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
  async function saveItem(analysisId?: string) {
    const saved = editing
      ? await api<Item>(`items/${editing.id}`, "PATCH", {
          ...facts(),
          expected_revision: editing.revision,
          ...(analysisId ? { analysis_id: analysisId } : {}),
        })
      : await api<Item>("items", "POST", facts());
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
    hasSession: view !== null && !seedEnabled,
    anonymous,
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
