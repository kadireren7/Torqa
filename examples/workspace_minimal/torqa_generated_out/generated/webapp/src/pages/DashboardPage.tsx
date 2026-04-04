import React from "react";

export function DashboardPage({ flowResult }: { flowResult: string }) {
  return (
    <section className="page page-dashboard" aria-labelledby="dash-title">
      <h2 id="dash-title">After sign-in</h2>
      <p className="flow-result-line">
        Declared flow result: <strong>{flowResult || "—"}</strong>
      </p>
      <p className="muted">Happy-path layout from your TORQA spec; connect real session and data in product code.</p>
    </section>
  );
}
