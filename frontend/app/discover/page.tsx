"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListingItemRow, MemberListing } from "./_components/member-listing";
import { Compass, Package, Search, Sparkles } from "@/components/icons";
import { TermsView } from "@/components/terms-view";
import { useWorkspace } from "@/components/workspace/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  api,
  type Item,
  type Member,
  type Recommendation,
  type Recommendations,
} from "@/lib/marketplace";

type DiscoveryItem = {
  item: Item;
  matchedInterests: string[];
  recommended: boolean;
};

type MemberDiscovery = {
  member: Member;
  items: DiscoveryItem[];
  recommendations: Recommendation[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

function itemText(item: Item) {
  return [item.title, item.description, item.category, item.condition]
    .join(" ")
    .toLocaleLowerCase();
}

function matchingTerms(item: Item, terms: string[]) {
  const text = itemText(item);
  return terms.filter((term) => {
    const normalized = normalize(term);
    return normalized.length > 0 && text.includes(normalized);
  });
}

function recommendationIncomingItems(recommendation: Recommendation, who: string) {
  return recommendation.terms.left_owner === who
    ? recommendation.terms.right
    : recommendation.terms.left;
}

export default function DiscoverPage() {
  const {
    view,
    setTab,
    busy,
    results,
    setResults,
    semantic,
    setSemantic,
    setTradeId,
    setOther,
    setLeft,
    setRight,
    run,
    who,
  } = useWorkspace();
  const [query, setQuery] = useState("");

  const semanticAvailable =
    view.storage === "mongodb" &&
    view.integrations.bedrock_configured &&
    view.integrations.gemini_configured;
  const useSemantic = semanticAvailable && semantic;

  const memberDiscoveries = useMemo<MemberDiscovery[]>(() => {
    if (!who) return [];

    const recommendationsByMember = new Map<string, Recommendation[]>();
    const recommendedItemsByMember = new Map<string, Set<string>>();

    for (const recommendation of results?.recommendations ?? []) {
      const memberId = recommendation.member.id;
      recommendationsByMember.set(memberId, [
        ...(recommendationsByMember.get(memberId) ?? []),
        recommendation,
      ]);
      const itemIds = recommendedItemsByMember.get(memberId) ?? new Set<string>();
      for (const item of recommendationIncomingItems(recommendation, who)) {
        itemIds.add(item.id);
      }
      recommendedItemsByMember.set(memberId, itemIds);
    }

    return view.members
      .filter(
        (member) =>
          member.id !== who &&
          normalize(member.community) === normalize(view.profile.community),
      )
      .map((member) => {
        const recommendedIds = recommendedItemsByMember.get(member.id) ?? new Set<string>();
        const items = view.items
          .filter((item) => item.owner === member.id && item.status === "available")
          .map((item): DiscoveryItem | null => {
            const excluded = matchingTerms(item, view.profile.exclusions).length > 0;
            const matchedInterests = matchingTerms(item, view.profile.interests);
            const recommended = recommendedIds.has(item.id);

            if (excluded || (!matchedInterests.length && !recommended)) return null;
            return { item, matchedInterests, recommended };
          })
          .filter((entry): entry is DiscoveryItem => entry !== null)
          .sort((a, b) => {
            if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
            return a.item.title.localeCompare(b.item.title);
          });

        return {
          member,
          items,
          recommendations: recommendationsByMember.get(member.id) ?? [],
        };
      })
      .sort((a, b) => {
        if (a.recommendations.length !== b.recommendations.length) {
          return b.recommendations.length - a.recommendations.length;
        }
        if (a.items.length !== b.items.length) return b.items.length - a.items.length;
        return a.member.name.localeCompare(b.member.name);
      });
  }, [results, view.items, view.members, view.profile, who]);

  const filteredDiscoveries = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return memberDiscoveries;

    return memberDiscoveries
      .map((entry) => {
        const memberMatches = [entry.member.name, entry.member.community]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
        const items = memberMatches
          ? entry.items
          : entry.items.filter((candidate) =>
              itemText(candidate.item).includes(normalizedQuery),
            );
        const recommendations = entry.recommendations.filter((recommendation) =>
          [
            recommendation.explanation,
            ...recommendation.terms.left.map((item) => item.title),
            ...recommendation.terms.right.map((item) => item.title),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        );

        return {
          ...entry,
          items,
          recommendations: memberMatches ? entry.recommendations : recommendations,
        };
      })
      .filter(
        (entry) =>
          entry.items.length > 0 ||
          entry.recommendations.length > 0 ||
          entry.member.name.toLocaleLowerCase().includes(normalizedQuery),
      );
  }, [memberDiscoveries, query]);

  const visibleItemCount = filteredDiscoveries.reduce(
    (total, entry) => total + entry.items.length,
    0,
  );

  const composeWith = (memberId: string) => {
    setOther(memberId);
    setLeft([]);
    setRight([]);
    setTradeId("");
    setTab("trades");
  };

  if (!who) return null;

  return (
    <section aria-labelledby="discover-heading" className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            <Compass className="size-3.5" aria-hidden="true" />
            Preference-based discovery
          </Badge>
          <h2
            id="discover-heading"
            className="font-display text-3xl tracking-[-0.025em] sm:text-4xl"
          >
            People with things on your list
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse people in {view.profile.community} and the available items that
            fit your saved preferences. Other members&apos; private preferences are
            never shown here.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/preferences">Edit your preferences</Link>
        </Button>
      </div>

      <Card className="gap-5 shadow-none">
        <CardHeader className="gap-3">
          <CardTitle role="heading" aria-level={3}>
            Your discovery filters
          </CardTitle>
          <CardDescription>
            The item lists use your interests and hide listings that match your
            exclusions. Bundle eligibility is still checked by the server.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {view.profile.interests.length ? (
              view.profile.interests.map((interest) => (
                <Badge key={interest} tone="success">
                  Looking for {interest}
                </Badge>
              ))
            ) : (
              <Badge tone="warning">No interests saved</Badge>
            )}
            {view.profile.exclusions.map((exclusion) => (
              <Badge key={exclusion} variant="outline">
                Excluding {exclusion}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <div>
            <label htmlFor="member-search" className="mb-2 block text-sm font-medium">
              Search people or matching items
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="member-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try a name, category or item…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex h-11 items-center gap-3 rounded-md border px-3">
            <Switch
              id="semantic-discovery"
              checked={useSemantic}
              disabled={!semanticAvailable}
              onCheckedChange={setSemantic}
              aria-describedby="semantic-help"
            />
            <label htmlFor="semantic-discovery" className="text-sm font-medium">
              Semantic matching
            </label>
          </div>
          <Button
            className="h-11"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setResults(
                  await api<Recommendations>(
                    `recommendations?semantic=${useSemantic}`,
                  ),
                );
              })
            }
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Find bundle matches
          </Button>
          <p
            id="semantic-help"
            className="text-xs leading-5 text-muted-foreground lg:col-span-3"
          >
            {semanticAvailable
              ? useSemantic
                ? "Semantic matching is on. Equivalent wording can be considered by the configured providers."
                : "Exact-text matching is on. Turn on semantic matching to consider equivalent wording."
              : view.storage === "dynamodb"
                ? "Matching uses your saved interests as exact text. Semantic matching is not yet available with DynamoDB."
                : "Exact-text local testing is active. Semantic matching requires MongoDB Atlas, Bedrock and Gemini."}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-muted-foreground">
          {filteredDiscoveries.length} {filteredDiscoveries.length === 1 ? "person" : "people"}
          {" · "}
          {visibleItemCount} matching {visibleItemCount === 1 ? "item" : "items"}
        </p>
        {results && (
          <p className="text-sm text-muted-foreground">
            {results.recommendations.length} eligible bundle
            {results.recommendations.length === 1 ? "" : "s"} · {results.retrieval}
          </p>
        )}
      </div>

      {results?.reason === "MISSING_VALUATION" && (
        <p className="rounded-lg border bg-secondary/60 p-4 text-sm">
          Relevant items need comparison values before Bartr can qualify an
          automatic bundle. You can still inspect listings and compose a manual
          offer.
        </p>
      )}
      {results?.reason === "NO_MATCH" && (
        <p className="rounded-lg border bg-secondary/60 p-4 text-sm">
          No eligible bundle currently satisfies both members&apos; rules. The item
          list remains available for inspection or a manual offer.
        </p>
      )}

      {filteredDiscoveries.length ? (
        <ul className="w-full space-y-5" aria-label="Members and their matching items" role="list">
          {filteredDiscoveries.map(({ member, items, recommendations }) => (
            <li key={member.id} className="min-w-0">
              <MemberListing
                member={member}
                itemCount={items.length}
                matching
                action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => composeWith(member.id)}
                    >
                      Build an offer
                    </Button>
                }
              >
                <CardContent className="p-0">
                  <div className="border-b px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:px-6">
                    Available items that fit your preferences
                  </div>
                  {items.length ? (
                    <ul className="divide-y" aria-label={`${member.name}'s matching items`} role="list">
                      {items.map((entry) => (
                        <ListingItemRow key={entry.item.id} {...entry} />
                      ))}
                    </ul>
                  ) : (
                    <Empty className="rounded-none border-0 py-10">
                      <EmptyMedia variant="icon">
                        <Package aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyContent>
                        <EmptyTitle>No preference matches yet</EmptyTitle>
                        <EmptyDescription>
                          This member has no available listing matching your saved
                          interests, or the matching listing is excluded.
                        </EmptyDescription>
                      </EmptyContent>
                    </Empty>
                  )}

                  {recommendations.length > 0 && (
                    <div className="border-t bg-secondary/20 px-5 py-6 sm:px-6">
                      <div className="mb-4">
                        <h4 className="font-medium">Eligible bundle suggestions</h4>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Suggestions are advisory. Reviewing or dismissing one does
                          not submit an offer, record consent or reserve an item.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {recommendations.map((recommendation) => (
                          <article
                            key={recommendation.id}
                            className="rounded-xl border bg-background p-4 sm:p-5"
                          >
                            <TermsView terms={recommendation.terms} who={who} />
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                              {recommendation.explanation}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setOther(member.id);
                                  setLeft(
                                    (recommendation.terms.left_owner === who
                                      ? recommendation.terms.left
                                      : recommendation.terms.right
                                    ).map((item) => item.id),
                                  );
                                  setRight(
                                    (recommendation.terms.left_owner === who
                                      ? recommendation.terms.right
                                      : recommendation.terms.left
                                    ).map((item) => item.id),
                                  );
                                  setTradeId("");
                                  setTab("trades");
                                }}
                              >
                                Review proposal
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    await api("recommendations/dismiss", "POST", {
                                      id: recommendation.id,
                                    });
                                    if (!results) return;
                                    setResults({
                                      ...results,
                                      recommendations: results.recommendations.filter(
                                        (candidate) => candidate.id !== recommendation.id,
                                      ),
                                    });
                                  })
                                }
                              >
                                Dismiss
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </MemberListing>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="border">
          <EmptyMedia variant="icon">
            <Search aria-hidden="true" />
          </EmptyMedia>
          <EmptyContent>
            <EmptyTitle>No people or items match this search</EmptyTitle>
            <EmptyDescription>
              Clear the search or update your interests to broaden the discovery
              list.
            </EmptyDescription>
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}
