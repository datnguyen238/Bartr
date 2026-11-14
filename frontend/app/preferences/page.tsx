"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, list } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { control } from "@/components/workspace/constants";

export default function PreferencesPage() {
  const {
    view,
    busy,
    setMessage,
    form,
    setResults,
    natural,
    setNatural,
    interpreted,
    setInterpreted,
    profileForm,
    setProfileForm,
    load,
    run,
    offer,
    name,
  } = useWorkspace();
  if (!view) return null;
  return (
    <Card className="max-w-2xl shadow-none">
      <CardHeader>
        <CardTitle>Your profile & preferences</CardTitle>
        <CardDescription>
          Private preferences guide recommendations. Display name and
          community are public.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("profile", "PATCH", {
                ...profileForm,
                interests: list(profileForm.interests),
                exclusions: list(profileForm.exclusions),
                expected_revision: view.profile.revision,
              });
              await load();
              setResults(null);
              setMessage("Profile and preferences saved.");
            });
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            {(
              [
                "name",
                "community",
                "interests",
                "exclusions",
              ] as const
            ).map((key) => (
              <label key={key} className="block text-sm capitalize">
                {key}
                {["interests", "exclusions"].includes(key)
                  ? " (comma-separated)"
                  : ""}
                <Input
                  className={control}
                  value={profileForm[key]}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      [key]: e.target.value,
                    })
                  }
                />
              </label>
            ))}
            <label className="block text-sm">
              Maximum recommendation gap (%)
              <Input
                className={control}
                type="number"
                min="0"
                max="100"
                required
                value={profileForm.gap_limit}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    gap_limit: Number(e.target.value),
                  })
                }
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Gap = absolute value difference ÷ the larger bundle
              total. Both participants’ limits apply. You may
              voluntarily accept a manual offer beyond your
              recommendation limit.
            </p>
            <Button type="submit">Save preferences</Button>
          </fieldset>
        </form>
        <div className="mt-7 border-t pt-5">
          <label className="block text-sm">
            Describe what you’re looking for
            <Textarea
              className={control}
              value={natural}
              onChange={(e) => setNatural(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            className="mt-3"
            disabled={busy || !natural.trim()}
            onClick={() =>
              run(async () => {
                const data = await api<{
                  interests: string[];
                  summary: string;
                }>("preferences/interpret", "POST", {
                  text: natural,
                });
                setInterpreted(data.interests);
                setMessage(
                  data.summary +
                    " Review the suggested interests before saving.",
                );
              })
            }
          >
            Interpret with Gemini
          </Button>
          {interpreted && (
            <div className="mt-3 rounded-lg bg-secondary p-4 text-sm">
              <p>{interpreted.join(", ")}</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setProfileForm({
                    ...profileForm,
                    interests: interpreted.join(", "),
                  });
                  setInterpreted(null);
                }}
              >
                Use these interests in the form
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
