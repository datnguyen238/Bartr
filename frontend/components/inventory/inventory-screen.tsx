"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api, upload, money, ApiError, type Analysis, type Item } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

const statusNames: Record<Item["status"], string> = {
  draft: "Private draft", available: "Available", reserved: "Reserved for a trade", exchanged: "Exchanged", removed: "Removed",
};
type Filter = "all" | "available" | "draft" | "unavailable";
const categories = ["Books", "Clothing", "Electronics", "Furniture", "Home goods", "Household essentials", "Kitchenware", "Sports equipment", "Study supplies", "Other"];
const conditions = ["New", "Like new", "Used", "Good", "Fair", "For parts"];

function PhotoIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="m3 16 5-5 5 5 3-3 5 5M9 5l1-2h4l1 2" /><circle cx="16.5" cy="9.5" r="1" /></svg>;
}

export function InventoryScreen({ embedded = false, active = true }: { embedded?: boolean; active?: boolean }) {
  const {
    view, busy, seeded, setMessage, editing, setEditing, form, setForm, load, run,
    guardSession, mine, edit, replaceItemDraft, listingDirty, saveItem,
  } = useWorkspace();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState<ApiError | Error | null>(null);
  const [listFailure, setListFailure] = useState("");
  const editorInvoker = useRef<HTMLElement | null>(null);
  const addItemButton = useRef<HTMLButtonElement>(null);
  const listingForm = useRef<HTMLFormElement>(null);
  const selectedItemId = useRef<string | null>(null);
  selectedItemId.current = editing?.id ?? null;
  const reviewScope = `${view.profile.id}:${editing?.id ?? ""}`;
  const [savedReview, setSavedReview] = useState<{ scope: string; item: Item | null } | null>(null);
  useEffect(() => { if (!active) setEditorOpen(false); }, [active]);
  useEffect(() => { setSavedReview(null); setFailure(null); }, [reviewScope]);
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
    { name: "AI evaluation", complete: Boolean(editing?.analysis?.estimate_minor && Number(form.value) * 100 === editing.analysis.estimate_minor && ["title", "description", "category", "condition"].every((key) => form[key as "title" | "description" | "category" | "condition"] === editing[key as "title" | "description" | "category" | "condition"])) },
  ];
  const complete = readiness.every((entry) => entry.complete);
  const visibleItems = mine.filter((item) => filter === "all" || (filter === "unavailable" ? !["draft", "available"].includes(item.status) : item.status === filter));

  function openEditor(item: Item | null, trigger: HTMLElement) {
    editorInvoker.current = trigger;
    setEditorMode(item ? "edit" : "add");
    edit(item);
    setEditorOpen(true);
    setFeedback("");
    setFailure(null);
  }
  async function perform(action: () => Promise<void>) {
    setFailure(null);
    setFeedback("");
    await run(async () => {
      try { await action(); }
      catch (error) {
        if (error instanceof DOMException) setFailure(new Error("The item action could not be completed. Your draft is still here; reload and try again."));
        else if (error instanceof Error && error.name !== "SupersededSession" && !error.message.includes("earlier session")) setFailure(error);
        // Session failures still need the shared session handler; ordinary item
        // failures are already shown in this dialog and must not leak to other pages.
        if (!(error instanceof Error) || error.name === "SupersededSession" || (error instanceof ApiError && error.status === 401)) throw error;
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
      if (!view.integrations?.gemini_configured) {
        announce("Photo saved. Enter your item details.");
        return;
      }
      try {
        const suggestion = await guardSession(api<{title: string | null; category: string | null; description: string}>(`items/${attached.id}/identify`, "POST", { expected_revision: attached.revision }));
        if (selectedItemId.current !== attached.id) return;
        const category = categories.find(value => value.toLocaleLowerCase() === suggestion.category?.trim().toLocaleLowerCase()) ?? "";
        setForm(current => ({ ...current, title: current.title.trim() ? current.title : suggestion.title?.trim() || "", category: current.category.trim() ? current.category : category, description: current.description.trim() ? current.description : suggestion.description?.trim() || "" }));
        announce("Photo saved. Review the suggested details and choose a condition.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 || error instanceof Error && (error.name === "SupersededSession" || error.message.includes("earlier session"))) throw error;
        announce("Photo saved. Identification is unavailable; enter the details manually.");
      }
    });
  }
  async function save(status: Item["status"]) {
    await perform(async () => {
      await guardSession(saveItem({ status, analysisId: editing?.analysis?.estimate_minor === Math.round(Number(form.value) * 100) ? editing.analysis.analysis_id : undefined }));
      announce(status === "available" ? "Listing published. It is available for trading." : status === "removed" ? "Listing removed from trading." : "Private draft saved. You can finish it later.");
    });
  }
  async function removeItem(item: Item) {
    setListFailure("");
    await run(async () => {
      try {
        await guardSession(api<Item>(`items/${item.id}`, "PATCH", { title: item.title, description: item.description, category: item.category, condition: item.condition, value_minor: item.value_minor, status: "removed", expected_revision: item.revision }));
        await guardSession(load());
        setMessage("Item removed from trading.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 || error instanceof Error && (error.name === "SupersededSession" || error.message.includes("earlier session"))) throw error;
        setListFailure(error instanceof Error ? error.message : "Could not remove the item. Reload and try again.");
      }
    });
  }

  return <section className="profile-inventory space-y-6">
    <div className="screen-heading flex flex-wrap items-start justify-between gap-4">
      <div>
        {embedded ? <h2 className="text-xl font-semibold">Your items</h2> : <h1 className="screen-title">Your inventory</h1>}
      </div>
      <Button ref={addItemButton} disabled={busy || seeded} onClick={event => openEditor(null, event.currentTarget)}>Add item</Button>
    </div>
    <div className="inventory-workspace inventory-profile-list">
      <section className="inventory-list-pane surface-panel min-w-0" aria-label="Inventory items">
        {listFailure && <p role="alert" className="inline-feedback m-4 text-sm" data-tone="error">{listFailure}</p>}
        <div className="inventory-toolbar flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <p className="text-sm font-medium">{mine.length} {mine.length === 1 ? "item" : "items"} in your inventory</p>
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
              <p className="mt-1 text-sm">{item.value_minor === null ? "Value not set" : money(item.value_minor)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.value_source === "owner" ? "Value entered by you" : item.value_minor === null ? "You can add a value later" : item.value_basis === "image_assisted_estimate" ? "AI estimate · no comparable listings" : "AI-assisted estimate"}{item.value_set_at ? ` · ${new Date(item.value_set_at).toLocaleDateString()}` : ""}</p>
            </div>
            {["draft", "available"].includes(item.status) && <Button variant="outline" aria-label={`Edit ${item.title || "untitled draft"}`} onClick={event => openEditor(item, event.currentTarget)} disabled={busy || seeded}>Edit</Button>}
            {["draft", "available"].includes(item.status) && <AlertDialog>
              <AlertDialogTrigger asChild><Button type="button" variant="ghost" aria-label={`Remove ${item.title || "untitled draft"}`} disabled={busy || seeded}>Remove</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {item.title || "this draft"}?</AlertDialogTitle><AlertDialogDescription>This removes the item from trading. Its record remains in your past items.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void removeItem(item)}>Remove item</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>}
          </li>)}
        </ul>
        {!visibleItems.length && <div className="inventory-empty space-y-3 px-6 py-12 text-center">
          <h3 className="text-lg font-medium">{mine.length ? "No items here yet" : "Start with one thing"}</h3>
          <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">{mine.length ? "Choose another filter to see your other items." : "A chair, a calculator, something you’re ready to pass on. Add a photo or start with the details."}</p>
          {!mine.length && <Button variant="outline" disabled={busy || seeded} onClick={event => openEditor(null, event.currentTarget)}>Add your first item</Button>}
        </div>}
      </section>
      <ModalSheet open={editorOpen} onOpenChange={setEditorOpen} title={editorMode === "edit" ? "Edit item" : "Add item"} description={editing ? `${editing.title || "Untitled draft"}. ${listingDirty ? "Your unfinished edits stay here when you close." : statusNames[currentItem?.status ?? editing.status]}` : "Add a photo and item details. Your unfinished draft stays in this session."} returnFocusRef={editorInvoker} fallbackFocusRef={addItemButton} className="item-modal-sheet">
        <div className="inventory-editor-content space-y-6">
          <p className="text-sm text-muted-foreground"><span aria-hidden="true">*</span> Required to publish</p>
          {currentUnavailable && <div className="inline-feedback space-y-3 rounded-xl bg-secondary p-4" role="status">
            <p className="text-sm leading-6">{currentItem ? `Current status: ${statusNames[currentItem.status]}. This item can’t be changed while it is unavailable for new trades.` : "This listing isn’t in your current saved inventory. Check its saved status before making more changes."} Your unsaved details are kept. You can also choose Add item to prepare something else.</p>
            <Button type="button" variant="outline" disabled={busy || seeded} onClick={() => void perform(reviewLatest)}>Check saved listing</Button>
            {review && <p className="text-sm">{latest ? `Saved status: ${statusNames[latest.status]}.` : "The saved listing is no longer available."}</p>}
          </div>}
          <div className="inventory-photo space-y-3">
            <div className="font-medium"><label htmlFor="listing-photo">Item photo</label> <span aria-hidden="true">*</span></div>
            {editing?.image_id && <img src={`/api/images/${editing.image_id}`} alt={editing.title || "Your item"} className="max-h-56 w-full rounded-xl object-contain bg-secondary" />}
            <Input id="listing-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.heic,.heif" disabled={disabled} aria-describedby="listing-photo-help" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attachPhoto(file);
              event.target.value = "";
            }} />
            <p id="listing-photo-help" className="text-sm leading-6 text-muted-foreground">JPEG, PNG, WebP or HEIC. Your draft stays private until published.</p>
            {fieldError("image_id") && <p className="text-sm text-destructive">{fieldError("image_id")}</p>}
          </div>
          <div className="inventory-feedback" aria-live="polite">
            {feedback && <p role="status" className="inline-feedback rounded-xl bg-secondary p-4 text-sm leading-6">{feedback}</p>}
            {failure && <div role="alert" className="inline-feedback rounded-xl border border-destructive/30 p-4 text-sm leading-6 text-destructive">
              <p>{fields.length ? "Review the highlighted item details." : failure.message}</p>
              {fields.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{fields.map((entry, index) => <li key={`${entry.field}-${index}`}>{fieldLabels[entry.field] ?? "Item detail"}: {entry.message}</li>)}</ul>}
              {failure instanceof ApiError && ["STALE_ITEM", "STALE_ANALYSIS"].includes(failure.code ?? "") && <Button type="button" variant="outline" disabled={busy || seeded} onClick={() => void perform(reviewLatest)}>Review latest saved listing</Button>}
            </div>}
            {review && <section aria-labelledby="latest-listing-heading" className="space-y-3 border-t pt-4">
              <h3 id="latest-listing-heading" className="font-medium">Latest saved listing</h3>
              {latest ? <><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"><dt>Title</dt><dd>{latest.title || "Untitled draft"}</dd><dt>Description</dt><dd>{latest.description || "Not set"}</dd><dt>Category</dt><dd>{latest.category || "Not set"}</dd><dt>Condition</dt><dd>{latest.condition || "Not set"}</dd><dt>Value</dt><dd>{money(latest.value_minor)}</dd><dt>Status</dt><dd>{statusNames[latest.status]}</dd></dl>
                {savedUnavailable ? <p className="text-sm">This listing is no longer editable. Your unsaved draft is retained; choose Add item to prepare a separate draft.</p> : <><p className="text-sm">Replacing the draft discards its unsaved fields.</p><Button variant="outline" disabled={busy || seeded} onClick={() => { replaceItemDraft(latest); setSavedReview(null); announce("Draft replaced with the latest saved listing. Review before saving further changes."); }}>Replace draft with saved listing</Button></>}
              </> : <p className="text-sm">This listing is no longer available. Your unsaved draft is retained; choose Add item to prepare a separate draft.</p>}
            </section>}
          </div>
          <form ref={listingForm} onSubmit={(event) => { event.preventDefault(); void save(editing?.status === "available" ? "available" : "draft"); }} className="space-y-5">
            <fieldset disabled={disabled} className="space-y-4">
              <legend className="mb-3 text-lg font-semibold">Item details</legend>
              {(["title", "category", "condition"] as const).map((key) => <div className="field-group" key={key}>
                <div className="text-sm font-medium"><label htmlFor={`listing-${key}`}>{key[0].toUpperCase() + key.slice(1)}</label> <span aria-hidden="true">*</span></div>
                {key === "title" ? <Input id={`listing-${key}`} value={form[key]} maxLength={150} placeholder="For example, wooden study chair" aria-invalid={Boolean(fieldError(key))} aria-describedby={fieldError(key) ? `listing-${key}-error` : undefined} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <select id={`listing-${key}`} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25" value={form[key]} aria-invalid={Boolean(fieldError(key))} aria-describedby={fieldError(key) ? `listing-${key}-error` : undefined} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
                  <option value="">Select {key}</option>
                  {form[key] && !(key === "category" ? categories : conditions).includes(form[key]) && <option value={form[key]}>{form[key]}</option>}
                  {(key === "category" ? categories : conditions).map(value => <option key={value} value={value}>{value}</option>)}
                </select>}
                {fieldError(key) && <p id={`listing-${key}-error`} className="text-sm text-destructive">{fieldError(key)}</p>}
              </div>)}
              <div className="field-group">
                <div className="text-sm font-medium"><label htmlFor="listing-description">Description</label> <span aria-hidden="true">*</span></div>
                <Textarea id="listing-description" value={form.description} maxLength={3000} placeholder="What should the next owner know?" aria-invalid={Boolean(fieldError("description"))} aria-describedby={fieldError("description") ? "listing-description-error" : undefined} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                {fieldError("description") && <p id="listing-description-error" className="text-sm text-destructive">{fieldError("description")}</p>}
              </div>
          <section className="space-y-3" aria-labelledby="listing-assistance-heading">
            <h3 id="listing-assistance-heading" className="sr-only">Price estimate</h3>

            {!view.integrations?.gemini_configured && <p className="text-sm text-muted-foreground">Evaluation is unavailable. Save your draft and try again later.</p>}
            {editing?.status === "available" && listingDirty && <p className="text-sm text-muted-foreground">Save your changes before evaluating this item.</p>}
            {editing?.analysis && <div className="space-y-3 pt-4">
              <h4 className="font-medium">{editing.analysis.price_basis === "image_assisted_estimate" ? "AI estimate" : "Comparable listings"}</h4>
              {editing.analysis.price_basis === "image_assisted_estimate" && <p className="text-sm text-muted-foreground">This AI estimate uses the photo and item details, without comparable listings.</p>}
              {editing.analysis.estimate_minor != null ? <p className="text-sm leading-6">Suggested value: {money(editing.analysis.estimate_minor)}{editing.analysis.comparison_basis ? ` · ${editing.analysis.comparison_basis} prices` : ""}.</p> : <p className="text-sm leading-6 text-muted-foreground">{editing.analysis.status === "clarification_required" ? "More item details are needed before an estimate can be given." : editing.analysis.price_basis === "image_assisted_estimate" ? "No estimate was found. Review the item details and try again." : "No estimate yet. At least three comparable listings with supported prices are needed. Check the title and condition, then evaluate again."}</p>}
              {editing.analysis.range && <p className="text-sm leading-6">Comparable range: {money(editing.analysis.range.low_minor)}–{money(editing.analysis.range.high_minor)}.</p>}
              {editing.analysis.estimate_minor != null && (["title", "description", "category", "condition"] as const).some(key => form[key] !== editing[key]) && <p className="text-sm text-muted-foreground">Item details changed. Evaluate again before selecting an estimate.</p>}
              {editing.analysis.estimate_minor != null && form.value && Number(form.value) * 100 === editing.analysis.estimate_minor && <p className="text-sm font-medium">Estimate selected</p>}
              {editing.analysis.attributes.clarification_questions.map((question) => <p key={question} className="text-sm leading-6">{question}</p>)}
              {editing.analysis.evidence?.length ? <div className="space-y-2 rounded-xl border p-4"><p className="text-sm font-medium">{editing.analysis.estimate_minor == null ? "Results — no estimate available" : "Sources"}</p>{editing.analysis.evidence.map((evidence) => <a key={evidence.uri} className="block text-sm underline underline-offset-4" href={evidence.uri} target="_blank" rel="noopener noreferrer">{evidence.title || "Comparable listing"} · {money(evidence.price_minor)}{evidence.match_kind && evidence.match_kind !== "unknown" ? ` · ${evidence.match_kind === "similar" ? "similar item" : "same model"}` : ""}{evidence.price_type ? ` · ${evidence.price_type}` : ""}{evidence.condition ? ` · ${evidence.condition}` : ""}</a>)}<p className="text-xs text-muted-foreground">Comparable items may differ by model or color. Prices are reported by search results; check the linked listings.</p></div> : null}
            </div>}
          </section>
              <div className="inventory-editor-actions form-actions flex flex-wrap gap-3">
            <Button type="button" variant="outline" disabled={disabled || !editing?.image_id || !form.condition.trim() || !view.integrations?.gemini_configured || Boolean(editing?.status === "available" && listingDirty)} onClick={() => {
              if (!editing) return;
              void perform(async () => {
                const target = listingDirty && editing.status === "draft" ? await guardSession(saveItem({ status: "draft" })) : editing;
                const analysis = await guardSession(api<Analysis>(`items/${target.id}/analysis`, "POST", { expected_revision: target.revision }));
                setEditing((current) => current?.id === target.id ? { ...current, analysis } : current);
                if (analysis.status === "estimated" && analysis.estimate_minor != null && selectedItemId.current === target.id) {
                  setForm(current => (["title", "description", "category", "condition"] as const).every(key => current[key] === target[key]) ? { ...current, value: (analysis.estimate_minor! / 100).toFixed(2) } : current);
                }
                await guardSession(load());
                announce(analysis.estimate_minor == null ? "No estimate was found. Review the item details and try again." : analysis.price_basis === "image_assisted_estimate" ? "AI estimate ready without comparable listings." : "Comparable listings are ready for review.");
              });
            }}>Estimate price</Button>
                <Button type="submit" className={editing?.status === "available" ? "ml-auto" : undefined} variant={editing?.status === "available" ? "default" : "outline"}>{busy ? "Saving…" : editing?.status === "available" ? "Save changes" : "Save draft"}</Button>
                {editing?.status !== "available" && <Button type="button" disabled={!complete || disabled} onClick={() => { if (listingForm.current?.reportValidity()) void save("available"); }}>Publish listing</Button>}
              </div>
            </fieldset>
          </form>
          {editing?.status === "available" && <section className="space-y-3 border-t pt-5">
            <h3 className="text-lg font-semibold">Help others find it</h3>
            <p className="text-sm leading-6 text-muted-foreground">Prepare this saved version for matching with other members’ interests. Update this after changing the listing.</p>
            <div className="flex justify-end"><Button variant="outline" disabled={disabled || listingDirty || !view.integrations?.bedrock_configured} onClick={() => void perform(async () => {
              await guardSession(api(`items/${editing.id}/embedding`, "POST", { expected_revision: editing.revision }));
              announce("Your current listing is ready for matching.");
            })}>Make discoverable</Button></div>
            {!view.integrations?.bedrock_configured && <p className="text-sm text-muted-foreground">Matching preparation is unavailable in this preview. Your saved listing is unchanged.</p>}
            {listingDirty && <p className="text-sm text-muted-foreground">Save your changes before preparing this version for matching.</p>}
          </section>}
        </div>
      </ModalSheet>
    </div>
  </section>;
}
