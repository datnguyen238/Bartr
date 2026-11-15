"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, upload, money, ApiError, type Analysis, type Item } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

const statusNames: Record<Item["status"], string> = {
  draft: "Private draft", available: "Available", reserved: "Reserved for a trade", exchanged: "Exchanged", removed: "Removed",
};
type Filter = "all" | "available" | "draft" | "unavailable";

function PhotoIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="m3 16 5-5 5 5 3-3 5 5M9 5l1-2h4l1 2" /><circle cx="16.5" cy="9.5" r="1" /></svg>;
}

export function InventoryScreen() {
  const {
    view, busy, seeded, setMessage, editing, setEditing, form, setForm, load, run,
    guardSession, mine, edit, replaceItemDraft, listingDirty, saveItem,
  } = useWorkspace();
  const [editorOpen, setEditorOpen] = useState(Boolean(editing) || mine.length === 0);
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState<ApiError | Error | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const inventoryHeading = useRef<HTMLHeadingElement>(null);
  const listingForm = useRef<HTMLFormElement>(null);
  const reviewScope = `${view.profile.id}:${editing?.id ?? ""}`;
  const [savedReview, setSavedReview] = useState<{ scope: string; item: Item | null } | null>(null);
  useEffect(() => { setSavedReview(null); setRemoveRequested(false); setFailure(null); }, [reviewScope]);
  useEffect(() => {
    if (focusRequest) {
      editorHeading.current?.focus();
      editorHeading.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    }
  }, [focusRequest]);
  const review = savedReview?.scope === reviewScope ? savedReview : null;
  const latest = review?.item;
  const savedUnavailable = review !== null && (!latest || !["draft", "available"].includes(latest.status));
  const currentItem = editing ? mine.find((item) => item.id === editing.id) : undefined;
  const currentUnavailable = Boolean(editing && (!currentItem || !["draft", "available"].includes(currentItem.status)));
  const editable = !editing || (["draft", "available"].includes(editing.status) && !currentUnavailable);
  const disabled = busy || seeded || savedUnavailable || !editable;
  const fields = failure instanceof ApiError ? failure.fields.map((entry) => ({ ...entry, field: entry.field.split(".").at(-1) ?? entry.field })) : [];
  const fieldError = (name: string) => fields.find((entry) => entry.field === name)?.message;
  const fieldLabels: Record<string, string> = { title: "Title", description: "Description", category: "Category", condition: "Condition", value: "Comparison value", value_minor: "Comparison value", image_id: "Photo", image: "Photo", file: "Photo" };
  const readiness = [
    { name: "Photo", complete: Boolean(editing?.image_id) },
    { name: "Title", complete: Boolean(form.title.trim()) },
    { name: "Description", complete: Boolean(form.description.trim()) },
    { name: "Category", complete: Boolean(form.category.trim()) },
    { name: "Condition", complete: Boolean(form.condition.trim()) },
  ];
  const complete = readiness.every((entry) => entry.complete);
  const visibleItems = mine.filter((item) => filter === "all" || (filter === "unavailable" ? !["draft", "available"].includes(item.status) : item.status === filter));

  function openEditor(item: Item | null) {
    edit(item);
    setEditorOpen(true);
    setFeedback("");
    setFailure(null);
    setFocusRequest((value) => value + 1);
  }
  function showInventory() {
    setEditorOpen(false);
    inventoryHeading.current?.focus();
    inventoryHeading.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }
  async function perform(action: () => Promise<void>) {
    setFailure(null);
    setFeedback("");
    await run(async () => {
      try { await action(); }
      catch (error) {
        if (error instanceof Error && error.name !== "SupersededSession" && !error.message.includes("earlier session")) setFailure(error);
        throw error;
      }
    });
  }
  function announce(message: string) { setFeedback(message); setMessage(message); }
  async function reviewLatest() {
    if (!editing) return;
    const snapshot = await guardSession(load());
    const item = snapshot.items.find((candidate) => candidate.id === editing.id && candidate.owner === snapshot.profile.id) ?? null;
    setSavedReview({ scope: reviewScope, item });
    announce("Latest saved listing loaded. Your unsaved draft is unchanged until you replace it.");
  }
  async function attachPhoto(file: File) {
    await perform(async () => {
      const target = editing ?? await guardSession(saveItem({ status: "draft" }));
      const attached = await guardSession(upload(target, file));
      setEditing((current) => current?.id === attached.id ? attached : current);
      await guardSession(load());
      announce("Photo saved. Review your details before publishing.");
    });
  }
  async function save(status: Item["status"]) {
    await perform(async () => {
      await guardSession(saveItem({ status }));
      announce(status === "available" ? "Listing published. It is available for trading." : status === "removed" ? "Listing removed from trading." : "Private draft saved. You can finish it later.");
      setRemoveRequested(false);
    });
  }

  return <section className="space-y-7">
    <div className="screen-heading flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="screen-title" ref={inventoryHeading} tabIndex={-1}>Your inventory</h1>
        <p className="screen-description">Give the things you no longer need a next chapter.</p>
      </div>
      <Button disabled={busy || seeded} onClick={() => openEditor(null)}>New item</Button>
    </div>
    <div className="inventory-workspace grid items-start gap-6 lg:grid-cols-[minmax(260px,.85fr)_minmax(0,1.15fr)]" data-editor-open={editorOpen}>
      <section className={`inventory-list-pane surface-panel min-w-0 ${editorOpen ? "hidden lg:block" : "block"}`} aria-label="Inventory items">
        <div className="inventory-toolbar flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <h2 className="text-lg font-semibold">Your items <span className="ml-1 font-normal text-muted-foreground">{mine.length}</span></h2>
          <p className="text-sm text-muted-foreground">Drafts stay private</p>
        </div>
        <div className="inventory-filters flex flex-wrap gap-1 border-b px-3 py-2" aria-label="Filter inventory">
          {([["all", "All"], ["available", "Available"], ["draft", "Drafts"], ["unavailable", "Past trades"]] as const).map(([value, label]) => <Button key={value} type="button" variant={filter === value ? "secondary" : "ghost"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}
        </div>
        <ul className="divide-y">
          {visibleItems.map((item) => <li key={item.id} className="inventory-row flex items-center gap-4 p-5" data-selected={editing?.id === item.id}>
            <div className="inventory-thumb flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-muted-foreground">
              {item.image_id ? <img src={`/api/images/${item.image_id}`} alt={item.title || "Draft item"} className="h-full w-full object-cover" /> : <PhotoIcon />}
            </div>
            <div className="inventory-row-copy min-w-0 flex-1">
              <h3 className="break-words text-base font-medium">{item.title || "Untitled draft"}</h3>
              <p className="inventory-status mt-1 text-sm text-muted-foreground">{statusNames[item.status]}</p>
              <p className="mt-1 text-sm">{item.value_minor === null ? "Value not set" : `${money(item.value_minor)} estimated`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.value_source === "owner" ? "Value entered by you" : item.value_minor === null ? "You can add a value later" : "AI-assisted estimate"}{item.value_set_at ? ` · ${new Date(item.value_set_at).toLocaleDateString()}` : ""}</p>
              {item.uncertainty && <p className="mt-1 text-xs text-muted-foreground">Estimate note: {item.uncertainty}</p>}
            </div>
            {["draft", "available"].includes(item.status) && <Button variant="outline" aria-label={`Edit ${item.title || "untitled draft"}`} onClick={() => openEditor(item)} disabled={busy || seeded}>Edit</Button>}
          </li>)}
        </ul>
        {!visibleItems.length && <div className="inventory-empty space-y-3 px-6 py-12 text-center">
          <h3 className="text-lg font-medium">{mine.length ? "No items here yet" : "Start with one thing"}</h3>
          <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">{mine.length ? "Choose another filter to see your other items." : "A chair, a calculator, something you’re ready to pass on. Add a photo or start with the details."}</p>
          {!mine.length && <Button variant="outline" disabled={busy || seeded} onClick={() => openEditor(null)}>Add your first item</Button>}
        </div>}
      </section>
      <section className={`inventory-editor-pane surface-panel min-w-0 ${editorOpen ? "block" : "hidden lg:block"}`} aria-labelledby="listing-editor-heading">
        <div className="border-b p-5 sm:p-6">
          <Button type="button" variant="ghost" className="mb-3 lg:hidden" onClick={showInventory}>Back to inventory</Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="listing-editor-heading" ref={editorHeading} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight">{editing ? editing.title || "Untitled draft" : "Add an item"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{listingDirty ? "Unsaved changes · kept while you move between items" : editing ? statusNames[currentItem?.status ?? editing.status] : "Start with a photo or fill in the details."}</p>
            </div>
          </div>
        </div>
        <div className="space-y-7 p-5 sm:p-6">
          {currentUnavailable && <div className="inline-feedback space-y-3 rounded-xl bg-secondary p-4" role="status">
            <p className="text-sm leading-6">{currentItem ? `Current status: ${statusNames[currentItem.status]}. This item can’t be changed while it is unavailable for new trades.` : "This listing isn’t in your current saved inventory. Check its saved status before making more changes."} Your unsaved details are kept. You can also choose New item to prepare something else.</p>
            <Button type="button" variant="outline" disabled={busy || seeded} onClick={() => void perform(reviewLatest)}>Check saved listing</Button>
          </div>}
          <div className="inventory-photo space-y-3">
            <label htmlFor="listing-photo" className="block font-medium">Item photo</label>
            {editing?.image_id && <img src={`/api/images/${editing.image_id}`} alt={editing.title || "Your item"} className="max-h-56 w-full rounded-xl object-contain bg-secondary" />}
            <Input id="listing-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.heic,.heif" disabled={disabled} aria-describedby="listing-photo-help" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attachPhoto(file);
              event.target.value = "";
            }} />
            <p id="listing-photo-help" className="text-sm leading-6 text-muted-foreground">A clear photo helps others see what you’re offering. JPEG, PNG, WebP and HEIC supported. A new item stays private until you publish it.</p>
            {fieldError("image_id") && <p className="text-sm text-destructive">{fieldError("image_id")}</p>}
          </div>
          <form ref={listingForm} onSubmit={(event) => { event.preventDefault(); void save(editing?.status === "available" ? "available" : "draft"); }} className="space-y-6">
            <fieldset disabled={disabled} className="space-y-5">
              <legend className="mb-4 text-lg font-semibold">Item details</legend>
              {(["title", "category", "condition"] as const).map((key) => <div className="field-group" key={key}>
                <label htmlFor={`listing-${key}`} className="mb-2 block text-sm font-medium">{key[0].toUpperCase() + key.slice(1)}</label>
                <Input id={`listing-${key}`} value={form[key]} maxLength={key === "title" ? 150 : key === "category" ? 100 : 300} placeholder={key === "title" ? "For example, wooden study chair" : key === "category" ? "For example, furniture" : "For example, good with light wear"} aria-invalid={Boolean(fieldError(key))} aria-describedby={fieldError(key) ? `listing-${key}-error` : undefined} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                {fieldError(key) && <p id={`listing-${key}-error`} className="mt-2 text-sm text-destructive">{fieldError(key)}</p>}
              </div>)}
              <div className="field-group">
                <label htmlFor="listing-description" className="mb-2 block text-sm font-medium">Description</label>
                <Textarea id="listing-description" value={form.description} maxLength={3000} placeholder="What should the next owner know?" aria-invalid={Boolean(fieldError("description"))} aria-describedby={fieldError("description") ? "listing-description-error" : undefined} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                {fieldError("description") && <p id="listing-description-error" className="mt-2 text-sm text-destructive">{fieldError("description")}</p>}
              </div>
              <div className="field-group">
                <label htmlFor="listing-value" className="mb-2 block text-sm font-medium">Comparison value (USD, optional)</label>
                <Input id="listing-value" type="number" inputMode="decimal" min="0.01" step="0.01" max="1000000" value={form.value} aria-invalid={Boolean(fieldError("value") || fieldError("value_minor"))} aria-describedby={`listing-value-help${fieldError("value") || fieldError("value_minor") ? " listing-value-error" : ""}`} onChange={(event) => setForm({ ...form, value: event.target.value })} />
                <p id="listing-value-help" className="mt-2 text-sm leading-6 text-muted-foreground">An estimate for comparing bundles, never a payment. Leave it blank if you’re unsure.</p>
                {editing?.uncertainty && <p className="mt-2 text-sm text-muted-foreground">Estimate note: {editing.uncertainty}</p>}
                {(fieldError("value") || fieldError("value_minor")) && <p id="listing-value-error" className="mt-2 text-sm text-destructive">{fieldError("value") || fieldError("value_minor")}</p>}
              </div>
              <div className="inventory-readiness border-t pt-5">
                <h3 className="font-medium">Ready to publish</h3>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {readiness.map((entry) => <li key={entry.name} className={entry.complete ? "text-foreground" : "text-muted-foreground"}>{entry.name}: {entry.complete ? "added" : "needed"}</li>)}
                </ul>
                {!complete && <p id="listing-readiness-help" className="mt-3 text-sm leading-6 text-muted-foreground">Add a photo and complete the item details to publish. You can save a private draft at any time.</p>}
              </div>
              <div className="inventory-editor-actions form-actions flex flex-wrap gap-3">
                <Button type="submit" variant={editing?.status === "available" ? "default" : "outline"}>{busy ? "Saving…" : editing?.status === "available" ? "Save changes" : "Save draft"}</Button>
                {editing?.status !== "available" && <Button type="button" disabled={!complete || disabled} aria-describedby={!complete ? "listing-readiness-help" : undefined} onClick={() => { if (listingForm.current?.reportValidity()) void save("available"); }}>Publish listing</Button>}
              </div>
            </fieldset>
          </form>
          <div className="inventory-feedback" aria-live="polite">
            {feedback && <p role="status" className="inline-feedback rounded-xl bg-secondary p-4 text-sm leading-6">{feedback}</p>}
            {failure && <div role="alert" className="inline-feedback rounded-xl border border-destructive/30 p-4 text-sm leading-6 text-destructive">
              <p>{fields.length ? "Review the highlighted item details." : failure.message}</p>
              {fields.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{fields.map((entry, index) => <li key={`${entry.field}-${index}`}>{fieldLabels[entry.field] ?? "Item detail"}: {entry.message}</li>)}</ul>}
            </div>}
          </div>
          {editing && <details className="border-t pt-5" open={Boolean(review)}>
            <summary className="cursor-pointer py-2 font-medium">Saved version and listing options</summary>
            <div className="mt-4 space-y-4">
              <Button variant="outline" disabled={busy || seeded} onClick={() => void perform(reviewLatest)}>Review latest saved listing</Button>
              {review && <section aria-labelledby="latest-listing-heading" className="space-y-3 border-t pt-4">
                <h3 id="latest-listing-heading" className="font-medium">Latest saved listing</h3>
                {latest ? <>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    <dt>Title</dt><dd className="break-words">{latest.title || "Untitled draft"}</dd>
                    <dt>Description</dt><dd className="break-words">{latest.description || "Not set"}</dd>
                    <dt>Category</dt><dd>{latest.category || "Not set"}</dd>
                    <dt>Condition</dt><dd>{latest.condition || "Not set"}</dd>
                    <dt>Value</dt><dd>{money(latest.value_minor)}</dd>
                    <dt>Status</dt><dd>{statusNames[latest.status]}</dd>
                  </dl>
                  {savedUnavailable ? <p className="text-sm leading-6">This listing is no longer editable. Your unsaved draft is retained; choose New item to prepare a separate draft.</p> : <>
                    <p className="text-sm leading-6 text-muted-foreground">Replacing the draft discards its unsaved fields and adopts these saved facts.</p>
                    <Button variant="outline" disabled={busy || seeded} onClick={() => void perform(async () => {
                      await guardSession(Promise.resolve());
                      replaceItemDraft(latest);
                      setSavedReview(null);
                      announce("Draft replaced with the latest saved listing. Review before saving further changes.");
                    })}>Replace draft with saved listing</Button>
                  </>}
                </> : <p className="text-sm leading-6">This listing is no longer available. Your unsaved draft is retained; choose New item to prepare a separate draft.</p>}
              </section>}
              {editable && <div className="border-t pt-4">
                {removeRequested ? <div className="space-y-3"><p className="text-sm leading-6">Remove this listing from trading? It will no longer be available in new exchanges.</p><div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={disabled} onClick={() => void save("removed")}>Remove listing</Button><Button variant="outline" onClick={() => setRemoveRequested(false)}>Keep listing</Button></div></div> : <Button variant="ghost" disabled={disabled} onClick={() => setRemoveRequested(true)}>Remove from trading</Button>}
              </div>}
            </div>
          </details>}
          <section className="space-y-3 border-t pt-5" aria-labelledby="listing-assistance-heading">
            <h3 id="listing-assistance-heading" className="text-lg font-semibold">A little help, if you want it</h3>
            <p className="text-sm leading-6 text-muted-foreground">AI can suggest details and a comparison value from your photo. You review everything before using it. Manual entry always works.</p>
            <Button variant="outline" disabled={disabled || !editing?.image_id || !view.integrations?.gemini_configured} onClick={() => {
              if (!editing) return;
              void perform(async () => {
                const analysis = await guardSession(api<Analysis>(`items/${editing.id}/analysis`, "POST", { expected_revision: editing.revision }));
                setEditing((current) => current?.id === editing.id ? { ...current, analysis } : current);
                await guardSession(load());
                announce("AI suggestions are ready for review; your listing was not changed.");
              });
            }}>Suggest details and value</Button>
            {!view.integrations?.gemini_configured && <p className="text-sm text-muted-foreground">Photo assistance is unavailable in this preview. You can add every detail yourself.</p>}
            {editing?.analysis && <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium">AI suggestion — review before using</h4>
              <p className="text-sm leading-6">{editing.analysis.attributes.description}</p>
              {editing.analysis.range && <p className="text-sm leading-6">Estimated range: {money(editing.analysis.range.low_minor)}–{money(editing.analysis.range.high_minor)}. Enter your reviewed comparison value above.</p>}
              {editing.analysis.attributes.clarification_questions.map((question) => <p key={question} className="text-sm leading-6">{question}</p>)}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={disabled} onClick={() => setForm({ ...form, description: editing.analysis!.attributes.description })}>Use suggested description</Button>
                <Button variant="ghost" disabled={disabled} onClick={() => setEditing({ ...editing, analysis: null })}>Ignore suggestion</Button>
              </div>
              {editing.analysis.evidence?.map((evidence) => <a key={evidence.uri} className="block text-sm underline underline-offset-4" href={evidence.uri} target="_blank" rel="noopener noreferrer">{evidence.title} · {money(evidence.price_minor)}</a>)}
            </div>}
          </section>
          {editing?.status === "available" && <section className="space-y-3 border-t pt-5">
            <h3 className="text-lg font-semibold">Help others find it</h3>
            <p className="text-sm leading-6 text-muted-foreground">Prepare this saved version for matching with other members’ interests. Update this after changing the listing.</p>
            <Button variant="outline" disabled={disabled || listingDirty || !view.integrations?.bedrock_configured} onClick={() => void perform(async () => {
              await guardSession(api(`items/${editing.id}/embedding`, "POST", { expected_revision: editing.revision }));
              announce("Your current listing is ready for matching.");
            })}>Make discoverable</Button>
            {!view.integrations?.bedrock_configured && <p className="text-sm text-muted-foreground">Matching preparation is unavailable in this preview. Your saved listing is unchanged.</p>}
            {listingDirty && <p className="text-sm text-muted-foreground">Save your changes before preparing this version for matching.</p>}
          </section>}
        </div>
      </section>
    </div>
  </section>;
}
