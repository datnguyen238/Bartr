"use client";

import { TermsView } from "@/components/terms-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, type Trade, type Recommendations } from "@/lib/marketplace";
import { useWorkspace } from "@/components/workspace/provider";

export default function DiscoverPage() {
  const {
    view,
    setTab,
    busy,
    results,
    setResults,
    semantic,
    setSemantic,
    setTradeId,
    setOther,
    left,
    setLeft,
    right,
    setRight,
    run,
    who,
    offer,
    name,
  } = useWorkspace();
  if (!view) return null;
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end gap-5">
        <label className="text-sm">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(e) => setSemantic(e.target.checked)}
            className="mr-2"
          />
          Semantic discovery (Bedrock + Atlas + Gemini)
        </label>
        <Button
          disabled={busy}
          onClick={() =>
            run(async () => {
              setResults(
                await api<Recommendations>(
                  `recommendations?semantic=${semantic}`,
                ),
              );
            })
          }
        >
          Discover bundles
        </Button>
      </div>
      {!semantic && (
        <p className="mb-5 text-sm text-muted-foreground">
          Exact-text local testing is selected. Equivalent wording
          requires configured semantic services.
        </p>
      )}
      {results && (
        <p role="status" className="mb-5 text-sm">
          {results.recommendations.length} suggestions ·{" "}
          {results.retrieval}
          {results.reason === "MISSING_VALUATION"
            ? " · Relevant items need comparison values before automatic recommendations."
            : ""}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {results?.recommendations.map((rec) => (
          <Card key={rec.id} className="shadow-none">
            <CardHeader>
              <CardDescription>
                Trade with {rec.member.name}
              </CardDescription>
              <CardTitle>
                {rec.terms.left.length} for {rec.terms.right.length}{" "}
                items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TermsView terms={rec.terms} who={who!} />
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {rec.explanation}
              </p>
              <div className="mt-5 flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    setOther(rec.member.id);
                    setLeft(rec.terms.left.map((x) => x.id));
                    setRight(rec.terms.right.map((x) => x.id));
                    setTab("trades");
                    setTradeId("");
                  }}
                >
                  Review proposal
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("recommendations/dismiss", "POST", {
                        id: rec.id,
                      });
                      setResults({
                        ...results,
                        recommendations:
                          results.recommendations.filter(
                            (x) => x.id !== rec.id,
                          ),
                      });
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {results && !results.recommendations.length && (
        <p className="rounded-lg border bg-card p-6 text-sm">
          No qualifying exchange found. Review your interests and
          available values, or compose a manual offer.
        </p>
      )}
    </section>
  );
}
