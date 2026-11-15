"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, upload, money, type Item, type Analysis } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { control } from "@/components/workspace/constants";
import { useState } from "react";

export default function InventoryPage() {
  const [acceptedAnalysis, setAcceptedAnalysis] = useState<string | null>(null);
  const {
    view,
    busy,
    setMessage,
    editing,
    setEditing,
    form,
    setForm,
    semantic,
    load,
    run,
    mine,
    edit,
    facts,
    saveItem,
  } = useWorkspace();
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await saveItem(acceptedAnalysis === editing?.analysis?.analysis_id ? acceptedAnalysis : undefined);
                setAcceptedAnalysis(null);
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
              {editing.analysis.estimate_minor != null && (
                <p className="mt-3">
                  Image-assisted estimate: {money(editing.analysis.estimate_minor)} · uncertainty: {editing.analysis.uncertainty}. This is not a market appraisal.
                </p>
              )}
              {editing.analysis.uncertainty_reasons?.map((reason) => <p key={reason} className="mt-2">{reason}</p>)}
              {editing.analysis.attributes.clarification_questions.map(
                (q) => (
                  <p key={q} className="mt-2">
                    {q}
                  </p>
                ),
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {editing.analysis.estimate_minor != null && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setForm({ ...form, value: String(editing.analysis!.estimate_minor! / 100) });
                    setAcceptedAnalysis(editing.analysis!.analysis_id);
                    setMessage("Estimate selected. Save the listing to record your review.");
                  }}>Use this estimate</Button>
                )}
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
