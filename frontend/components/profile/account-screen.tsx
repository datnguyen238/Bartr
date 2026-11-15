"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Profile } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

export function AccountScreen() {
  const { view, busy, seeded, profileForm, setProfileForm, profileDraftRevision, resetProfileDraft, guardSession, load, run, setResults, setMessage } = useWorkspace();
  const [feedback, setFeedback] = useState<{ message: string; error?: ApiError | Error } | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = profileForm.name !== view.profile.name || profileForm.community !== view.profile.community;
  const fieldError = (field: string) => feedback?.error instanceof ApiError
    ? feedback.error.fields?.find(error => error.field.split(".").includes(field))?.message
    : undefined;
  const feedbackMessage = feedback?.error instanceof ApiError && feedback.error.fields.length
    ? "Review the highlighted fields. Your changes are still here."
    : feedback?.message;

  async function reload() {
    setFeedback(null);
    setConfirmReload(false);
    await run(async () => {
      try {
        const latest = await load();
        resetProfileDraft("account", latest.profile);
        setFeedback({ message: "Latest saved profile loaded." });
        setMessage("Latest profile loaded. Review before saving.");
      } catch (error) {
        setFeedback({ message: error instanceof Error ? error.message : "Your profile couldn’t be loaded. Try again.", error: error instanceof Error ? error : new Error("The action could not be completed.") });
        throw error;
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-7">
      <header className="screen-heading">
        <h1 className="screen-title">Your profile</h1>
        <p className="screen-description">A familiar name. A local community. Start here.</p>
      </header>
      <section className="surface-panel" aria-labelledby="account-details-heading">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl space-y-2">
            <h2 id="account-details-heading" className="text-xl font-semibold">Public details</h2>
            <p className="text-sm leading-6 text-muted-foreground">Your display name and community are visible to other members. Choose a campus or city, without an exact address.</p>
          </div>
          <span className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "Up to date"}</span>
        </div>
        <form onSubmit={event => {
          event.preventDefault();
          setFeedback(null);
          setConfirmReload(false);
          void run(async () => {
            try {
              const saved = await guardSession(api<Profile>("profile", "PATCH", {
                name: profileForm.name, community: profileForm.community,
                interests: view.profile.interests, exclusions: view.profile.exclusions, gap_limit: view.profile.gap_limit,
                expected_revision: profileDraftRevision.account,
              }));
              await load();
              resetProfileDraft("account", saved);
              setResults(null);
              setFeedback({ message: "Profile saved. Your public details are up to date." });
              setMessage("Profile saved.");
            } catch (error) {
              setFeedback({ message: error instanceof Error ? error.message : "Your profile couldn’t be saved. Your edits are still here.", error: error instanceof Error ? error : new Error("The action could not be completed.") });
              throw error;
            }
          });
        }}>
          <fieldset disabled={busy || seeded} className="space-y-6">
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-username">Username</label>
              <Input id="profile-username" value={view.profile.username} readOnly autoComplete="username" aria-describedby="profile-username-help" />
              <p id="profile-username-help" className="text-sm text-muted-foreground">Only used to sign in. Your username stays the same.</p>
            </div>
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-name">Display name</label>
              <Input id="profile-name" required maxLength={200} pattern=".*\S.*" autoComplete="nickname" value={profileForm.name} aria-invalid={Boolean(fieldError("name"))} aria-describedby={fieldError("name") ? "profile-name-error" : undefined} onChange={event => { setFeedback(null); setProfileForm({ ...profileForm, name: event.target.value }); }} />
              {fieldError("name") && <p id="profile-name-error" className="text-sm text-destructive">{fieldError("name")}</p>}
            </div>
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-community">Community</label>
              <Input id="profile-community" required maxLength={200} pattern=".*\S.*" placeholder="Campus or city" value={profileForm.community} aria-invalid={Boolean(fieldError("community"))} aria-describedby={fieldError("community") ? "profile-community-help profile-community-error" : "profile-community-help"} onChange={event => { setFeedback(null); setProfileForm({ ...profileForm, community: event.target.value }); }} />
              <p id="profile-community-help" className="text-sm leading-6 text-muted-foreground">Trades stay within the same community. No phone number or precise location is needed.</p>
              {fieldError("community") && <p id="profile-community-error" className="text-sm text-destructive">{fieldError("community")}</p>}
            </div>
            {feedback && <p className="inline-feedback text-sm leading-6" data-tone={feedback.error ? "error" : "success"} role={feedback.error ? "alert" : "status"}>{feedbackMessage}</p>}
            <div className="form-actions flex flex-wrap items-center gap-3 border-t pt-6">
              <Button type="submit">{busy ? "Saving…" : "Save profile"}</Button>
              <Button variant="ghost" type="button" onClick={() => dirty ? setConfirmReload(true) : void reload()}>Reload profile</Button>
            </div>
            {confirmReload && (
              <div className="inline-feedback space-y-3 text-sm" role="group" aria-label="Review unsaved profile changes">
                <p>Reloading replaces your unsaved account edits with the latest saved details.</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" type="button" onClick={() => void reload()}>Discard edits and reload</Button>
                  <Button variant="ghost" type="button" onClick={() => setConfirmReload(false)}>Keep editing</Button>
                </div>
              </div>
            )}
          </fieldset>
        </form>
      </section>
    </div>
  );
}
