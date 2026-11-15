"use client";

import { TermsView } from "@/components/terms-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { money, type Item, type Trade } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";
import { closed } from "@/components/workspace/constants";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, Send } from "lucide-react";

export default function TradesPage() {
  const [connection, setConnection] = useState("Connecting");
  const [counterEditing, setCounterEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const {
    view,
    hasSession,
    setView,
    busy,
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
  useEffect(() => { setMessage(""); setPendingAction(null); }, [tradeId]);
  useEffect(() => { setPendingAction(null); }, [trade?.revision]);
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
  const actionText: Record<string, string> = {
    submit: "Send this offer? You agree to these items; they are reserved only if the other person accepts.",
    accept: "Accept these terms and reserve the items?",
    handoff: "Confirm that the handoff occurred? Both people must confirm to complete the trade.",
    cancel: trade?.handoffs.length ? "Request cancellation? Both people must approve after a handoff is reported." : "Cancel the agreement and release the reserved items?",
    decline: "Decline this offer?", withdraw: "Withdraw this offer?",
  };
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
    <div className="min-w-0 space-y-5">
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm action</AlertDialogTitle><AlertDialogDescription>{pendingAction ? actionText[pendingAction] : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingAction === "submit") void submitOffer(!!trade); else if (pendingAction) void act(pendingAction); setPendingAction(null); }}>Continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <header className="screen-heading">
        <h1 className="screen-title">Trades</h1>
        <p className="screen-description">Choose items, talk it through, and agree together.</p>
        {trade && <a href="#trade-conversation" className="mt-1 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 xl:hidden">Go to conversation</a>}
      </header>
      <div className="space-y-5">
        <aside aria-label="Trade list" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Your trades</h2><span className="text-xs text-muted-foreground">{view.trades.length}</span></div><Button variant="outline" size="sm" asChild><Link href="/">Browse items</Link></Button></div>
          <nav aria-label="Trade conversations" className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1">
            {view.trades.map((t) => <button type="button" key={t.id} aria-current={t.id === tradeId ? "true" : undefined} className={`min-w-36 max-w-64 shrink-0 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${t.id === tradeId ? "bg-primary text-primary-foreground" : "bg-secondary/40 hover:bg-secondary"}`} onClick={() => { setCounterEditing(false); setTradeId(t.id); setOther(""); setLeft([]); setRight([]); setAck(false); }}><span className="block truncate font-medium">{name(t.participants.find((id) => id !== who)!)}</span><span className="mt-1 block text-xs opacity-70">{t.status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}</span></button>)}
            {!view.trades.length && <p className="px-1 py-2 text-sm text-muted-foreground">No trades yet.</p>}
          </nav>
        </aside>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
          <CardHeader className="min-h-24 content-center border-b px-4 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="min-w-0 break-words text-lg leading-snug"><h2>{partner ? `Exchange with ${name(partner)}` : "Choose your exchange"}</h2></CardTitle><Badge variant="secondary" className="whitespace-normal">{trade ? trade.status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "New offer"}</Badge></div>{editingOffer && <p className="text-sm text-muted-foreground">Choose up to three items on each side, then send your offer.</p>}</CardHeader>
          <CardContent className="space-y-5 px-4 py-5 sm:px-6">
            {!trade && (other ? <p className="text-sm">Trading with <span className="font-semibold">{name(other)}</span></p> : <p className="text-sm text-muted-foreground">Choose an item on Home to start an offer.</p>)}
            {trade && offer && !editingOffer && <TermsView terms={offer.terms} who={who!} />}
            {editingOffer && (trade || other) && <div className="grid gap-4 sm:grid-cols-2">{options.map(([side, label, items]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded-xl border bg-secondary/30 p-3"><legend className="px-1 text-sm font-semibold">{label}</legend><p className="mb-3 text-xs text-muted-foreground">{(side === "left" ? left : right).length} selected · 3 max</p><div className="max-h-72 space-y-2 overflow-y-auto">{items.map((item) => { const selected = (side === "left" ? left : right).includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${selected ? "border-foreground bg-background" : "bg-card hover:bg-background"}`}><input type="checkbox" className="mt-1 accent-foreground" checked={selected} onChange={() => toggle(side, item.id)} /><span className="min-w-0"><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{money(item.value_minor)} · {item.condition}</span></span></label>; })}{!items.length && <p className="p-3 text-sm text-muted-foreground">{side === "right" && !other ? "Choose a member first." : "No available items."}</p>}</div></fieldset>)}</div>}
            {trade && offer && <section className="border-t pt-5" aria-label="Agreement on current offer" aria-live="polite"><h3 className="text-sm font-semibold">Agreement</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{trade.participants.map((id) => { const agreed = offer.consents.includes(id); return <div key={id} className="flex min-w-0 items-center gap-2 rounded-lg bg-secondary/35 px-3 py-2.5 text-sm"><span className={agreed ? "text-primary" : "text-muted-foreground"}>{agreed ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}</span><span className="min-w-0 truncate font-medium">{id === who ? "You" : name(id)}</span><span className="ml-auto text-xs text-muted-foreground">{agreed ? "Agreed" : "Waiting"}</span></div>; })}</div>{["agreed", "awaiting_handoff", "completed"].includes(trade.status) && <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-4" aria-hidden="true" /> Handoff confirmed by {trade.handoffs.length} of 2 participants</p>}</section>}
            {trade?.reason && <p className={`rounded-lg p-3 text-sm first-letter:uppercase ${trade.status === "declined" ? "bg-red-50 text-red-800" : "bg-secondary"}`}>{trade.reason}</p>}
            {(trade || other) && (!trade || trade.status === "open") && <><label className="flex items-start gap-3 text-sm leading-5"><input className="mt-0.5 size-4 shrink-0" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I reviewed the items and any unknown values or imbalance.</label><div className="flex flex-wrap gap-2">{editingOffer ? <Button disabled={busy || !other || !left.length || !right.length || !ack} onClick={() => setPendingAction("submit")}>{trade ? "Send counteroffer" : "Send offer"}</Button> : <>{offer?.sender !== who && <Button disabled={busy || !ack} onClick={() => setPendingAction("accept")}>Accept exact terms</Button>}<Button variant="outline" disabled={busy} onClick={prepareCounter}>Change items</Button><Button variant="outline" disabled={busy} onClick={() => setPendingAction(offer?.sender === who ? "withdraw" : "decline")}>{offer?.sender === who ? "Withdraw" : "Decline"}</Button></>}</div></>}
            {trade && ["agreed", "awaiting_handoff"].includes(trade.status) && <div className="flex flex-wrap gap-2"><Button disabled={busy || trade.handoffs.includes(who!)} onClick={() => setPendingAction("handoff")}>{trade.handoffs.includes(who!) ? "Handoff confirmed" : "Confirm reported handoff"}</Button><Button variant="outline" disabled={busy || trade.cancellations.includes(who!)} onClick={() => setPendingAction("cancel")}>Request cancellation</Button></div>}
          </CardContent>
        </Card>
        <Card id="trade-conversation" className="flex h-[420px] min-w-0 scroll-mt-4 flex-col gap-0 overflow-hidden rounded-2xl py-0 shadow-none sm:h-[560px] xl:h-full xl:max-h-[min(720px,calc(100dvh-64px))] xl:min-h-[560px]"><CardHeader className="min-h-24 content-center border-b px-4 py-5 sm:px-6"><CardTitle className="text-lg leading-snug"><h2>Conversation</h2></CardTitle><CardDescription className="break-words">{trade ? `${name(partner!)} · ${hasSession ? connection : "Demo"}` : "Select a trade to start a conversation"}</CardDescription></CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0"><div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-secondary/20 p-4 sm:p-5" role="log" aria-label="Trade messages" aria-live="polite">{trade?.offers.slice(0, -1).map((o) => <p key={o.version} className="mx-auto max-w-sm rounded-lg bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">Offer {o.version} by {name(o.sender)} · superseded · {o.terms.left.map((item) => item.title).join(" + ")} ↔ {o.terms.right.map((item) => item.title).join(" + ")}</p>)}{trade?.notes.length ? trade.notes.map((note, i) => <div key={`${note.created_at}-${i}`} className={`flex ${note.sender === who ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[85%] ${note.sender === who ? "bg-primary text-primary-foreground" : "border bg-card"}`}><p className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 break-words text-xs opacity-75"><span>{note.sender === who ? "You" : name(note.sender)}</span><time dateTime={note.created_at} title={new Date(note.created_at).toLocaleString()} className="tabular-nums">{new Date(note.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></p><p className="whitespace-pre-wrap break-words">{note.text}</p></div></div>) : <p className="py-12 text-center text-sm text-muted-foreground sm:py-16">{trade ? "No messages yet. Say hello and discuss your exchange." : "Your messages will appear here."}</p>}</div>
          {trade && !closed.includes(trade.status) && <form className="border-t p-4" onSubmit={(e) => { e.preventDefault(); const submitted = message; if (!busy && submitted.trim()) void act("note", submitted).then((saved) => { if (saved) setMessage((current) => current === submitted ? "" : current); }); }}><label htmlFor="trade-message" className="sr-only">Message</label><div className="relative"><Input id="trade-message" name="note" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a message…" required maxLength={3000} className="h-12 rounded-xl pr-14" /><Button type="submit" variant="ghost" size="icon" disabled={busy || !message.trim()} aria-label="Send message" className="absolute right-1 top-1 size-10 rounded-full bg-transparent hover:bg-transparent"><Send aria-hidden="true" /></Button></div><p className="mt-2 text-xs text-muted-foreground">Private to both participants</p></form>}</CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
