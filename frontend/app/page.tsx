'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkHealth } from '@/lib/api';

export default function Home() {
  const [status, setStatus] = useState('Connection not checked.');
  const [busy, setBusy] = useState(false);

  async function checkConnection() {
    setBusy(true);
    setStatus('Checking backend connection…');
    try {
      const health = await checkHealth();
      setStatus(`${health.service} backend is connected.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Backend unavailable. Start the backend and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="text-2xl font-semibold tracking-tight">bartr<span aria-hidden="true">.</span></span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Development foundation</span>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <section aria-labelledby="welcome-title">
          <p className="mb-5 text-sm font-medium text-muted-foreground">Good things deserve another chapter.</p>
          <h1 id="welcome-title" className="max-w-xl text-5xl leading-[1.08] tracking-tight sm:text-6xl">What you have.<br /><span className="font-serif italic">What comes next.</span></h1>
          <p className="mt-6 max-w-md leading-7 text-muted-foreground">A fresh foundation for Bartr. The frontend and API are ready for the trading experience we build next.</p>
        </section>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Check your connection</CardTitle>
            <CardDescription>Confirm this frontend can reach the Python backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg bg-secondary p-4 text-sm" role="status" aria-live="polite" aria-atomic="true">{status}</div>
            <Button className="w-full" onClick={checkConnection} disabled={busy}>{busy ? 'Checking…' : 'Check API connection'}</Button>
            <p className="text-xs leading-5 text-muted-foreground">Run the frontend on port 3000 and the backend on port 8000. Setup commands are in the README.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
