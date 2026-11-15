"use client";

import { useId, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Package } from "@/components/icons";
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
      <CardHeader className="border-b bg-secondary/40 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.name} tone="light" className="size-12" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={headingId} className="break-words text-lg font-semibold">
                  {member.name}
                </h3>
                {own && <Badge variant="outline">Your listings</Badge>}
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {member.community}
              </p>
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
    <li className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-5 sm:gap-x-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-secondary sm:size-24">
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

      <div className="min-w-0">
        <h4 className="break-words text-base font-semibold leading-6">
          {item.title || "Untitled item"}
        </h4>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
          {item.category || "Uncategorized"} · {item.condition || "Condition not provided"}
        </p>
        {item.description && (
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {item.description}
          </p>
        )}
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
      </div>

      <div className="col-start-2 flex min-w-0 flex-col items-start gap-2 lg:col-start-3 lg:row-start-1 lg:max-w-52 lg:items-end lg:text-right">
        <div>
          <p className="text-base font-semibold">{money(item.value_minor)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {item.value_minor === null
              ? "Comparison value not set"
              : item.value_source === "owner"
                ? "Owner-entered estimate"
                : "Assisted estimate"}
            {item.value_set_at && (
              <> · {new Date(item.value_set_at).toLocaleDateString()}</>
            )}
          </p>
          {item.uncertainty && (
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
              {item.uncertainty}
            </p>
          )}
        </div>
        {onOpen && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1"
            aria-label={`View details for ${item.title || "item"}`}
            onClick={(event) => onOpen(item, event.currentTarget)}
          >
            View details
          </Button>
        )}
      </div>
    </li>
  );
}
