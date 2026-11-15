"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, list, type Profile } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

type Feedback = { message: string; error?: Error };

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
  function add() {
    if (!pending.trim()) return;
    onChange(entries(value, pending));
  }
  return (
    <div className="field-group space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={id}>{label}</label>
        <span className="text-sm text-muted-foreground">{values.length} of 20</span>
      </div>
      <div className="flex items-start gap-2">
        <Input id={id} value={pending} maxLength={200} placeholder={kind === "interest" ? "Add a product or category" : "Add something you don’t want"} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`} onChange={event => onPending(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); add(); }
        }} onBlur={add} />
        <Button variant="outline" type="button" aria-label={`Add ${kind}`} onClick={add}>Add</Button>
      </div>
      {values.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={`${label} list`}>
        {values.map(entry => <li key={entry.toLocaleLowerCase()} className="choice-chip inline-flex max-w-full items-center rounded-full bg-secondary text-sm">
          <span className="min-w-0 break-words py-2 pl-4">{entry}</span>
          <Button className="ml-1 rounded-full" variant="ghost" size="icon" type="button" aria-label={`Remove ${kind} ${entry}`} onClick={() => onChange(values.filter(value => value !== entry))}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </Button>
        </li>)}
      </ul>}
      <p id={`${id}-help`} className="text-sm leading-6 text-muted-foreground">{kind === "interest" ? "Choose specific products or broad categories, such as a monitor or furniture. Press Enter or Add after each one." : "Items you never want to receive. Exclusions take priority over your interests."}</p>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PreferencesScreen() {
  const { view, busy, seeded, profileForm, setProfileForm, profileDraftRevision, resetProfileDraft, guardSession, load, run, setResults, setMessage, natural, setNatural, interpreted, setInterpreted } = useWorkspace();
  const [interestEntry, setInterestEntry] = useState("");
  const [exclusionEntry, setExclusionEntry] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [assistantFeedback, setAssistantFeedback] = useState<Feedback | null>(null);
  const [validation, setValidation] = useState<{ interests?: string; exclusions?: string }>({});
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = profileForm.interests !== view.profile.interests.join(", ") || profileForm.exclusions !== view.profile.exclusions.join(", ") || profileForm.gap_limit !== view.profile.gap_limit || Boolean(interestEntry.trim() || exclusionEntry.trim());
  const aiAvailable = view.integrations?.gemini_configured ?? true;
  const apiFieldError = (field: string) => feedback?.error instanceof ApiError
    ? feedback.error.fields?.find(error => error.field.split(".").includes(field))?.message
    : undefined;
  const feedbackMessage = feedback?.error instanceof ApiError && feedback.error.fields.length
    ? "Review the highlighted fields. Your changes are still here."
    : feedback?.message;
  const assistantFieldError = assistantFeedback?.error instanceof ApiError
    ? assistantFeedback.error.fields.find(error => error.field.split(".").includes("text"))?.message
    : undefined;
  const assistantMessage = assistantFeedback?.error instanceof ApiError && assistantFeedback.error.fields.length
    ? "Review the highlighted fields. Your changes are still here."
    : assistantFeedback?.message;

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
    <div className="max-w-3xl space-y-7">
      <header className="screen-heading">
        <h1 className="screen-title">Your preferences</h1>
        <p className="screen-description">Tell Bartr what would be useful to you. These details stay private.</p>
      </header>
      <section className="surface-panel" aria-labelledby="preferences-interests-heading">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 id="preferences-interests-heading" className="text-xl font-semibold">What you’re looking for</h2>
            <p className="text-sm leading-6 text-muted-foreground">A few interests are enough to start. You can change them at any time.</p>
          </div>
          <span className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "Up to date"}</span>
        </div>
        <form onSubmit={event => {
          event.preventDefault();
          const interests = entries(profileForm.interests, interestEntry);
          const exclusions = entries(profileForm.exclusions, exclusionEntry);
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
          <fieldset disabled={busy || seeded} className="space-y-7">
            <EntryField id="profile-interests" label="Interests" kind="interest" value={profileForm.interests} pending={interestEntry} onPending={value => { setInterestEntry(value); setFeedback(null); }} onChange={values => changeEntries("interests", values)} error={validation.interests || apiFieldError("interests")} />
            <EntryField id="profile-exclusions" label="Exclusions" kind="exclusion" value={profileForm.exclusions} pending={exclusionEntry} onPending={value => { setExclusionEntry(value); setFeedback(null); }} onChange={values => changeEntries("exclusions", values)} error={validation.exclusions || apiFieldError("exclusions")} />
            <div className="field-group space-y-3 border-t pt-7">
              <label className="text-sm font-medium" htmlFor="profile-gap">Estimated value difference (%)</label>
              <Input id="profile-gap" className="max-w-36" type="number" inputMode="numeric" min={0} max={100} step={1} required value={profileForm.gap_limit} aria-invalid={Boolean(apiFieldError("gap_limit"))} aria-describedby={`profile-gap-help${apiFieldError("gap_limit") ? " profile-gap-error" : ""}`} onChange={event => { setFeedback(null); setProfileForm({ ...profileForm, gap_limit: Number(event.target.value) }); }} />
              <div id="profile-gap-help" className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>How different two estimated bundle totals can be. At 20%, bundles estimated at $80 and $100 meet your limit.</p>
                <p>Both members’ limits apply to recommendations. These are comparison estimates, not payments; you can still choose a different balance in a manual offer.</p>
              </div>
              {apiFieldError("gap_limit") && <p id="profile-gap-error" className="text-sm text-destructive">{apiFieldError("gap_limit")}</p>}
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
        <details className="mt-8 border-t pt-6">
          <summary className="min-h-11 cursor-pointer text-base font-medium">Get help choosing interests</summary>
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">Optional AI assistance turns a description into suggested interests. Review or dismiss the suggestions before adding them. You can always enter interests yourself above.</p>
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-natural">Describe what you’re looking for</label>
              <Textarea id="profile-natural" maxLength={3000} disabled={busy || seeded || !aiAvailable} placeholder="For example, a screen for studying and furniture for a small room" value={natural} aria-invalid={Boolean(assistantFieldError)} aria-describedby={assistantFieldError ? "profile-natural-error" : undefined} onChange={event => { setNatural(event.target.value); setAssistantFeedback(null); }} />
              {assistantFieldError && <p id="profile-natural-error" className="text-sm text-destructive">{assistantFieldError}</p>}
            </div>
            {!aiAvailable && <p className="text-sm text-muted-foreground">AI suggestions are unavailable in this preview. You can add any interests using the fields above.</p>}
            <Button variant="outline" disabled={busy || seeded || !natural.trim() || !aiAvailable} onClick={() => {
              setAssistantFeedback(null);
              void run(async () => {
                try {
                  const data = await guardSession(api<{ interests: string[]; summary: string }>("preferences/interpret", "POST", { text: natural }));
                  setInterpreted(data.interests);
                  setAssistantFeedback({ message: "Suggestions are ready. Review them before adding to your interests." });
                } catch (error) {
                  setAssistantFeedback({ message: error instanceof Error ? error.message : "Suggestions are unavailable. Your description is still here; try again or add interests above.", error: error instanceof Error ? error : new Error("The action could not be completed.") });
                  throw error;
                }
              });
            }}>{busy ? "Finding suggestions…" : "Suggest interests"}</Button>
            {assistantFeedback && <p className="inline-feedback text-sm leading-6" data-tone={assistantFeedback.error ? "error" : "success"} role={assistantFeedback.error ? "alert" : "status"}>{assistantMessage}</p>}
            {interpreted && <div className="space-y-3 border-t pt-4">
              <h3 className="text-base font-semibold">Suggested interests</h3>
              <p className="text-sm leading-6">{interpreted.join(", ") || "No interests found. Try a more specific description."}</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={busy || seeded || interpreted.length === 0} onClick={() => {
                  const values = entries(profileForm.interests, [...list(interestEntry), ...interpreted].join(", "));
                  const error = entryError(values);
                  if (error) { setAssistantFeedback({ message: error, error: new Error(error) }); return; }
                  changeEntries("interests", values);
                  setInterpreted(null);
                  setAssistantFeedback({ message: "Interests added to your draft. Save preferences when you’re ready." });
                }}>Add suggested interests</Button>
                <Button variant="ghost" disabled={busy || seeded} onClick={() => { setInterpreted(null); setAssistantFeedback(null); }}>Dismiss suggestions</Button>
              </div>
            </div>}
          </div>
        </details>
      </section>
    </div>
  );
}
