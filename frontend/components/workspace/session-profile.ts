import type { Profile } from "@/lib/marketplace";

export type ProfileDraft = {
  name: string;
  community: string;
  interests: string;
  exclusions: string;
  gap_limit: number;
};
export type DraftRevisions = { account: number; preferences: number };

const sections = {
  account: ["name", "community"],
  preferences: ["interests", "exclusions", "gap_limit"],
} as const;

export function profileDraft(profile: Profile): ProfileDraft {
  return {
    name: profile.name, community: profile.community,
    interests: profile.interests.join(", "), exclusions: profile.exclusions.join(", "),
    gap_limit: profile.gap_limit,
  };
}

export function reconcileProfileDraft(
  draft: ProfileDraft, previous: Profile, incoming: Profile, reviewed: DraftRevisions,
) {
  const before = profileDraft(previous);
  const saved = profileDraft(incoming);
  const nextDraft = { ...draft };
  const revisions = { ...reviewed };
  for (const section of ["account", "preferences"] as const) {
    const keys = sections[section];
    const dirty = keys.some((key) => draft[key] !== before[key]);
    const changed = keys.some((key) => before[key] !== saved[key]);
    if (!dirty) {
      if (section === "account") Object.assign(nextDraft, { name: saved.name, community: saved.community });
      else Object.assign(nextDraft, { interests: saved.interests, exclusions: saved.exclusions, gap_limit: saved.gap_limit });
    }
    // Once an external edit made a dirty section stale, later refreshes cannot
    // silently make it current again without the member reviewing that section.
    if (!dirty || (!changed && reviewed[section] === previous.revision)) {
      revisions[section] = incoming.revision;
    }
  }
  return { draft: nextDraft, revisions };
}
