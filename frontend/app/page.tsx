"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TermsView } from "@/components/terms-view";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  api,
  upload,
  command,
  ApiError,
  money,
  list,
  type View,
  type Item,
  type Trade,
  type Recommendations,
  type Analysis,
} from "@/lib/marketplace";

const control =
  "mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const closed = [
  "completed",
  "declined",
  "withdrawn",
  "invalidated",
  "cancelled",
];
const blank = {
  title: "",
  description: "",
  category: "",
  condition: "",
  value: "",
  status: "draft",
};

export default function Home() {
  const [view, setView] = useState<View | null>(null),
    [tab, setTab] = useState("inventory"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [register, setRegister] = useState(false),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<Item | null>(null),
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
  const [profileForm, setProfileForm] = useState({
    name: "",
    community: "",
    interests: "",
    exclusions: "",
    gap_limit: 20,
  });
  async function load() {
    const v = await api<View>("me");
    setView(v);
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
    load()
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  async function run(action: () => Promise<void>) {
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
  async function saveItem() {
    const saved = editing
      ? await api<Item>(`items/${editing.id}`, "PATCH", {
          ...facts(),
          expected_revision: editing.revision,
        })
      : await api<Item>("items", "POST", facts());
    edit(saved);
    await load();
    setResults(null);
    setMessage("Listing saved.");
    return saved;
  }
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      await api(
        "auth/" + (register ? "register" : "login"),
        "POST",
        Object.fromEntries(data),
      );
      await load();
      setMessage("Signed in.");
    });
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
  if (loading)
    return (
      <main className="p-10" role="status">
        Loading Bartr…
      </main>
    );
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a className="text-2xl font-semibold tracking-tight" href="/">
            bartr.
          </a>
          {view && (
            <div className="flex items-center gap-3 text-sm">
              <span>
                {view.profile.name} · {view.profile.community}
              </span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", "POST", {});
                    setView(null);
                    setResults(null);
                    setMessage("Signed out.");
                  })
                }
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="py-10">
          <p className="mb-3 text-sm text-muted-foreground">
            Less unused. More possibility.
          </p>
          <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">
            What you have.
            <br />
            <span className="font-serif italic">What comes next.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
            Discover combinations worth trading. Your items, your preferences,
            your decision.
          </p>
        </div>
        <div aria-live="polite" role="status">
          {busy && (
            <p className="mb-4 text-sm">
              Working… Your saved data stays in place.
            </p>
          )}
          {message && (
            <p className="mb-5 rounded-lg bg-secondary p-4 text-sm">
              {message}
            </p>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {view?.storage === "temporary-memory" && (
          <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">
            Temporary memory storage is explicitly enabled. Accounts and
            listings are real within this local session, but disappear when the
            backend restarts. Configure MongoDB Atlas for saved data.
          </p>
        )}
        {!view ? (
          <Card className="mx-auto max-w-md shadow-none">
            <CardHeader>
              <CardTitle>
                {register ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                A username, password and trading community are all you need.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={auth}>
                <fieldset disabled={busy} className="space-y-4">
                  <label className="block text-sm">
                    Username
                    <Input
                      className={control}
                      name="username"
                      required
                      minLength={3}
                      maxLength={40}
                      autoComplete="username"
                      pattern="[a-zA-Z0-9_.-]+"
                    />
                  </label>
                  <label className="block text-sm">
                    Password
                    <Input
                      className={control}
                      name="password"
                      type="password"
                      required
                      minLength={register ? 10 : 1}
                      maxLength={200}
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                    />
                  </label>
                  {register && (
                    <>
                      <label className="block text-sm">
                        Display name
                        <Input
                          className={control}
                          name="name"
                          required
                          maxLength={200}
                        />
                      </label>
                      <label className="block text-sm">
                        Campus or city community
                        <Input
                          className={control}
                          name="community"
                          required
                          maxLength={200}
                          placeholder="e.g. ASU Tempe"
                        />
                      </label>
                    </>
                  )}
                  <Button type="submit" className="w-full">
                    {register ? "Create account" : "Sign in"}
                  </Button>
                </fieldset>
              </form>
              <Button
                className="mt-3 w-full"
                variant="ghost"
                disabled={busy}
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Already have an account? Sign in"
                  : "New here? Create account"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <nav
              className="mb-7 flex flex-wrap gap-2 border-b pb-4"
              aria-label="Workspace"
            >
              {["inventory", "discover", "trades", "preferences"].map((t) => (
                <Button
                  key={t}
                  variant={tab === t ? "default" : "ghost"}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => setTab(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </Button>
              ))}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await load();
                    setMessage("Loaded the latest saved state.");
                  })
                }
              >
                Reload saved state
              </Button>
            </nav>
            {tab === "inventory" && (
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Your inventory</CardTitle>
                    <CardDescription>
                      Drafts are private. Publish complete listings to discover
                      exchanges.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      onClick={() => edit(null)}
                      disabled={busy}
                    >
                      + New item
                    </Button>
                    <div className="mt-5 space-y-3">
                      {mine.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          {item.image_id && (
                            <img
                              src={`/api/images/${item.image_id}`}
                              alt={item.title || "Draft item"}
                              className="size-16 rounded-md object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {item.title || "Untitled draft"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.status} · {money(item.value_minor)} ·{" "}
                              {item.value_source}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.value_set_at
                                ? new Date(item.value_set_at).toLocaleString()
                                : "Value not set"}
                            </p>
                          </div>
                          {["draft", "available"].includes(item.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => edit(item)}
                              disabled={busy}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      ))}
                      {!mine.length && (
                        <p className="text-sm text-muted-foreground">
                          Start with something you no longer need.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>
                      {editing ? "Edit listing" : "Create a draft"}
                    </CardTitle>
                    <CardDescription>
                      Owner-entered facts stay separate from AI suggestions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          await saveItem();
                        });
                      }}
                    >
                      <fieldset disabled={busy} className="space-y-4">
                        {(["title", "category", "condition"] as const).map(
                          (key) => (
                            <label
                              key={key}
                              className="block text-sm capitalize"
                            >
                              {key}
                              <Input
                                className={control}
                                value={form[key]}
                                maxLength={
                                  key === "title"
                                    ? 150
                                    : key === "category"
                                      ? 100
                                      : 300
                                }
                                onChange={(e) =>
                                  setForm({ ...form, [key]: e.target.value })
                                }
                              />
                            </label>
                          ),
                        )}
                        <label className="block text-sm">
                          Description
                          <Textarea
                            className={control}
                            value={form.description}
                            maxLength={3000}
                            onChange={(e) =>
                              setForm({ ...form, description: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Comparison value (USD, optional)
                          <Input
                            className={control}
                            type="number"
                            min="0.01"
                            step="0.01"
                            max="1000000"
                            value={form.value}
                            onChange={(e) =>
                              setForm({ ...form, value: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Listing state
                          <select
                            className={control}
                            value={form.status}
                            onChange={(e) =>
                              setForm({ ...form, status: e.target.value })
                            }
                          >
                            <option value="draft">Private draft</option>
                            <option value="available">
                              Publish as available
                            </option>
                            <option value="removed">Remove from trading</option>
                          </select>
                        </label>
                        <Button type="submit">Save listing</Button>
                        <label className="block text-sm">
                          Item photo
                          <Input
                            className={control}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.heic,.heif"
                            disabled={!editing || busy}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file || !editing) return;
                              run(async () => {
                                const item = await upload(editing, file);
                                edit(item);
                                await load();
                                setMessage(
                                  "Photo normalized and saved. Review before publishing.",
                                );
                              });
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Save a draft first, then upload a phone photo. JPEG,
                          PNG, WebP and HEIC supported.
                        </p>
                      </fieldset>
                    </form>
                    {editing && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const analysis = await api<Analysis>(
                                `items/${editing.id}/analysis`,
                                "POST",
                                { expected_revision: editing.revision },
                              );
                              setEditing({ ...editing, analysis });
                              await load();
                              setMessage(
                                "AI suggestions are ready for review; your listing was not changed.",
                              );
                            })
                          }
                        >
                          Analyze photo & value
                        </Button>
                        {editing.status === "available" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api(
                                  `items/${editing.id}/embedding`,
                                  "POST",
                                  { expected_revision: editing.revision },
                                );
                                setMessage(
                                  "Current listing indexed with Bedrock embeddings.",
                                );
                              })
                            }
                          >
                            Index for semantic search
                          </Button>
                        )}
                      </div>
                    )}
                    {editing?.analysis && (
                      <div className="mt-5 rounded-lg bg-secondary p-4 text-sm">
                        <h3 className="font-medium">
                          AI suggestion — review before using
                        </h3>
                        <p className="mt-2">
                          {editing.analysis.attributes.description}
                        </p>
                        {editing.analysis.range && (
                          <p className="mt-3">
                            Indicative range:{" "}
                            {money(editing.analysis.range.low_minor)}–
                            {money(editing.analysis.range.high_minor)}. Enter
                            your reviewed comparison value above.
                          </p>
                        )}
                        {editing.analysis.attributes.clarification_questions.map(
                          (q) => (
                            <p key={q} className="mt-2">
                              {q}
                            </p>
                          ),
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setForm({
                                ...form,
                                description:
                                  editing.analysis!.attributes.description,
                              })
                            }
                          >
                            Use suggested description
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing({ ...editing, analysis: null })
                            }
                          >
                            Ignore suggestion
                          </Button>
                        </div>
                        {editing.analysis.evidence?.map((e) => (
                          <a
                            key={e.uri}
                            className="mt-2 block underline"
                            href={e.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {e.title} · {money(e.price_minor)}
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            {tab === "preferences" && (
              <Card className="max-w-2xl shadow-none">
                <CardHeader>
                  <CardTitle>Your profile & preferences</CardTitle>
                  <CardDescription>
                    Private preferences guide recommendations. Display name and
                    community are public.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        await api("profile", "PATCH", {
                          ...profileForm,
                          interests: list(profileForm.interests),
                          exclusions: list(profileForm.exclusions),
                          expected_revision: view.profile.revision,
                        });
                        await load();
                        setResults(null);
                        setMessage("Profile and preferences saved.");
                      });
                    }}
                  >
                    <fieldset disabled={busy} className="space-y-4">
                      {(
                        [
                          "name",
                          "community",
                          "interests",
                          "exclusions",
                        ] as const
                      ).map((key) => (
                        <label key={key} className="block text-sm capitalize">
                          {key}
                          {["interests", "exclusions"].includes(key)
                            ? " (comma-separated)"
                            : ""}
                          <Input
                            className={control}
                            value={profileForm[key]}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                      <label className="block text-sm">
                        Maximum recommendation gap (%)
                        <Input
                          className={control}
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={profileForm.gap_limit}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              gap_limit: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Gap = absolute value difference ÷ the larger bundle
                        total. Both participants’ limits apply. You may
                        voluntarily accept a manual offer beyond your
                        recommendation limit.
                      </p>
                      <Button type="submit">Save preferences</Button>
                    </fieldset>
                  </form>
                  <div className="mt-7 border-t pt-5">
                    <label className="block text-sm">
                      Describe what you’re looking for
                      <Textarea
                        className={control}
                        value={natural}
                        onChange={(e) => setNatural(e.target.value)}
                      />
                    </label>
                    <Button
                      variant="outline"
                      className="mt-3"
                      disabled={busy || !natural.trim()}
                      onClick={() =>
                        run(async () => {
                          const data = await api<{
                            interests: string[];
                            summary: string;
                          }>("preferences/interpret", "POST", {
                            text: natural,
                          });
                          setInterpreted(data.interests);
                          setMessage(
                            data.summary +
                              " Review the suggested interests before saving.",
                          );
                        })
                      }
                    >
                      Interpret with Gemini
                    </Button>
                    {interpreted && (
                      <div className="mt-3 rounded-lg bg-secondary p-4 text-sm">
                        <p>{interpreted.join(", ")}</p>
                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setProfileForm({
                              ...profileForm,
                              interests: interpreted.join(", "),
                            });
                            setInterpreted(null);
                          }}
                        >
                          Use these interests in the form
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {tab === "discover" && (
              <section>
                <div className="mb-6 flex flex-wrap items-end gap-5">
                  <label className="text-sm">
                    <input
                      type="checkbox"
                      checked={semantic}
                      onChange={(e) => setSemantic(e.target.checked)}
                      className="mr-2"
                    />
                    Semantic discovery (Bedrock + Atlas + Gemini)
                  </label>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setResults(
                          await api<Recommendations>(
                            `recommendations?semantic=${semantic}`,
                          ),
                        );
                      })
                    }
                  >
                    Discover bundles
                  </Button>
                </div>
                {!semantic && (
                  <p className="mb-5 text-sm text-muted-foreground">
                    Exact-text local testing is selected. Equivalent wording
                    requires configured semantic services.
                  </p>
                )}
                {results && (
                  <p role="status" className="mb-5 text-sm">
                    {results.recommendations.length} suggestions ·{" "}
                    {results.retrieval}
                    {results.reason === "MISSING_VALUATION"
                      ? " · Relevant items need comparison values before automatic recommendations."
                      : ""}
                  </p>
                )}
                <div className="grid gap-5 lg:grid-cols-2">
                  {results?.recommendations.map((rec) => (
                    <Card key={rec.id} className="shadow-none">
                      <CardHeader>
                        <CardDescription>
                          Trade with {rec.member.name}
                        </CardDescription>
                        <CardTitle>
                          {rec.terms.left.length} for {rec.terms.right.length}{" "}
                          items
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TermsView terms={rec.terms} who={who!} />
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                          {rec.explanation}
                        </p>
                        <div className="mt-5 flex gap-2">
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setOther(rec.member.id);
                              setLeft(rec.terms.left.map((x) => x.id));
                              setRight(rec.terms.right.map((x) => x.id));
                              setTab("trades");
                              setTradeId("");
                            }}
                          >
                            Review proposal
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api("recommendations/dismiss", "POST", {
                                  id: rec.id,
                                });
                                setResults({
                                  ...results,
                                  recommendations:
                                    results.recommendations.filter(
                                      (x) => x.id !== rec.id,
                                    ),
                                });
                              })
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {results && !results.recommendations.length && (
                  <p className="rounded-lg border bg-card p-6 text-sm">
                    No qualifying exchange found. Review your interests and
                    available values, or compose a manual offer.
                  </p>
                )}
              </section>
            )}
            {tab === "trades" && (
              <div className="grid items-start gap-6 lg:grid-cols-[.65fr_1.35fr]">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Your trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTradeId("");
                        setLeft([]);
                        setRight([]);
                      }}
                    >
                      Compose a new offer
                    </Button>
                    <div className="mt-4 space-y-3">
                      {view.trades.map((t) => (
                        <button
                          className={`block w-full rounded-lg border p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${t.id === tradeId ? "bg-secondary" : "bg-background"}`}
                          key={t.id}
                          onClick={() => {
                            setTradeId(t.id);
                            setAck(false);
                          }}
                        >
                          <strong>
                            {name(t.participants.find((x) => x !== who)!)}
                          </strong>
                          <span className="mt-1 block text-muted-foreground">
                            {t.status.replaceAll("_", " ")} · offer{" "}
                            {t.offers.at(-1)?.version}
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-6">
                  {trade && offer && (
                    <Card className="shadow-none">
                      <CardHeader>
                        <CardDescription>
                          Current offer {offer.version} ·{" "}
                          {trade.status.replaceAll("_", " ")}
                        </CardDescription>
                        <CardTitle>
                          Exchange with{" "}
                          {name(trade.participants.find((x) => x !== who)!)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TermsView terms={offer.terms} who={who!} />
                        {trade.reason && (
                          <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">
                            {trade.reason}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">
                          Consented: {offer.consents.map(name).join(", ")}.
                          Handoff confirmations: {trade.handoffs.length}/2.
                        </p>
                        {!closed.includes(trade.status) && (
                          <>
                            <label className="mt-4 block text-sm">
                              <input
                                type="checkbox"
                                checked={ack}
                                onChange={(e) => setAck(e.target.checked)}
                                className="mr-2"
                              />
                              I reviewed all items and any unknown values or
                              value imbalance.
                            </label>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {trade.status === "open" && (
                                <>
                                  {offer.sender !== who ? (
                                    <Button
                                      disabled={busy || !ack}
                                      onClick={() => act("accept")}
                                    >
                                      Accept exact terms
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      act(
                                        offer.sender === who
                                          ? "withdraw"
                                          : "decline",
                                      )
                                    }
                                  >
                                    {offer.sender === who
                                      ? "Withdraw offer"
                                      : "Decline offer"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                      const terms = offer.terms;
                                      setOther(
                                        trade.participants.find(
                                          (x) => x !== who,
                                        )!,
                                      );
                                      setLeft(
                                        (terms.left_owner === who
                                          ? terms.left
                                          : terms.right
                                        ).map((x) => x.id),
                                      );
                                      setRight(
                                        (terms.left_owner === who
                                          ? terms.right
                                          : terms.left
                                        ).map((x) => x.id),
                                      );
                                    }}
                                  >
                                    Prepare counteroffer
                                  </Button>
                                </>
                              )}
                              {["agreed", "awaiting_handoff"].includes(
                                trade.status,
                              ) && (
                                <>
                                  <Button
                                    disabled={
                                      busy || trade.handoffs.includes(who!)
                                    }
                                    onClick={() => act("handoff")}
                                  >
                                    Confirm reported handoff
                                  </Button>
                                  <Button
                                    variant="outline"
                                    disabled={
                                      busy || trade.cancellations.includes(who!)
                                    }
                                    onClick={() => act("cancel")}
                                  >
                                    Request cancellation
                                  </Button>
                                </>
                              )}
                            </div>
                            <form
                              className="mt-6"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const f = e.currentTarget;
                                const note = String(
                                  new FormData(f).get("note") || "",
                                );
                                if (note.trim()) act("note", note);
                              }}
                            >
                              <label className="block text-sm">
                                Private trade note
                                <Textarea
                                  className={control}
                                  name="note"
                                  required
                                  maxLength={3000}
                                />
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                disabled={busy}
                              >
                                Send note
                              </Button>
                            </form>
                          </>
                        )}
                        <div className="mt-5 border-t pt-4">
                          <h3 className="text-sm font-medium">
                            Private history
                          </h3>
                          {trade.offers.map((o) => (
                            <p
                              key={o.version}
                              className="mt-2 text-xs text-muted-foreground"
                            >
                              Offer {o.version} by {name(o.sender)} —{" "}
                              {o.version === offer.version
                                ? "current"
                                : "superseded"}{" "}
                              · {o.terms.left.map((x) => x.title).join(" + ")}{" "}
                              ↔ {o.terms.right.map((x) => x.title).join(" + ")}
                            </p>
                          ))}
                          {trade.notes.map((n, i) => (
                            <p
                              key={i}
                              className="mt-3 rounded-md bg-secondary/60 p-3 text-sm"
                            >
                              <strong>{name(n.sender)}:</strong> {n.text}
                            </p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {(!trade || trade.status === "open") && (
                    <Card className="shadow-none">
                      <CardHeader>
                        <CardTitle>
                          {trade ? "Counteroffer composer" : "Compose an offer"}
                        </CardTitle>
                        <CardDescription>
                          One to three available items per side. Open offers
                          reserve nothing.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <label className="block text-sm">
                          Trade with
                          <select
                            className={control}
                            value={other}
                            disabled={!!trade || busy}
                            onChange={(e) => {
                              setOther(e.target.value);
                              setRight([]);
                            }}
                          >
                            <option value="">Select a member</option>
                            {view.members
                              .filter((x) => x.id !== who)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name} · {x.community}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                          {[
                            [
                              "left",
                              "You offer",
                              mine.filter((x) => x.status === "available"),
                            ],
                            [
                              "right",
                              "You receive",
                              view.items.filter(
                                (x) =>
                                  x.owner === other && x.status === "available",
                              ),
                            ],
                          ].map(([side, label, items]) => (
                            <fieldset key={String(side)} disabled={busy}>
                              <legend className="mb-3 text-sm font-medium">
                                {String(label)}
                              </legend>
                              {(items as Item[]).map((item) => (
                                <label
                                  key={item.id}
                                  className="mb-3 flex gap-2 rounded-md border p-3 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={(side === "left"
                                      ? left
                                      : right
                                    ).includes(item.id)}
                                    onChange={() =>
                                      toggle(side as "left" | "right", item.id)
                                    }
                                  />
                                  <span>
                                    {item.title}
                                    <span className="block text-xs text-muted-foreground">
                                      {money(item.value_minor)} ·{" "}
                                      {item.condition}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </fieldset>
                          ))}
                        </div>
                        <label className="mt-4 block text-sm">
                          <input
                            className="mr-2"
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                          />
                          I reviewed the selected items, comparison values, and
                          any unknown value or imbalance. No cash is required.
                        </label>
                        <Button
                          className="mt-4"
                          disabled={
                            busy ||
                            !other ||
                            !left.length ||
                            !right.length ||
                            !ack
                          }
                          onClick={() => submitOffer(!!trade)}
                        >
                          {trade
                            ? "Submit counteroffer"
                            : "Submit reviewed offer"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
