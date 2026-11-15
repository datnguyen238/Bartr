import { money, type Item, type Terms } from "@/lib/marketplace";

export function TermsView({ terms, who }: { terms: Terms; who: string }) {
  const outgoing = terms.left_owner === who ? terms.left : terms.right,
    incoming = terms.left_owner === who ? terms.right : terms.left;
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["You offer", outgoing],
          ["You receive", incoming],
        ].map(([label, items]) => (
          <div className="rounded-lg bg-secondary/60 p-4" key={String(label)}>
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              {String(label)}
            </p>
            {(items as Item[]).map((item) => (
              <div key={item.id} className="mb-3">
                {item.image_id && (
                  <img
                    src={`/api/images/${item.image_id}`}
                    alt={item.title}
                    className="mb-2 h-24 w-full rounded-md object-contain"
                  />
                )}
                <p className="text-sm font-medium">
                  {item.title} · {money(item.value_minor)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.description} · {item.condition}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.value_source} ·{" "}
                  {item.value_set_at
                    ? new Date(item.value_set_at).toLocaleString()
                    : "Value unknown"}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm">
        You offer{" "}
        {money(
          terms.left_owner === who
            ? terms.left_total_minor
            : terms.right_total_minor,
        )}{" "}
        · You receive{" "}
        {money(
          terms.left_owner === who
            ? terms.right_total_minor
            : terms.left_total_minor,
        )}{" "}
        · Gap:{" "}
        {terms.gap_percent === null
          ? "unknown"
          : `${terms.gap_percent.toFixed(1)}%`}
      </p>
      {terms.value_warning && (
        <p className="mt-2 text-sm text-destructive">
          Unknown values or a gap beyond a participant’s recommendation limit.
          Explicit review is required; estimates never obligate acceptance.
        </p>
      )}
    </div>
  );
}
