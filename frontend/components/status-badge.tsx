import { Badge } from "@/components/ui/badge";
import {
  itemStatusLabel,
  tradeStatusLabel,
  type Item,
} from "@/lib/marketplace";

const itemTone = {
  draft: "neutral",
  available: "success",
  reserved: "warning",
  exchanged: "info",
  removed: "neutral",
} as const;

export function ItemStatusBadge({ status }: { status: Item["status"] }) {
  return (
    <Badge tone={itemTone[status]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {itemStatusLabel(status)}
    </Badge>
  );
}

const tradeTone: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  open: "info",
  agreed: "success",
  awaiting_handoff: "warning",
  completed: "success",
  declined: "neutral",
  withdrawn: "neutral",
  invalidated: "danger",
  cancelled: "neutral",
};

export function TradeStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={tradeTone[status] ?? "neutral"}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {tradeStatusLabel(status)}
    </Badge>
  );
}
