"use client";

import { useId, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { ArrowRight, Package } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { money, type Item, type Member } from "@/lib/marketplace";

export function MemberListing({
  member,
  itemCount,
  own = false,
  matching = false,
  action,
  children,
}: {
  member: Member;
  itemCount: number;
  own?: boolean;
  matching?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <Card
      role="article"
      aria-labelledby={headingId}
      className="w-full min-w-0 gap-0 overflow-hidden py-0 shadow-none"
    >
      <CardHeader className="border-b bg-secondary/30 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.name} tone="light" className="size-10" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={headingId} className="break-words text-base font-semibold">
                  {member.name}
                </h3>
                {own && <Badge variant="outline">Your listings</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">
              {itemCount} {matching ? "matching" : "available"}{" "}
              {itemCount === 1 ? "item" : "items"}
            </Badge>
            {action}
          </div>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export function ListingItemRow({
  item,
  matchedInterests = [],
  recommended = false,
  onOpen,
}: {
  item: Item;
  matchedInterests?: string[];
  recommended?: boolean;
  onOpen?: (item: Item, trigger: HTMLButtonElement) => void;
}) {
  return (
    <li className="flex min-w-0 items-start gap-4 px-4 py-4 sm:px-5">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-secondary sm:size-20">
        {item.image_id ? (
          <img
            src={`/api/images/${item.image_id}`}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <Package className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h4 className="min-w-0 flex-1 break-words text-sm font-semibold leading-5">
            {item.title || "Untitled item"}
          </h4>
          <p className="shrink-0 text-sm font-semibold">{money(item.value_minor)}</p>
        </div>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
          {item.category || "Uncategorized"} · {item.condition || "Condition not provided"}
        </p>
        {(matchedInterests.length > 0 || recommended) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {matchedInterests.map((interest) => (
              <Badge key={interest} variant="secondary" className="max-w-full whitespace-normal break-words">
                Matches {interest}
              </Badge>
            ))}
            {recommended && matchedInterests.length === 0 && (
              <Badge tone="info">Recommended match</Badge>
            )}
          </div>
        )}
        {!onOpen && <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {item.value_minor === null
              ? "Comparison value not set"
              : item.value_source === "owner"
                ? "Owner-entered estimate"
                : "Assisted estimate"}
            {item.value_set_at && (
              <> · {new Date(item.value_set_at).toLocaleDateString()}</>
            )}
          </p>}
        {onOpen && (
          <Button
            size="sm"
            variant="ghost"
            className="-ml-2 mt-1 h-8 gap-1 px-2 text-xs"
            aria-label={`View details for ${item.title || "item"}`}
            onClick={(event) => onOpen(item, event.currentTarget)}
          >
            View details <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}
