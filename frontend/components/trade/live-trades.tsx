"use client";

import { TermsView } from "@/components/terms-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { money, type Item, type Trade } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { control, closed } from "@/components/workspace/constants";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, Plus, Send, ShieldCheck } from "lucide-react";

export default function TradesPage() {
  const [connection, setConnection] = useState("Connecting");
  const [counterEditing, setCounterEditing] = useState(false);
  const {
    view,
    hasSession,
    setView,
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
  useEffect(() => { setAck(false); setCounterEditing(false); }, [tradeId, offer?.version, setAck]);
  useEffect(() => {
    if (!hasSession || !tradeId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let socket: WebSocket;
    function connect() {
      if (stopped) return;
      setConnection("Connecting");
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${scheme}//${window.location.host}/api/trades/${encodeURIComponent(tradeId)}/live`);
      socket.onopen = () => setConnection("Live");
      socket.onmessage = (event) => {
        try {
          const incoming = JSON.parse(event.data) as Trade;
          if (incoming.id !== tradeId || typeof incoming.revision !== "number") return;
          setView((current) => current ? { ...current, trades: current.trades.map((item) =>
            item.id === incoming.id && item.revision <= incoming.revision ? incoming : item) } : current);
        } catch { setConnection("Invalid update"); }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (!stopped) { setConnection("Reconnecting"); timer = setTimeout(connect, 3000); }
      };
    }
    connect();
    return () => { stopped = true; clearTimeout(timer); socket?.close(); };
  }, [tradeId, hasSession, setView]);
  if (!view) return null;
  const partner = trade?.participants.find((id) => id !== who);
  const editingOffer = !trade || (trade.status === "open" && counterEditing);
  const options: ["left" | "right", string, Item[]][] = [
    ["left", "Your items", mine.filter((item) => item.status === "available")],
    ["right", partner ? `${name(partner)}’s items` : "Their items", view.items.filter((item) => item.owner === other && item.status === "available")],
  ];
  function prepareCounter() {
    if (!trade || !offer || !partner) return;
    setCounterEditing(true);
    setOther(partner);
    setLeft((offer.terms.left_owner === who ? offer.terms.left : offer.terms.right).map((item) => item.id));
    setRight((offer.terms.left_owner === who ? offer.terms.right : offer.terms.left).map((item) => item.id));
    setAck(false);
  }
  return (
    <div className="space-y-6 pt-6">
      <header className="screen-heading">
        <h1 className="screen-title">Trades</h1>
        <p className="screen-description">Choose items, talk it through, and agree together.</p>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Trade list" className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Your trades</h2><span className="text-xs text-muted-foreground">{view.trades.length}</span></div>
          <Button variant="outline" className="mt-4 w-full justify-start" onClick={() => { setCounterEditing(false); setTradeId(""); setOther(""); setLeft([]); setRight([]); setAck(false); }}><Plus aria-hidden="true" /> New offer</Button>
          <nav aria-label="Trade conversations" className="mt-4 flex gap-2 overflow-x-auto lg:max-h-[65vh] lg:flex-col lg:overflow-y-auto">
            {view.trades.map((t) => <button type="button" key={t.id} aria-current={t.id === tradeId ? "true" : undefined} className={`min-w-40 rounded-xl px-3 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full ${t.id === tradeId ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`} onClick={() => { setCounterEditing(false); setTradeId(t.id); setOther(""); setLeft([]); setRight([]); setAck(false); }}><span className="block truncate font-medium">{name(t.participants.find((id) => id !== who)!)}</span><span className="mt-1 block text-xs opacity-70">{t.status.replaceAll("_", " ")} · offer {t.offers.at(-1)?.version}</span></button>)}
            {!view.trades.length && <p className="px-1 py-2 text-sm text-muted-foreground">No trades yet.</p>}
          </nav>
        </aside>
        <div className="grid min-w-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
        <Card className="gap-0 overflow-hidden rounded-2xl shadow-none">
          <CardHeader className="border-b pb-5"><CardDescription className="flex items-center gap-2">{trade ? `Offer ${offer?.version} · ${trade.status.replaceAll("_", " ")}` : "New offer"}</CardDescription><CardTitle className="text-xl">{partner ? `Exchange with ${name(partner)}` : "Choose your exchange"}</CardTitle>{editingOffer && <p className="text-sm text-muted-foreground">Choose up to three items on each side, then send your offer.</p>}</CardHeader>
          <CardContent className="space-y-5 pt-5">
            {!trade && <label className="block text-sm">Trade with<select className={control} value={other} disabled={busy} onChange={(e) => { setOther(e.target.value); setRight([]); }}><option value="">Select a member</option>{view.members.filter((member) => member.id !== who).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.community}</option>)}</select></label>}
            {trade && offer && !editingOffer && <TermsView terms={offer.terms} who={who!} />}
            {editingOffer && <div className="grid gap-4 sm:grid-cols-2">{options.map(([side, label, items]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded-xl border bg-secondary/30 p-3"><legend className="px-1 text-sm font-semibold">{label}</legend><p className="mb-3 text-xs text-muted-foreground">{(side === "left" ? left : right).length}/3 selected</p><div className="max-h-72 space-y-2 overflow-y-auto">{items.map((item) => { const selected = (side === "left" ? left : right).includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${selected ? "border-foreground bg-background" : "bg-card hover:bg-background"}`}><input type="checkbox" className="mt-1 accent-foreground" checked={selected} onChange={() => toggle(side, item.id)} /><span className="min-w-0"><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{money(item.value_minor)} · {item.condition}</span></span></label>; })}{!items.length && <p className="p-3 text-sm text-muted-foreground">{side === "right" && !other ? "Choose a member first." : "No available items."}</p>}</div></fieldset>)}</div>}
            {trade && offer && <div className="rounded-xl border bg-secondary/20 p-4 sm:p-5" aria-label="Agreement on current offer" aria-live="polite"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-background"><ShieldCheck className="size-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">Agreement</p><p className="text-xs text-muted-foreground">Offer {offer.version}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{trade.participants.map((id) => { const agreed = offer.consents.includes(id); return <div key={id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm"><span className={agreed ? "text-emerald-700" : "text-muted-foreground"}>{agreed ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}</span><span className="min-w-0 truncate font-medium">{id === who ? "You" : name(id)}</span><span className="ml-auto text-xs text-muted-foreground">{agreed ? "Agreed" : "Waiting"}</span></div>; })}</div>{["agreed", "awaiting_handoff", "completed"].includes(trade.status) && <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-4" aria-hidden="true" /> Handoff confirmed by {trade.handoffs.length} of 2 participants</p>}</div>}
            {trade?.reason && <p className="rounded-lg bg-secondary p-3 text-sm">{trade.reason}</p>}
            {(!trade || trade.status === "open") && <><label className="flex items-start gap-3 text-sm leading-5"><input className="mt-0.5 size-4 shrink-0" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I reviewed the items and any unknown values or imbalance.</label><div className="flex flex-wrap gap-2">{editingOffer ? <Button disabled={busy || !other || !left.length || !right.length || !ack} onClick={() => submitOffer(!!trade)}>{trade ? "Send counteroffer" : "Send offer"}</Button> : <>{offer?.sender !== who && <Button disabled={busy || !ack} onClick={() => act("accept")}>Accept exact terms</Button>}<Button variant="outline" disabled={busy} onClick={prepareCounter}>Change items</Button><Button variant="outline" disabled={busy} onClick={() => act(offer?.sender === who ? "withdraw" : "decline")}>{offer?.sender === who ? "Withdraw" : "Decline"}</Button></>}</div></>}
            {trade && ["agreed", "awaiting_handoff"].includes(trade.status) && <div className="flex flex-wrap gap-2"><Button disabled={busy || trade.handoffs.includes(who!)} onClick={() => act("handoff")}>{trade.handoffs.includes(who!) ? "Handoff confirmed" : "Confirm reported handoff"}</Button><Button variant="outline" disabled={busy || trade.cancellations.includes(who!)} onClick={() => act("cancel")}>Request cancellation</Button></div>}
          </CardContent>
        </Card>
        <Card className="flex min-h-[560px] flex-col gap-0 overflow-hidden rounded-2xl shadow-none"><CardHeader className="border-b pb-5"><CardTitle className="flex items-center gap-2 text-xl">Conversation</CardTitle><CardDescription>{trade ? `${name(partner!)} · ${hasSession ? connection : "Demo"}` : "Select a trade to start a conversation"}</CardDescription></CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0"><div className="flex-1 space-y-4 overflow-y-auto bg-secondary/20 p-5" role="log" aria-label="Trade messages" aria-live="polite">{trade?.offers.slice(0, -1).map((o) => <p key={o.version} className="mx-auto max-w-sm rounded-lg bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">Offer {o.version} by {name(o.sender)} · superseded · {o.terms.left.map((item) => item.title).join(" + ")} ↔ {o.terms.right.map((item) => item.title).join(" + ")}</p>)}{trade?.notes.length ? trade.notes.map((note, i) => <div key={`${note.created_at}-${i}`} className={`flex ${note.sender === who ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${note.sender === who ? "bg-primary text-primary-foreground" : "border bg-card"}`}><p className="mb-1 text-xs opacity-70">{note.sender === who ? "You" : name(note.sender)} · {new Date(note.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap break-words">{note.text}</p></div></div>) : <p className="py-16 text-center text-sm text-muted-foreground">{trade ? "No messages yet. Say hello and discuss your exchange." : "Your messages will appear here."}</p>}</div>
          {trade && !closed.includes(trade.status) && <form className="border-t p-4" onSubmit={(e) => { e.preventDefault(); const note = String(new FormData(e.currentTarget).get("note") || ""); if (!busy && note.trim()) act("note", note); }}><label htmlFor="trade-message" className="sr-only">Message</label><div className="relative"><Input id="trade-message" name="note" placeholder="Write a message…" required maxLength={3000} className="h-12 rounded-full pr-14" /><Button type="submit" variant="ghost" size="icon" disabled={busy} aria-label="Send message" className="absolute right-1 top-1 size-10 rounded-full bg-transparent hover:bg-transparent"><Send aria-hidden="true" /></Button></div><p className="mt-2 text-xs text-muted-foreground">Private to both participants</p></form>}</CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
