import { useEffect, useState } from "react";
import { loadUsage, type UsageView } from "../api";

export function UsagePage() {
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadUsage()
      .then(setUsage)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load usage");
      });
  }, []);

  return (
    <main className="flex flex-col gap-2 p-4">
      <h1>Usage</h1>
      {error ? <p>{error}</p> : null}
      {usage ? (
        <>
          <p>Requests: {usage.requestCount}</p>
          <p>Prompt tokens: {usage.promptTokens}</p>
          <p>Completion tokens: {usage.completionTokens}</p>
          <p>Total tokens: {usage.totalTokens}</p>
          <p>Token budget: {usage.tokenBudget}</p>
          <p>Remaining tokens: {usage.remainingTokens}</p>
        </>
      ) : error ? null : (
        <p>Loading</p>
      )}
    </main>
  );
}
