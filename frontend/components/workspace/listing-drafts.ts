"use client";

import { useRef, useState, type SetStateAction } from "react";
import type { Item } from "@/lib/marketplace";
import { blank } from "./constants";

export type ListingForm = typeof blank;
type Draft = { item: Item | null; form: ListingForm; baseline: ListingForm };
const newItemKey = "new-item";
const keyFor = (item: Item | null) => item?.id ?? newItemKey;

export function listingForm(item: Item | null): ListingForm {
  return item ? {
    title: item.title, description: item.description, category: item.category,
    condition: item.condition, value: item.value_minor === null ? "" : String(item.value_minor / 100),
    status: item.status,
  } : { ...blank };
}

function sameForm(a: ListingForm, b: ListingForm) {
  return (Object.keys(a) as (keyof ListingForm)[]).every((key) => a[key] === b[key]);
}

// Drafts stay in this account's mounted workspace, never in browser persistence.
export function useListingDrafts() {
  const drafts = useRef(new Map<string, Draft>());
  const editingRef = useRef<Item | null>(null);
  const formRef = useRef<ListingForm>({ ...blank });
  const [editing, setEditingState] = useState<Item | null>(null);
  const [form, setFormState] = useState<ListingForm>({ ...blank });
  const [, renderDraftState] = useState(0);

  function recordCurrent() {
    const key = keyFor(editingRef.current);
    const current = drafts.current.get(key);
    drafts.current.set(key, {
      item: editingRef.current, form: { ...formRef.current },
      baseline: current?.baseline ?? listingForm(editingRef.current),
    });
  }

  function setForm(value: SetStateAction<ListingForm>) {
    const next = typeof value === "function" ? value(formRef.current) : value;
    formRef.current = next;
    recordCurrent();
    setFormState(next);
  }

  function setEditing(value: SetStateAction<Item | null>) {
    const next = typeof value === "function" ? value(editingRef.current) : value;
    editingRef.current = next;
    recordCurrent();
    setEditingState(next);
  }

  function show(draft: Draft) {
    editingRef.current = draft.item;
    formRef.current = { ...draft.form };
    setEditingState(draft.item);
    setFormState(formRef.current);
  }

  function edit(item: Item | null) {
    recordCurrent();
    const key = keyFor(item);
    const saved = drafts.current.get(key);
    const initial = listingForm(item);
    const draft = saved ?? { item, form: initial, baseline: { ...initial } };
    drafts.current.set(key, draft);
    show(draft);
  }

  // Use only after an explicit request to discard/replace this listing's draft.
  function replaceItemDraft(item: Item | null) {
    recordCurrent();
    const initial = listingForm(item);
    const draft = { item, form: initial, baseline: { ...initial } };
    drafts.current.set(keyFor(item), draft);
    show(draft);
  }

  function resetListingDrafts() {
    drafts.current.clear();
    show({ item: null, form: { ...blank }, baseline: { ...blank } });
  }

  function reconcileListings(items: Item[]) {
    const incoming = new Map(items.map((item) => [item.id, item]));
    for (const [key, draft] of drafts.current) {
      const item = incoming.get(key);
      if (!item || !sameForm(draft.form, draft.baseline)) continue;
      const next = listingForm(item);
      const refreshed = { item, form: next, baseline: { ...next } };
      drafts.current.set(key, refreshed);
      if (key === keyFor(editingRef.current)) show(refreshed);
    }
    renderDraftState((value) => value + 1);
  }

  function savedListing(saved: Item, submitted: ListingForm, previousItem: Item | null) {
    const previousKey = keyFor(previousItem);
    const selected = keyFor(editingRef.current) === previousKey;
    const current = drafts.current.get(previousKey);
    const unchanged = sameForm(current?.form ?? formRef.current, submitted);
    const baseline = listingForm(saved);
    const next = { item: saved, form: unchanged ? baseline : { ...(current?.form ?? submitted) }, baseline };
    if (!previousItem) drafts.current.delete(newItemKey);
    drafts.current.set(saved.id, next);
    if (selected) show(next);
    renderDraftState((value) => value + 1);
  }

  const current = drafts.current.get(keyFor(editing));
  const listingDirty = !sameForm(form, current?.baseline ?? listingForm(editing));
  const hasListingDrafts = listingDirty || [...drafts.current.values()].some((draft) => !sameForm(draft.form, draft.baseline));

  return {
    editing, setEditing, form, setForm, edit, replaceItemDraft,
    resetListingDrafts, reconcileListings, savedListing, listingDirty, hasListingDrafts,
  };
}
