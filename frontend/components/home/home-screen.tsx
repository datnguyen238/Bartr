"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

export function profileDestination(value: string | null) {
  return ["/profile", "/profile/inventory", "/profile/preferences"].includes(value ?? "")
    ? value!
    : "/profile";
}

export function HomeScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { sessionStatus, hasSession, busy, seeded, view, signIn, signUp, retrySession, setError, error: workspaceError } = useWorkspace();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [community, setCommunity] = useState("");
  const [failure, setFailure] = useState<Error | null>(null);
  const register = params.get("mode") === "register";
  const destination = profileDestination(params.get("next"));
  const returnQuery = `next=${encodeURIComponent(destination)}`;
  const fieldError = (field: string) => failure instanceof ApiError
    ? failure.fields?.find(error => error.field.split(".").includes(field))?.message
    : undefined;
  const errorMessage = failure instanceof ApiError && failure.fields.length
    ? "Review the highlighted account details and try again."
    : failure?.message || workspaceError;

  function clearFailure() {
    setFailure(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFailure();
    try {
      if (register) await signUp({ username, password, name, community });
      else await signIn({ username, password });
      router.replace(destination);
    } catch (error) {
      setFailure(error instanceof Error ? error : new Error("Your account couldn’t be opened. Try again."));
    } finally {
      setPassword("");
    }
  }

  if (sessionStatus === "checking") return <section className="max-w-2xl space-y-4 py-8" aria-busy="true">
    <p className="text-sm text-muted-foreground" role="status">Checking your session…</p>
    <div className="h-8 w-52 rounded-md bg-secondary" aria-hidden="true" />
    <div className="h-28 rounded-2xl bg-secondary/60" aria-hidden="true" />
  </section>;
  if (sessionStatus === "unavailable") return <section className="max-w-xl space-y-5 py-8">
    <h1 className="screen-title">Session unavailable</h1>
    <p className="screen-description">We couldn’t check your account. Your saved information is still yours. Try again when the connection is available.</p>
    {errorMessage && <p className="inline-feedback text-sm" data-tone="error" role="alert">{errorMessage}</p>}
    <Button disabled={busy} onClick={() => void retrySession()}>Retry session</Button>
  </section>;
  if (hasSession) return <section className="max-w-3xl space-y-8">
    <header className="screen-heading">
      <h1 className="screen-title">Welcome back, {view.profile.name}.</h1>
      <p className="screen-description">A little less unused. A little more possibility.</p>
    </header>
    <div className="surface-panel space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Make room for what’s next</h2>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">Add the things you’re ready to exchange, then tell Bartr what would be useful to you.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/profile/inventory">Open your inventory</Link></Button>
        <Button variant="outline" asChild><Link href="/profile/preferences">Update your interests</Link></Button>
      </div>
      <p className="border-t pt-5 text-sm text-muted-foreground"><Link className="underline underline-offset-4" href="/profile">Go to your profile</Link> to update your public name and community.</p>
    </div>
  </section>;

  return (
    <div className="home-layout">
      <section className="home-introduction" aria-labelledby="home-purpose">
        <header className="screen-heading max-w-xl">
          <h1 id="home-purpose" className="screen-title">Trade what you have.<br />Find what you need.</h1>
          <p className="screen-description">Exchange belongings in your campus or city community. No buying. No selling.</p>
        </header>
      </section>
      <section className="home-auth surface-panel" aria-labelledby="home-form-title">
        <nav className="mb-7 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" aria-label="Account access">
          <Link className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium ${!register ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`} href={`/home?${returnQuery}`} aria-current={!register ? "page" : undefined} onClick={() => { setPassword(""); clearFailure(); }}>Sign in</Link>
          <Link className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium ${register ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`} href={`/home?mode=register&${returnQuery}`} aria-current={register ? "page" : undefined} onClick={() => { setPassword(""); clearFailure(); }}>Create account</Link>
        </nav>
        <div className="mb-6 space-y-2">
          <h2 id="home-form-title" className="text-2xl font-semibold">{register ? "Create your Bartr account" : "Welcome to Bartr"}</h2>
          <p className="text-base leading-7 text-muted-foreground">{register ? "Your next useful exchange starts with what you already have." : "Sign in to keep your inventory and interests up to date."}</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <div className="field-group space-y-2">
            <label className="text-sm font-medium" htmlFor="home-username">Username</label>
            <Input id="home-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={40} value={username} aria-invalid={Boolean(fieldError("username"))} aria-describedby={fieldError("username") ? "home-username-error" : undefined} onChange={event => { clearFailure(); setUsername(event.target.value); }} />
            {fieldError("username") && <p id="home-username-error" className="text-sm text-destructive">{fieldError("username")}</p>}
          </div>
          <div className="field-group space-y-2">
            <label className="text-sm font-medium" htmlFor="home-password">Password</label>
            <Input id="home-password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 10 : 1} maxLength={200} value={password} aria-invalid={Boolean(fieldError("password"))} aria-describedby={[register ? "home-password-help" : "", fieldError("password") ? "home-password-error" : ""].filter(Boolean).join(" ") || undefined} onChange={event => { clearFailure(); setPassword(event.target.value); }} />
            {register && <p id="home-password-help" className="text-sm text-muted-foreground">Use 10–200 characters.</p>}
            {fieldError("password") && <p id="home-password-error" className="text-sm text-destructive">{fieldError("password")}</p>}
          </div>
          {register && <>
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="home-name">Display name</label>
              <Input id="home-name" autoComplete="nickname" required maxLength={200} value={name} aria-invalid={Boolean(fieldError("name"))} aria-describedby={fieldError("name") ? "home-name-error" : undefined} onChange={event => { clearFailure(); setName(event.target.value); }} />
              {fieldError("name") && <p id="home-name-error" className="text-sm text-destructive">{fieldError("name")}</p>}
            </div>
            <div className="field-group space-y-2">
              <label className="text-sm font-medium" htmlFor="home-community">Community</label>
              <Input id="home-community" required maxLength={200} placeholder="Campus or city" value={community} aria-invalid={Boolean(fieldError("community"))} aria-describedby={`home-community-help${fieldError("community") ? " home-community-error" : ""}`} onChange={event => { clearFailure(); setCommunity(event.target.value); }} />
              <p id="home-community-help" className="text-sm text-muted-foreground">Your display name and community are public. Leave out precise addresses.</p>
              {fieldError("community") && <p id="home-community-error" className="text-sm text-destructive">{fieldError("community")}</p>}
            </div>
          </>}
          {errorMessage && <p className="inline-feedback text-sm leading-6" data-tone="error" role="alert">{errorMessage}</p>}
          <Button className="w-full" disabled={busy || seeded} type="submit">{busy ? register ? "Creating account…" : "Signing in…" : register ? "Create account" : "Sign in"}</Button>
          <p className="text-sm text-muted-foreground">
            {register ? "Already have an account? " : "New here? "}
            <Link className="font-medium text-foreground underline underline-offset-4" href={register ? `/home?${returnQuery}` : `/home?mode=register&${returnQuery}`} onClick={() => { setPassword(""); clearFailure(); }}>{register ? "Sign in instead" : "Create an account"}</Link>
          </p>
        </form>
      </section>
      <section className="home-example space-y-5" aria-labelledby="home-example-heading">
        <div className="max-w-xl space-y-4 border-y py-6">
          <h2 id="home-example-heading" className="text-xl font-semibold">One thing for a few things</h2>
          <p className="text-base leading-7 text-muted-foreground">Bartr considers one to three items on each side, so useful exchanges can go beyond a simple one-for-one swap.</p>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]" aria-label="Illustrative bundle exchange">
            <div className="space-y-1">
              <p className="font-medium">Chair + calculator</p>
              <p className="text-sm text-muted-foreground">Example total: $60</p>
            </div>
            <svg className="size-6 rotate-90 text-muted-foreground sm:rotate-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="space-y-1">
              <p className="font-medium">A monitor</p>
              <p className="text-sm text-muted-foreground">Example total: $65</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">Illustrative values, not market prices. Estimates help compare bundles; they never require a payment or decide for you.</p>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">Start with your inventory and interests. Discovery and offer controls are coming next.</p>
      </section>
    </div>
  );
}
