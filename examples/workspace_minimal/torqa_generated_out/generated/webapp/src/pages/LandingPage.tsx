import React from "react";

export function LandingPage({ flowName }: { flowName: string }) {
  return (
    <section className="page" aria-labelledby="overview-title">
      <h2 id="overview-title">Overview</h2>
      <p>
        This screen is <strong>projected from TORQA</strong> for the <strong>{flowName}</strong> flow.
        Use the navigation above to step through a sign-in layout and the post-login view.
      </p>
      <ul className="page-list">
        <li>Structure and copy reflect your intent spec, not hand-written React.</li>
        <li>Forms are visual placeholders — hook them to your API when you ship.</li>
      </ul>
    </section>
  );
}
