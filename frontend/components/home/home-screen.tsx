"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/provider";

export function profileDestination(value: string | null) {
  return ["/profile", "/profile/inventory", "/profile/preferences"].includes(value ?? "")
    ? value!
    : "/profile";
}

export function HomeScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { sessionStatus, hasSession, busy, seeded, view, signIn, signUp, retrySession, setError } = useWorkspace();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [community, setCommunity] = useState("");
  const register = params.get("mode") === "register";
  const destination = profileDestination(params.get("next"));
  const returnQuery = `next=${encodeURIComponent(destination)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (register) await signUp({ username, password, name, community });
      else await signIn({ username, password });
      router.replace(destination);
    } catch {
      // The session provider announces the actual authentication failure.
    } finally {
      setPassword("");
    }
  }

  if (sessionStatus === "checking") return <p role="status">Checking your session…</p>;
  if (sessionStatus === "unavailable") return (
    <section className="max-w-xl space-y-4">
      <h2 className="text-2xl font-semibold">Session unavailable</h2>
      <p className="text-sm text-muted-foreground">We couldn’t check your account. Try again when the connection is available.</p>
      <Button disabled={busy} onClick={() => void retrySession()}>Retry session</Button>
    </section>
  );
  if (hasSession) return (
    <section className="max-w-xl space-y-4">
      <h2 className="text-2xl font-semibold">Welcome back, {view.profile.name}.</h2>
      <p className="text-sm leading-6 text-muted-foreground">Keep your profile, available items and interests up to date.</p>
      <Button asChild><Link href="/profile">Go to your profile</Link></Button>
    </section>
  );

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <h2 className="text-2xl font-semibold">{register ? "Create your Bartr account" : "Sign in to Bartr"}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{register ? "Choose a campus or city community to begin your inventory." : "Your saved profile, inventory and interests are waiting."}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="home-username">Username</label>
            <Input id="home-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={40} value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="home-password">Password</label>
            <Input id="home-password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 10 : 1} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} />
            {register && <p className="text-xs text-muted-foreground">Use 10–200 characters.</p>}
          </div>
          {register && <>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="home-name">Display name</label>
              <Input id="home-name" autoComplete="nickname" required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="home-community">Community</label>
              <Input id="home-community" required maxLength={200} placeholder="Campus or city" value={community} onChange={e => setCommunity(e.target.value)} />
            </div>
          </>}
          <Button className="w-full" disabled={busy || seeded} type="submit">
            {busy ? register ? "Creating account…" : "Signing in…" : register ? "Create account" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link className="underline underline-offset-4" href={register ? `/home?${returnQuery}` : `/home?mode=register&${returnQuery}`} onClick={() => { setPassword(""); setError(""); }}>
              {register ? "Sign in instead" : "Create an account"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
