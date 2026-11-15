"use client";

import { TermsView } from "@/components/terms-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money, type Item, type Trade } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { control, closed } from "@/components/workspace/constants";

export default function TradesPage() {
  const {
    view,
    busy,
    form,
    tradeId,
    setTradeId,
    other,
    setOther,
    left,
    setLeft,
    right,
    setRight,
    ack,
    setAck,
    who,
    mine,
    trade,
    offer,
    name,
    submitOffer,
    act,
    toggle,
  } = useWorkspace();
  if (!view) return null;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[.65fr_1.35fr]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Your trades</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              setTradeId("");
              setLeft([]);
              setRight([]);
            }}
          >
            Compose a new offer
          </Button>
          <div className="mt-4 space-y-3">
            {view.trades.map((t) => (
              <button
                className={`block w-full rounded-lg border p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${t.id === tradeId ? "bg-secondary" : "bg-background"}`}
                key={t.id}
                onClick={() => {
                  setTradeId(t.id);
                  setAck(false);
                }}
              >
                <strong>
                  {name(t.participants.find((x) => x !== who)!)}
                </strong>
                <span className="mt-1 block text-muted-foreground">
                  {t.status.replaceAll("_", " ")} · offer{" "}
                  {t.offers.at(-1)?.version}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-6">
        {trade && offer && (
          <Card className="shadow-none">
            <CardHeader>
              <CardDescription>
                Current offer {offer.version} ·{" "}
                {trade.status.replaceAll("_", " ")}
              </CardDescription>
              <CardTitle>
                Exchange with{" "}
                {name(trade.participants.find((x) => x !== who)!)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TermsView terms={offer.terms} who={who!} />
              {trade.reason && (
                <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">
                  {trade.reason}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Consented: {offer.consents.map(name).join(", ")}.
                Handoff confirmations: {trade.handoffs.length}/2.
              </p>
              {!closed.includes(trade.status) && (
                <>
                  <label className="mt-4 block text-sm">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                      className="mr-2"
                    />
                    I reviewed all items and any unknown values or
                    value imbalance.
                  </label>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trade.status === "open" && (
                      <>
                        {offer.sender !== who ? (
                          <Button
                            disabled={busy || !ack}
                            onClick={() => act("accept")}
                          >
                            Accept exact terms
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              offer.sender === who
                                ? "withdraw"
                                : "decline",
                            )
                          }
                        >
                          {offer.sender === who
                            ? "Withdraw offer"
                            : "Decline offer"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            const terms = offer.terms;
                            setOther(
                              trade.participants.find(
                                (x) => x !== who,
                              )!,
                            );
                            setLeft(
                              (terms.left_owner === who
                                ? terms.left
                                : terms.right
                              ).map((x) => x.id),
                            );
                            setRight(
                              (terms.left_owner === who
                                ? terms.right
                                : terms.left
                              ).map((x) => x.id),
                            );
                          }}
                        >
                          Prepare counteroffer
                        </Button>
                      </>
                    )}
                    {["agreed", "awaiting_handoff"].includes(
                      trade.status,
                    ) && (
                      <>
                        <Button
                          disabled={
                            busy || trade.handoffs.includes(who!)
                          }
                          onClick={() => act("handoff")}
                        >
                          Confirm reported handoff
                        </Button>
                        <Button
                          variant="outline"
                          disabled={
                            busy || trade.cancellations.includes(who!)
                          }
                          onClick={() => act("cancel")}
                        >
                          Request cancellation
                        </Button>
                      </>
                    )}
                  </div>
                  <form
                    className="mt-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      const note = String(
                        new FormData(f).get("note") || "",
                      );
                      if (note.trim()) act("note", note);
                    }}
                  >
                    <label className="block text-sm">
                      Private trade note
                      <Textarea
                        className={control}
                        name="note"
                        required
                        maxLength={3000}
                      />
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={busy}
                    >
                      Send note
                    </Button>
                  </form>
                </>
              )}
              <div className="mt-5 border-t pt-4">
                <h3 className="text-sm font-medium">
                  Private history
                </h3>
                {trade.offers.map((o) => (
                  <p
                    key={o.version}
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    Offer {o.version} by {name(o.sender)} —{" "}
                    {o.version === offer.version
                      ? "current"
                      : "superseded"}{" "}
                    · {o.terms.left.map((x) => x.title).join(" + ")}{" "}
                    ↔ {o.terms.right.map((x) => x.title).join(" + ")}
                  </p>
                ))}
                {trade.notes.map((n, i) => (
                  <p
                    key={i}
                    className="mt-3 rounded-md bg-secondary/60 p-3 text-sm"
                  >
                    <strong>{name(n.sender)}:</strong> {n.text}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {(!trade || trade.status === "open") && (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                {trade ? "Counteroffer composer" : "Compose an offer"}
              </CardTitle>
              <CardDescription>
                One to three available items per side. Open offers
                reserve nothing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="block text-sm">
                Trade with
                <select
                  className={control}
                  value={other}
                  disabled={!!trade || busy}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setRight([]);
                  }}
                >
                  <option value="">Select a member</option>
                  {view.members
                    .filter((x) => x.id !== who)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {x.community}
                      </option>
                    ))}
                </select>
              </label>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {[
                  [
                    "left",
                    "You offer",
                    mine.filter((x) => x.status === "available"),
                  ],
                  [
                    "right",
                    "You receive",
                    view.items.filter(
                      (x) =>
                        x.owner === other && x.status === "available",
                    ),
                  ],
                ].map(([side, label, items]) => (
                  <fieldset key={String(side)} disabled={busy}>
                    <legend className="mb-3 text-sm font-medium">
                      {String(label)}
                    </legend>
                    {(items as Item[]).map((item) => (
                      <label
                        key={item.id}
                        className="mb-3 flex gap-2 rounded-md border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={(side === "left"
                            ? left
                            : right
                          ).includes(item.id)}
                          onChange={() =>
                            toggle(side as "left" | "right", item.id)
                          }
                        />
                        <span>
                          {item.title}
                          <span className="block text-xs text-muted-foreground">
                            {money(item.value_minor)} ·{" "}
                            {item.condition}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
              <label className="mt-4 block text-sm">
                <input
                  className="mr-2"
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I reviewed the selected items, comparison values, and
                any unknown value or imbalance. No cash is required.
              </label>
              <Button
                className="mt-4"
                disabled={
                  busy ||
                  !other ||
                  !left.length ||
                  !right.length ||
                  !ack
                }
                onClick={() => submitOffer(!!trade)}
              >
                {trade
                  ? "Submit counteroffer"
                  : "Submit reviewed offer"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
