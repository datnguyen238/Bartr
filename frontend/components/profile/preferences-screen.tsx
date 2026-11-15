"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, ApiError, list, type Profile } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

type Feedback = { message: string; error?: Error };

const interestSuggestions = ["Books", "Clothing", "Electronics", "Furniture", "Home goods", "Kitchenware", "Monitor", "Sports equipment", "Study supplies"];
const exclusionSuggestions = ["Books", "Clothing", "Electronics", "Furniture", "Home goods", "Kitchenware", "Sports equipment", "Study supplies"];

function entries(value: string, pending = "") {
  const seen = new Set<string>();
  return [...list(value), ...list(pending)].filter(entry => {
    const key = entry.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function entryError(values: string[]) {
  if (values.length > 20) return "Keep up to 20 entries in this list. Remove one before adding another.";
  if (values.some(value => value.length > 200)) return "Keep each entry within 200 characters.";
  return null;
}

function EntryField({ id, label, kind, value, pending, onPending, onChange, error }: {
  id: string; label: string; kind: "interest" | "exclusion"; value: string; pending: string;
  onPending: (value: string) => void; onChange: (values: string[]) => void; error?: string;
}) {
  const values = entries(value);
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestions = kind === "interest" ? interestSuggestions : exclusionSuggestions;
  const matches = suggestions.filter(suggestion => !values.some(entry => entry.toLocaleLowerCase() === suggestion.toLocaleLowerCase()) && suggestion.toLocaleLowerCase().includes(pending.trim().toLocaleLowerCase()));
  return (
    <div className="field-group min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={id}>{label}</label>
        <span className="text-sm text-muted-foreground">{values.length} of 20</span>
      </div>
      <DropdownMenu onOpenChange={open => { if (open) requestAnimationFrame(() => searchRef.current?.focus()); else onPending(""); }}>
        <DropdownMenuTrigger asChild>
          <Button id={id} variant="outline" type="button" className="w-full justify-between bg-background font-normal text-muted-foreground" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
            Search {label.toLowerCase()} <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) p-2">
          <Input ref={searchRef} aria-label={`Search ${label.toLowerCase()}`} placeholder="Search..." value={pending} onChange={event => onPending(event.target.value)} onKeyDown={event => {
            if (event.key !== "ArrowDown" && event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
          }} />
          <div className="mt-1 max-h-56 overflow-y-auto">
            {matches.length ? matches.map(suggestion => <DropdownMenuItem key={suggestion} onSelect={() => onChange(entries(value, suggestion))}>{suggestion}</DropdownMenuItem>) : <p className="px-2 py-3 text-sm text-muted-foreground">No matches found.</p>}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {values.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={`${label} list`}>
        {values.map(entry => <li key={entry.toLocaleLowerCase()} className="choice-chip inline-flex max-w-full items-center rounded-full bg-secondary text-sm">
          <span className="min-w-0 break-words py-2 pl-4">{entry}</span>
          <Button className="ml-1 rounded-full" variant="ghost" size="icon" type="button" aria-label={`Remove ${kind} ${entry}`} onClick={() => onChange(values.filter(value => value !== entry))}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </Button>
        </li>)}
      </ul>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PreferencesScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { view, busy, seeded, profileForm, setProfileForm, profileDraftRevision, resetProfileDraft, guardSession, load, run, setResults, setMessage } = useWorkspace();
  const [interestEntry, setInterestEntry] = useState("");
  const [exclusionEntry, setExclusionEntry] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [validation, setValidation] = useState<{ interests?: string; exclusions?: string }>({});
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = profileForm.interests !== view.profile.interests.join(", ") || profileForm.exclusions !== view.profile.exclusions.join(", ") || profileForm.gap_limit !== view.profile.gap_limit;
  const apiFieldError = (field: string) => feedback?.error instanceof ApiError
    ? feedback.error.fields?.find(error => error.field.split(".").includes(field))?.message
    : undefined;
  const feedbackMessage = feedback?.error instanceof ApiError && feedback.error.fields.length
    ? "Review the highlighted fields. Your changes are still here."
    : feedback?.message;

  function changeEntries(field: "interests" | "exclusions", values: string[]) {
    const error = entryError(values);
    setValidation(current => ({ ...current, [field]: error ?? undefined }));
    if (error) return;
    setProfileForm({ ...profileForm, [field]: values.join(", ") });
    (field === "interests" ? setInterestEntry : setExclusionEntry)("");
    setFeedback(null);
  }

  async function reload() {
    setConfirmReload(false);
    setFeedback(null);
    await run(async () => {
      try {
        const latest = await load();
        resetProfileDraft("preferences", latest.profile);
        setInterestEntry(""); setExclusionEntry(""); setValidation({});
        setFeedback({ message: "Latest saved preferences loaded." });
        setMessage("Latest preferences loaded. Review before saving.");
      } catch (error) {
        setFeedback({ message: error instanceof Error ? error.message : "Your preferences couldn’t be loaded. Try again.", error: error instanceof Error ? error : new Error("The action could not be completed.") });
        throw error;
      }
    });
  }

  return (
    <div className={`${embedded ? "w-full" : "w-full max-w-4xl"} space-y-7`}>
      {!embedded && <header className="screen-heading">
        <h1 className="screen-title">Your preferences</h1>
        <p className="screen-description">Tell Bartr what would be useful to you. These details stay private.</p>
      </header>}
      <section className="surface-panel" aria-labelledby="preferences-interests-heading">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 id="preferences-interests-heading" className="text-xl font-semibold">What you’re looking for</h2>
          </div>
          <span className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "Up to date"}</span>
        </div>
        <form onSubmit={event => {
          event.preventDefault();
          const interests = entries(profileForm.interests);
          const exclusions = entries(profileForm.exclusions);
          const invalid = { interests: entryError(interests) ?? undefined, exclusions: entryError(exclusions) ?? undefined };
          setValidation(invalid);
          if (invalid.interests || invalid.exclusions) {
            setFeedback({ message: "Review the highlighted entries. Your changes are still here.", error: new Error("Review entries") });
            return;
          }
          setFeedback(null); setConfirmReload(false);
          setProfileForm({ ...profileForm, interests: interests.join(", "), exclusions: exclusions.join(", ") });
          setInterestEntry(""); setExclusionEntry("");
          void run(async () => {
            try {
              const saved = await guardSession(api<Profile>("profile", "PATCH", {
                name: view.profile.name, community: view.profile.community, interests, exclusions,
                gap_limit: profileForm.gap_limit, expected_revision: profileDraftRevision.preferences,
              }));
              await load();
              resetProfileDraft("preferences", saved);
              setResults(null);
              setFeedback({ message: "Preferences saved. Future suggestions will use these choices." });
              setMessage("Preferences saved.");
            } catch (error) {
              setFeedback({ message: error instanceof Error ? error.message : "Your preferences couldn’t be saved. Your changes are still here.", error: error instanceof Error ? error : new Error("The action could not be completed.") });
              throw error;
            }
          });
        }}>
          <fieldset disabled={busy || seeded} className="space-y-6">
            <div className="grid gap-7">
              <EntryField id="profile-interests" label="Interests" kind="interest" value={profileForm.interests} pending={interestEntry} onPending={value => { setInterestEntry(value); setFeedback(null); }} onChange={values => changeEntries("interests", values)} error={validation.interests || apiFieldError("interests")} />
              <EntryField id="profile-exclusions" label="Exclusions" kind="exclusion" value={profileForm.exclusions} pending={exclusionEntry} onPending={value => { setExclusionEntry(value); setFeedback(null); }} onChange={values => changeEntries("exclusions", values)} error={validation.exclusions || apiFieldError("exclusions")} />
            </div>
            <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="max-w-prose space-y-2">
                <label className="text-sm font-medium" htmlFor="profile-gap">Estimated value difference (%)</label>
                {apiFieldError("gap_limit") && <p id="profile-gap-error" className="text-sm text-destructive">{apiFieldError("gap_limit")}</p>}
              </div>
              <select id="profile-gap" className="h-11 w-28 shrink-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25" required value={profileForm.gap_limit} aria-invalid={Boolean(apiFieldError("gap_limit"))} aria-describedby={apiFieldError("gap_limit") ? "profile-gap-error" : undefined} onChange={event => { setFeedback(null); setProfileForm({ ...profileForm, gap_limit: Number(event.target.value) }); }}>
                {Array.from({ length: 101 }, (_, value) => <option key={value} value={value}>{value}%</option>)}
              </select>
            </div>
            {feedback && <p className="inline-feedback text-sm leading-6" data-tone={feedback.error ? "error" : "success"} role={feedback.error ? "alert" : "status"}>{feedbackMessage}</p>}
            <div className="form-actions flex flex-wrap items-center gap-3 border-t pt-6">
              <Button type="submit">{busy ? "Saving…" : "Save preferences"}</Button>
              <Button variant="ghost" type="button" onClick={() => dirty ? setConfirmReload(true) : void reload()}>Reload preferences</Button>
            </div>
            {confirmReload && <div className="inline-feedback space-y-3 text-sm" role="group" aria-label="Review unsaved preference changes">
              <p>Reloading replaces your unsaved preference edits with the latest saved choices.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" type="button" onClick={() => void reload()}>Discard edits and reload</Button>
                <Button variant="ghost" type="button" onClick={() => setConfirmReload(false)}>Keep editing</Button>
              </div>
            </div>}
          </fieldset>
        </form>
      </section>
    </div>
  );
}
