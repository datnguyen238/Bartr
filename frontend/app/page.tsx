"use client";

import Link from "next/link";
import localFont from "next/font/local";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListingItemRow, MemberListing } from "./discover/_components/member-listing";
import { Discovery } from "./discover/_components/discovery";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace/provider";
import {
  ArrowRight,
  Compass,
  Handshake,
  Lock,
  Package,
  Search,
  Shield,
} from "@/components/icons";
import { money, type Item } from "@/lib/marketplace";

const handshakeFont = localFont({
  src: "./fonts/handlee.ttf",
  weight: "400",
  display: "swap",
  fallback: ["Segoe Print", "Comic Sans MS", "cursive"],
});

const fieldClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-shadow focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

function BrowseSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading available items</span>
      <div className="w-full space-y-5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-3 border-b p-5">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-4 p-5">
              <Skeleton className="size-16 shrink-0 rounded-lg sm:size-24" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const {
    view,
    hasSession,
    seeded,
    loading,
    error,
    run,
    load,
  } = useWorkspace();
  const [browseView, setBrowseView] = useState<"all" | "matches">("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [condition, setCondition] = useState("Any condition");
  const [sort, setSort] = useState("title");
  const [selected, setSelected] = useState<Item | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "matches") setBrowseView("matches");
  }, []);

  useEffect(() => {
    if (!selected && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [selected]);

  const browsing = hasSession || seeded;
  const memberById = useMemo(
    () => new Map(view.members.map((member) => [member.id, member])),
    [view.members],
  );
  const availableItems = useMemo(
    () => view.items.filter((item) => item.status === "available"),
    [view.items],
  );
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          availableItems
            .map((item) => item.category.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    ],
    [availableItems],
  );
  const conditions = useMemo(
    () => [
      "Any condition",
      ...Array.from(
        new Set(
          availableItems
            .map((item) => item.condition.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    ],
    [availableItems],
  );
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = availableItems.filter((item) => {
      const owner = memberById.get(item.owner);
      const matchesQuery =
        !needle ||
        [item.title, item.description, item.category, item.condition, owner?.name]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(needle));
      const matchesCategory =
        category === "All" || item.category === category;
      const matchesCondition =
        condition === "Any condition" || item.condition === condition;
      return matchesQuery && matchesCategory && matchesCondition;
    });
    return result.sort((a, b) => {
      if (sort === "value-high" || sort === "value-low") {
        if (a.value_minor === null && b.value_minor === null) {
          return a.title.localeCompare(b.title);
        }
        if (a.value_minor === null) return 1;
        if (b.value_minor === null) return -1;
        return sort === "value-high"
          ? b.value_minor - a.value_minor
          : a.value_minor - b.value_minor;
      }
      return a.title.localeCompare(b.title);
    });
  }, [availableItems, category, condition, memberById, query, sort]);

  const memberListings = useMemo(() => {
    const grouped = new Map<string, Item[]>();
    for (const item of filteredItems) {
      const items = grouped.get(item.owner);
      if (items) items.push(item);
      else grouped.set(item.owner, [item]);
    }
    return Array.from(grouped, ([owner, items]) => ({
      member: memberById.get(owner) ?? {
        id: owner,
        name: "Member",
        community: view.profile.community,
      },
      items,
    }));
  }, [filteredItems, memberById, view.profile.community]);

  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setCondition("Any condition");
    setSort("title");
  };
  const openItem = (item: Item, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelected(item);
  };
  const closeItem = () => {
    restoreFocus.current = true;
    setSelected(null);
  };
  const selectedOwner = selected ? memberById.get(selected.owner) : undefined;

  return (
    <div className="min-h-screen bg-background">
      {!hasSession && <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm text-muted-foreground md:col-start-2 md:flex"
          >
            <a className="transition-colors hover:text-foreground" href="#browse">
              Browse items
            </a>
            <a className="transition-colors hover:text-foreground" href="#how-it-works">
              How it works
            </a>
            <a className="transition-colors hover:text-foreground" href="#trust">
              Why Bartr
            </a>
          </nav>
          <div className="flex items-center gap-2 md:col-start-3 md:justify-self-end">
            {browsing ? (
              <>
                <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
                  {view.profile.name}
                </span>
                <Button asChild>
                  <Link href="/discover">
                    Open Discover
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/register">Join Bartr</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>}

      <main>
        <section className="mx-auto max-w-6xl px-4 py-6 text-center sm:px-6 sm:py-8">
          <h1 className={`${handshakeFont.className} text-[clamp(3.5rem,8vw,7rem)] font-normal leading-[1.2] tracking-normal text-balance`}>
            Bart<span className="opacity-25">e</span>r.
          </h1>
        </section>

        <section
          id="browse"
          aria-labelledby="browse-heading"
          className="scroll-mt-20 border-y bg-card/40"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="caption mb-3">Browse</p>
                <h2
                  id="browse-heading"
                  className="font-display text-4xl tracking-[-0.03em] sm:text-5xl"
                >
                  Available to trade
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {browsing
                    ? "Browse items available to trade. Open an item to see its details."
                    : "Sign in to browse published listings and members."}
                </p>
              </div>
              {browsing && browseView === "all" && !loading && (
                <p role="status" className="text-sm text-muted-foreground">
                  {filteredItems.length}{" "}
                  {filteredItems.length === 1 ? "item" : "items"} from{" "}
                  {memberListings.length}{" "}
                  {memberListings.length === 1 ? "member" : "members"}
                </p>
              )}
            </div>

            {browsing && (
              <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Browse view">
                <Button size="sm" variant={browseView === "all" ? "default" : "outline"} aria-pressed={browseView === "all"} onClick={() => setBrowseView("all")}>All items</Button>
                <Button size="sm" variant={browseView === "matches" ? "default" : "outline"} aria-pressed={browseView === "matches"} onClick={() => setBrowseView("matches")}>Your matches</Button>
              </div>
            )}

            {seeded && (
              <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/60 p-3 text-sm">
                <Badge tone="warning">Demo fixtures</Badge>
                <span className="text-muted-foreground">
                  These items are fictional display data. Trades and saved
                  changes are disabled in this mode.
                </span>
              </div>
            )}

            {error && !browsing && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Live listings are temporarily unavailable</AlertTitle>
                <AlertDescription>
                  <span>{error}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      run(async () => {
                        await load();
                      });
                    }}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {browsing && browseView === "matches" ? (
              <div className="mt-8"><Discovery /></div>
            ) : loading ? (
              <div className="mt-8">
                <BrowseSkeleton />
              </div>
            ) : !browsing ? (
              <div className="mt-8">
                <Card className="border-dashed bg-background/60">
                  <CardContent className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary">
                        <Lock className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-display text-2xl">
                          Sign in to browse live items
                        </h3>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                          Published listings are visible to signed-in members. Drafts, preferences and private
                          negotiations stay private to their owners and
                          participants. Sign in to see what people near you are
                          ready to trade.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <Link href="/sign-in?next=%2F%23browse">Sign in</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/register">Create an account</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <div className="mt-8 grid gap-3 rounded-xl border bg-background p-3 sm:p-4 md:grid-cols-[1fr_auto_auto]">
                  <div>
                    <label htmlFor="browse-search" className="sr-only">
                      Search available items
                    </label>
                    <Input
                      id="browse-search"
                      className="h-11"
                      placeholder="Search titles, descriptions or members…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="browse-condition" className="sr-only">
                      Filter by condition
                    </label>
                    <select
                      id="browse-condition"
                      className={fieldClass}
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                    >
                      {conditions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="browse-sort" className="sr-only">
                      Sort available items
                    </label>
                    <select
                      id="browse-sort"
                      className={fieldClass}
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="title">Title A–Z</option>
                      <option value="value-high">Value: high to low</option>
                      <option value="value-low">Value: low to high</option>
                    </select>
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Categories"
                >
                  {categories.map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={category === value ? "default" : "outline"}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>

                {filteredItems.length ? (
                  <ul className="mt-6 w-full space-y-5" aria-label="Members and their available items" role="list">
                    {memberListings.map(({ member, items }) => (
                      <li key={member.id} className="min-w-0">
                        <MemberListing
                          member={member}
                          itemCount={items.length}
                          own={member.id === view.profile.id}
                        >
                          <ul className="divide-y" aria-label={`${member.name}'s available items`} role="list">
                            {items.map((item) => (
                              <ListingItemRow key={item.id} item={item} onOpen={openItem} />
                            ))}
                          </ul>
                        </MemberListing>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty className="mt-6 border bg-background/60">
                    <EmptyContent>
                      <EmptyTitle>
                        {availableItems.length
                          ? "No items match these filters"
                          : "No items are listed yet"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {availableItems.length
                          ? "Try a different search, category or condition."
                          : "Be the first to list an item."}
                      </EmptyDescription>
                      {availableItems.length ? (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link href="/inventory">List an item</Link>
                        </Button>
                      )}
                    </EmptyContent>
                  </Empty>
                )}
              </>
            )}
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
          <div className="max-w-2xl">
            <p className="caption mb-3">How it works</p>
            <h2
              id="how-heading"
              className="font-display text-4xl tracking-[-0.03em] sm:text-5xl"
            >
              How trading works
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Trade one or more items with another member.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Package,
                step: "01",
                title: "List what you have",
                copy: "Add the things you are ready to part with, with a photo, condition and an optional comparison value.",
              },
              {
                icon: Search,
                step: "02",
                title: "Say what you need",
                copy: "Save specific products and broad categories, plus exclusions for anything you do not want.",
              },
              {
                icon: Compass,
                step: "03",
                title: "Find a bundle",
                copy: "Browse items and matches, then review and propose an offer.",
              },
            ].map(({ icon: Icon, step, title, copy }) => (
              <Card key={step} className="shadow-none">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-secondary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl text-muted-foreground/50">
                      {step}
                    </span>
                  </div>
                  <CardTitle
                    role="heading"
                    aria-level={3}
                    className="mt-2 text-xl"
                  >
                    {title}
                  </CardTitle>
                  <CardDescription className="leading-6">{copy}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="trust"
          aria-labelledby="trust-heading"
          className="scroll-mt-20 border-t bg-secondary/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div>
                <p className="caption mb-3">Why Bartr</p>
                <h2
                  id="trust-heading"
                  className="font-display text-4xl tracking-[-0.03em] sm:text-5xl"
                >
                  Your items stay yours until you agree.
                </h2>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Suggestions are advisory. An offer becomes an agreement only
                  when both participants consent to the same current version.
                  Acceptance reserves the included items together, or not at
                  all.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Handshake,
                    title: "Mutual consent",
                    copy: "The sender consents to submit. The other member must review and accept the exact terms.",
                  },
                  {
                    icon: Shield,
                    title: "No double commitments",
                    copy: "An item cannot be reserved by two agreements. Overlapping acceptances resolve without a partial trade.",
                  },
                  {
                    icon: Lock,
                    title: "Private negotiation",
                    copy: "Only the two participants can read notes, offer history and agreement details.",
                  },
                  {
                    icon: Handshake,
                    title: "Reports, not guesses",
                    copy: "Completion needs both handoff confirmations. No timer or AI action completes a trade.",
                  },
                ].map(({ icon: Icon, title, copy }) => (
                  <div key={title} className="rounded-xl border bg-background p-5">
                    <Icon className="size-5 text-accent-warm" aria-hidden="true" />
                    <h3 className="mt-4 font-medium">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Card className="overflow-hidden border-foreground/10 bg-primary text-primary-foreground">
            <CardContent className="flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center sm:p-10">
              <div>
                <h2 className="font-display mt-2 text-3xl tracking-[-0.03em] sm:text-4xl">
                  Get started
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">
                  List items and discover what others are offering.
                  Nothing is committed until you and the other member agree.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {browsing ? (
                  <Button variant="secondary" size="lg" asChild>
                    <Link href="/inventory">List an item</Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" size="lg" asChild>
                      <Link href="/register">Create an account</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                      asChild
                    >
                      <Link href="/sign-in">Sign in</Link>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closeItem();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {selected.title}
                </DialogTitle>
                <DialogDescription>
                  {selected.category || "Uncategorized"} · {selected.condition}
                </DialogDescription>
              </DialogHeader>
              {selected.image_id && (
                <img
                  src={`/api/images/${selected.image_id}`}
                  alt={selected.title}
                  className="max-h-72 w-full rounded-lg object-contain"
                />
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                {selected.description}
              </p>
              <dl className="grid gap-4 rounded-lg bg-secondary/60 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Comparison value</dt>
                  <dd className="mt-1 font-medium">{money(selected.value_minor)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Value source</dt>
                  <dd className="mt-1 font-medium capitalize">
                    {selected.value_basis === "image_assisted_estimate" ? "AI estimate · no comparable listings" : selected.value_source}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last set</dt>
                  <dd className="mt-1 font-medium">
                    {selected.value_set_at
                      ? new Date(selected.value_set_at).toLocaleDateString()
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Listed by</dt>
                  <dd className="mt-1 font-medium">
                    {selectedOwner?.name ?? "Member"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">
                Estimated values are advisory. They do not establish fairness or
                require a cash difference.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={closeItem}>
                  Keep browsing
                </Button>
                {browsing ? (
                  <Button asChild>
                    <Link href="/trades">Compose an offer</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/sign-in?next=%2Ftrades">Sign in to propose</Link>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
