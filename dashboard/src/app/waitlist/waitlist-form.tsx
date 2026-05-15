"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const ROLES = [
  "Developer",
  "Security engineer",
  "AI builder",
  "Startup founder",
  "Other",
];

const STORAGE_KEY = "torqa-waitlist";

interface FormEntry {
  email: string;
  role: string;
  stack: string;
  ts: string;
}

function saveToStorage(entry: Omit<FormEntry, "ts">) {
  try {
    const existing = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    ) as FormEntry[];
    existing.push({ ...entry, ts: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // storage unavailable — no-op
  }
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Developer");
  const [stack, setStack] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !emailTrimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    saveToStorage({ email: emailTrimmed, role, stack: stack.trim() });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="space-y-6 py-6 text-center">
        <div className="flex justify-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                "color-mix(in srgb, var(--accent) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            <CheckCircle2
              className="h-6 w-6"
              style={{ color: "var(--accent)" }}
              aria-hidden
            />
          </span>
        </div>
        <div className="space-y-2">
          <h2
            className="text-[22px] font-bold tracking-tight"
            style={{ color: "var(--fg-1)" }}
          >
            You&apos;re on the list
          </h2>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            We&apos;ll reach out when early access slots open. In the meantime,
            try the free scanner — no account needed.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/scan"
            className="rounded-lg px-6 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Scan MCP config
          </Link>
          <Link
            href="/scan?sample=unsafe_mcp&source=mcp"
            className="rounded-lg border px-6 py-2.5 text-[14px] font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
          >
            Try unsafe demo
          </Link>
        </div>
        <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
          Submission stored locally in your browser. No data was sent to a
          server.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="wl-email"
          className="block text-[13px] font-medium"
          style={{ color: "var(--fg-2)" }}
        >
          Email address
        </label>
        <input
          id="wl-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
            color: "var(--fg-1)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--line-2)";
          }}
        />
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <label
          htmlFor="wl-role"
          className="block text-[13px] font-medium"
          style={{ color: "var(--fg-2)" }}
        >
          Your role
        </label>
        <select
          id="wl-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full appearance-none rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
            color: "var(--fg-1)",
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Stack (optional) */}
      <div className="space-y-1.5">
        <label
          htmlFor="wl-stack"
          className="block text-[13px] font-medium"
          style={{ color: "var(--fg-2)" }}
        >
          What MCP/agent stack are you using?{" "}
          <span style={{ color: "var(--fg-4)" }}>(optional)</span>
        </label>
        <textarea
          id="wl-stack"
          rows={3}
          placeholder="e.g. Claude + custom MCP server, LangChain + n8n, OpenAI Assistants..."
          value={stack}
          onChange={(e) => setStack(e.target.value)}
          className="w-full resize-none rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
            color: "var(--fg-1)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--line-2)";
          }}
        />
      </div>

      {error && (
        <p className="text-[12px]" style={{ color: "var(--red, #ef4444)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg py-3 text-[14px] font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        Request early access
      </button>

      <p className="text-center text-[11px]" style={{ color: "var(--fg-4)" }}>
        This demo stores your submission locally in your browser. No data is
        sent to any server unless a backend email service is configured.
      </p>
    </form>
  );
}
