"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type Profile } from "@/lib/marketplace";
import { ArrowLeft, Check, Lock, Shield } from "@/components/icons";

type Mode = "sign-in" | "register";

const copy = {
  "sign-in": {
    eyebrow: "Welcome back",
    title: "Sign in to trade",
    description:
      "Your inventory, preferences and private negotiations stay inside your account.",
    submit: "Sign in",
    submitting: "Signing in…",
    switchLabel: "New to Bartr?",
    switchHref: "/register",
    switchCta: "Create an account",
  },
  register: {
    eyebrow: "Join Bartr",
    title: "Start trading what you have",
    description:
      "Create an account to publish items, save what you need and browse listings.",
    submit: "Create account",
    submitting: "Creating account…",
    switchLabel: "Already have an account?",
    switchHref: "/sign-in",
    switchCta: "Sign in",
  },
} as const;

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const text = copy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      if (mode === "register") {
        await api<Profile>("auth/register", "POST", {
          username,
          password,
          name,
        });
      } else {
        await api<Profile>("auth/login", "POST", { username, password });
      }
      window.location.assign(next);
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.message);
        setFieldErrors(
          Object.fromEntries(
            reason.fields.map((field) => [
              field.field.replace(/^body\./, ""),
              field.message,
            ]),
          ),
        );
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : "Something went wrong. Check the backend and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Brand href="/" />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to browse
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <section aria-labelledby="auth-intro">
          <p className="caption mb-3">{text.eyebrow}</p>
          <h1
            id="auth-intro"
            className="font-display text-4xl leading-[1.02] tracking-[-0.035em] sm:text-5xl"
          >
            {text.title}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
            {text.description}
          </p>
          <ul className="mt-7 space-y-3 text-sm text-muted-foreground">
            {[
              "Browse published items.",
              "Keep drafts, preferences and notes private.",
              "Nothing is reserved until both members agree.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-accent-warm"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Private sign-in
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="size-3.5" aria-hidden="true" />
              Participant-only trades
            </span>
          </div>
        </section>

        <Card className="w-full shadow-lg shadow-foreground/5">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {mode === "register" ? "Create your account" : "Sign in"}
            </CardTitle>
            <CardDescription>
              {mode === "register"
                ? "Your display name appears with published listings. Your sign-in username stays private."
                : "Use the username and password you saved when you joined."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Could not continue</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {mode === "register" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="auth-name">Display name</Label>
                    <Input
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
                    />
                    {fieldErrors.name && (
                      <p id="auth-name-error" className="text-xs text-destructive">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="auth-username">Username</Label>
                <Input
                  id="auth-username"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={40}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={
                    fieldErrors.username ? "auth-username-error" : undefined
                  }
                />
                {fieldErrors.username && (
                  <p id="auth-username-error" className="text-xs text-destructive">
                    {fieldErrors.username}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "register" ? 10 : 1}
                  maxLength={200}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "auth-password-error" : undefined
                  }
                />
                {fieldErrors.password && (
                  <p id="auth-password-error" className="text-xs text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
                {mode === "register" && (
                  <p className="text-xs text-muted-foreground">
                    Use 10–200 characters.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? text.submitting : text.submit}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {text.switchLabel}{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4 hover:text-accent-warm"
                href={`${text.switchHref}?next=${encodeURIComponent(next)}`}
              >
                {text.switchCta}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
