import { money, type Item, type Terms } from "@/lib/marketplace";

export function TermsView({ terms, who }: { terms: Terms; who: string }) {
  const outgoing = terms.left_owner === who ? terms.left : terms.right,
    incoming = terms.left_owner === who ? terms.right : terms.left;
  return (
    <div className="min-w-0">
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        {[
          ["You offer", outgoing],
          ["You receive", incoming],
        ].map(([label, items]) => (
          <section className="min-w-0" aria-label={String(label)} key={String(label)}>
            <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
              {String(label)}
            </h3>
            <ul className="divide-y">
            {(items as Item[]).map((item) => (
              <li key={item.id} className="flex min-w-0 items-start gap-3 py-3">
                {item.image_id && (
                  <img
                    src={`/api/images/${item.image_id}`}
                    alt={item.title}
                    className="size-16 shrink-0 rounded-lg bg-secondary/40 object-contain"
                  />
                )}
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium leading-5">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.condition}</p>
                  <p className="mt-1 text-sm tabular-nums">{money(item.value_minor)}</p>
                </div>
              </li>
            ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-2 border-t pt-4 text-sm leading-6 text-muted-foreground tabular-nums">
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
        <p className="mt-2 rounded-lg bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Values are missing or the gap exceeds a member’s limit. Review before agreeing.
        </p>
      )}
    </div>
  );
}
