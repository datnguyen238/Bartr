"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api, list, type Profile } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

export function PreferencesScreen() {
  const { view, busy, seeded, profileForm, setProfileForm, profileDraftRevision, resetProfileDraft, guardSession, load, run, setResults, setMessage, natural, setNatural, interpreted, setInterpreted } = useWorkspace();
  return (
    <Card className="max-w-2xl shadow-none">
      <CardHeader>
        <h2 className="text-2xl font-semibold">Your preferences</h2>
        <p className="text-sm leading-6 text-muted-foreground">Private interests and exclusions help Bartr find useful exchanges. Separate each entry with a comma.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            const saved = await guardSession(api<Profile>("profile", "PATCH", {
              name: view.profile.name, community: view.profile.community,
              interests: list(profileForm.interests), exclusions: list(profileForm.exclusions), gap_limit: profileForm.gap_limit,
              expected_revision: profileDraftRevision.preferences,
            }));
            await load();
            resetProfileDraft("preferences", saved);
            setResults(null);
            setMessage("Preferences saved.");
          });
        }}>
          <fieldset disabled={busy || seeded} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-interests">Interests (comma-separated)</label>
              <Input id="profile-interests" value={profileForm.interests} onChange={event => setProfileForm({ ...profileForm, interests: event.target.value })} />
              <p className="text-xs text-muted-foreground">Specific products or categories, for example: monitor, furniture. Up to 20 entries of 200 characters each.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-exclusions">Exclusions (comma-separated)</label>
              <Input id="profile-exclusions" value={profileForm.exclusions} onChange={event => setProfileForm({ ...profileForm, exclusions: event.target.value })} />
              <p className="text-xs text-muted-foreground">Things you don’t want. Up to 20 entries of 200 characters each.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-gap">Maximum recommendation gap (%)</label>
              <Input id="profile-gap" type="number" min={0} max={100} step={1} required value={profileForm.gap_limit} onChange={event => setProfileForm({ ...profileForm, gap_limit: Number(event.target.value) })} />
              <p className="text-xs leading-5 text-muted-foreground">The value difference divided by the larger bundle total. Both members’ limits apply to recommendations.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save preferences</Button>
              <Button variant="outline" type="button" onClick={() => void run(async () => {
                const latest = await load();
                resetProfileDraft("preferences", latest.profile);
                setMessage("Latest preferences loaded. Review before saving.");
              })}>Reload preferences</Button>
            </div>
            <p className="text-xs text-muted-foreground">Reload preferences replaces unsaved preference edits.</p>
          </fieldset>
        </form>
        <div className="mt-7 space-y-3 border-t pt-5">
          <label className="block text-sm font-medium" htmlFor="profile-natural">Describe what you’re looking for</label>
          <Textarea id="profile-natural" maxLength={3000} disabled={busy || seeded} value={natural} onChange={event => setNatural(event.target.value)} />
          <Button variant="outline" disabled={busy || seeded || !natural.trim()} onClick={() => void run(async () => {
            const data = await guardSession(api<{ interests: string[]; summary: string }>("preferences/interpret", "POST", { text: natural }));
            setInterpreted(data.interests);
            setMessage(`${data.summary} Review the suggested interests before saving.`);
          })}>Interpret with Gemini</Button>
          {interpreted && (
            <div className="rounded-lg bg-secondary p-4 text-sm">
              <p>{interpreted.join(", ")}</p>
              <Button className="mt-3" size="sm" disabled={busy || seeded} onClick={() => {
                setProfileForm({ ...profileForm, interests: interpreted.join(", ") });
                setInterpreted(null);
              }}>Use these interests in the form</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
