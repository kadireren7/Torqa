import React, { useState } from "react";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

type DemoView = "overview" | "login" | "dashboard";

export function App() {
  const flowName = "MinimalLogin";
  const flowResult = "OK";
  const [view, setView] = useState<DemoView>("overview");

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-top">
          <span className="app-badge" aria-hidden="true">TORQA</span>
          <span className="app-header-meta">Generated preview</span>
        </div>
        <h1>{flowName}</h1>
        <p className="app-tagline">Local UI shell from your validated TORQA intent — not wired to a real backend.</p>
      </header>
      <nav className="app-nav" aria-label="Demo sections">
        <button
          type="button"
          className={view === "overview" ? "nav-item active" : "nav-item"}
          onClick={() => setView("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={view === "login" ? "nav-item active" : "nav-item"}
          onClick={() => setView("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={view === "dashboard" ? "nav-item active" : "nav-item"}
          onClick={() => setView("dashboard")}
        >
          After sign-in
        </button>
      </nav>
      <main className="app-main">
        {view === "overview" && <LandingPage flowName={flowName} />}
        {view === "login" && <LoginPage />}
        {view === "dashboard" && <DashboardPage flowResult={flowResult} />}
      </main>
      <footer className="app-footer-bar">
        <span className="footer-brand">TORQA</span>
        <span className="footer-note">Projection preview · run <code className="footer-code">npm run dev</code> in this folder</span>
      </footer>
    </div>
  );
}
