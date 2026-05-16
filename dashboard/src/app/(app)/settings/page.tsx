import Link from "next/link";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
          Settings
        </p>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
          Settings
        </h1>
        <p className="max-w-[600px] text-[14px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
          Torqa runs in local mode. Hosted accounts, billing, and team settings are planned.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Mode</h2>
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
        >
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>Local</p>
            <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
              Workflow planning runs deterministically on your machine.
            </p>
          </div>
          <span
            className="rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              color: "var(--accent)",
            }}
          >
            Active
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Project</h2>
        <ul className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
          {[
            { label: "MCP server setup", href: "/mcp-server", external: false },
            { label: "Web workflow builder", href: "/demo/mcp-workflow-builder", external: false },
            { label: "Documentation (MCP_SERVER.md)", href: "https://github.com/kadireren7/Torqa/blob/main/docs/MCP_SERVER.md", external: true },
            { label: "GitHub repository", href: "https://github.com/kadireren7/Torqa", external: true },
          ].map((row, i) => {
            const className = "flex items-center justify-between px-4 py-3 text-[13px] transition-opacity hover:opacity-80";
            const style: React.CSSProperties = {
              background: "var(--surface-1)",
              color: "var(--fg-2)",
              borderTop: i === 0 ? undefined : "1px solid var(--line)",
            };
            if (row.external) {
              return (
                <a key={row.label} href={row.href} target="_blank" rel="noreferrer" className={className} style={style}>
                  <span>{row.label}</span>
                  <span style={{ color: "var(--fg-4)" }}>↗</span>
                </a>
              );
            }
            return (
              <Link key={row.label} href={row.href} className={className} style={style}>
                <span>{row.label}</span>
                <span style={{ color: "var(--fg-4)" }}>→</span>
              </Link>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
