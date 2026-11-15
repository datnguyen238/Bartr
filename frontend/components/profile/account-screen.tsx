"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api, type Profile } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

export function AccountScreen() {
  const { view, busy, seeded, profileForm, setProfileForm, profileDraftRevision, resetProfileDraft, guardSession, load, run, setResults, setMessage } = useWorkspace();
  return (
    <Card className="max-w-2xl shadow-none">
      <CardHeader>
        <h2 className="text-2xl font-semibold">Your profile</h2>
        <p className="text-sm leading-6 text-muted-foreground">Your display name and community are visible to other members. Use a campus or city, without an exact address.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            const saved = await guardSession(api<Profile>("profile", "PATCH", {
              name: profileForm.name, community: profileForm.community,
              interests: view.profile.interests, exclusions: view.profile.exclusions, gap_limit: view.profile.gap_limit,
              expected_revision: profileDraftRevision.account,
            }));
            await load();
            resetProfileDraft("account", saved);
            setResults(null);
            setMessage("Profile saved.");
          });
        }}>
          <fieldset disabled={busy || seeded} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-username">Username</label>
              <Input id="profile-username" value={view.profile.username} readOnly autoComplete="username" />
              <p className="text-xs text-muted-foreground">Your sign-in username stays the same.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-name">Display name</label>
              <Input id="profile-name" required maxLength={200} pattern=".*\S.*" autoComplete="nickname" value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="profile-community">Community</label>
              <Input id="profile-community" required maxLength={200} pattern=".*\S.*" placeholder="Campus or city" value={profileForm.community} onChange={event => setProfileForm({ ...profileForm, community: event.target.value })} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save profile</Button>
              <Button variant="outline" type="button" onClick={() => void run(async () => {
                const latest = await load();
                resetProfileDraft("account", latest.profile);
                setMessage("Latest profile loaded. Review before saving.");
              })}>Reload profile</Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Reload profile replaces unsaved account edits with the latest saved details.</p>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
