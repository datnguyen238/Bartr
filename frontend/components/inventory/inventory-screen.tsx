"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, upload, money, type Analysis, type Item } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { control } from "@/components/workspace/constants";

export function InventoryScreen() {
  const {
    view,
    busy,
    setMessage,
    editing,
    setEditing,
    form,
    setForm,
    load,
    run,
    guardSession,
    mine,
    edit,
    saveItem,
  } = useWorkspace();
  const reviewScope = `${view.profile.id}:${editing?.id ?? ""}`;
  const [savedReview, setSavedReview] = useState<{ scope: string; item: Item | null } | null>(null);
  useEffect(() => { setSavedReview(null); }, [reviewScope]);
  const review = savedReview?.scope === reviewScope ? savedReview : null;
  const latest = review?.item;
  const savedUnavailable = review !== null && (!latest || !["draft", "available"].includes(latest.status));

  async function reviewLatest() {
    if (!editing) return;
    const snapshot = await guardSession(load());
    const item = snapshot.items.find((candidate) => candidate.id === editing.id && candidate.owner === snapshot.profile.id) ?? null;
    setSavedReview({ scope: reviewScope, item });
    setMessage("Latest saved listing loaded. Your unsaved draft is unchanged until you replace it.");
  }

  if (!view) return null;
  return (
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
          {editing && (
            <Button
              variant="outline"
              className="mb-4"
              disabled={busy}
              onClick={() => run(reviewLatest)}
            >
              Review latest saved listing
            </Button>
          )}
          {review && (
            <section className="mb-5 rounded-lg border bg-secondary/50 p-4" aria-labelledby="latest-listing-heading">
              <h3 id="latest-listing-heading" className="font-medium">Latest saved listing</h3>
              {latest ? (
                <>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Title</dt><dd className="min-w-0 break-words">{latest.title || "Untitled draft"}</dd>
                    <dt className="text-muted-foreground">Description</dt><dd className="min-w-0 break-words">{latest.description || "Not set"}</dd>
                    <dt className="text-muted-foreground">Category</dt><dd>{latest.category || "Not set"}</dd>
                    <dt className="text-muted-foreground">Condition</dt><dd>{latest.condition || "Not set"}</dd>
                    <dt className="text-muted-foreground">Value</dt><dd>{money(latest.value_minor)}</dd>
                    <dt className="text-muted-foreground">Status</dt><dd>{latest.status}</dd>
                  </dl>
                  {savedUnavailable ? (
                    <p className="mt-3 text-sm">This listing is no longer editable. Your unsaved draft is retained; choose New item to prepare a separate draft.</p>
                  ) : (
                    <>
                      <p className="mt-3 text-sm text-muted-foreground">Replacing the draft discards its unsaved fields and adopts these saved facts.</p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        disabled={busy}
                        onClick={() => run(async () => {
                          await guardSession(Promise.resolve());
                          edit(latest);
                          setSavedReview(null);
                          setMessage("Draft replaced with the latest saved listing. Review before saving further changes.");
                        })}
                      >
                        Replace draft with saved listing
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm">This listing is no longer available. Your unsaved draft is retained; choose New item to prepare a separate draft.</p>
              )}
            </section>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await guardSession(saveItem());
              });
            }}
          >
            <fieldset disabled={busy || savedUnavailable} className="space-y-4">
              {(["title", "category", "condition"] as const).map(
                (key) => (
                  <label
                    key={key}
                    className="block text-sm capitalize"
                  >
                    {key[0].toUpperCase() + key.slice(1)}
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
              <div className="text-sm">
                <label htmlFor="listing-description">Description</label>
                <Textarea
                  id="listing-description"
                  className={control}
                  value={form.description}
                  maxLength={3000}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
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
                      const item = await guardSession(upload(editing, file));
                      // The photo changes the saved revision, not unsaved form facts.
                      setEditing((current) => current?.id === item.id ? item : current);
                      await guardSession(load());
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
                disabled={busy || savedUnavailable}
                onClick={() =>
                  run(async () => {
                    const analysis = await guardSession(api<Analysis>(
                      `items/${editing.id}/analysis`,
                      "POST",
                      { expected_revision: editing.revision },
                    ));
                    setEditing((current) => current?.id === editing.id ? { ...current, analysis } : current);
                    await guardSession(load());
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
                  disabled={busy || savedUnavailable}
                  onClick={() =>
                    run(async () => {
                      await guardSession(api(
                        `items/${editing.id}/embedding`,
                        "POST",
                        { expected_revision: editing.revision },
                      ));
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
  );
}
