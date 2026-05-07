import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { getShellOrganization } from "@/lib/shell-organization";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const org = await getShellOrganization();
  const supabase = await createClient();

  let user: { email: string; displayName: string | null } | null = null;
  if (supabase) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u?.email) {
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const dn =
        (typeof meta?.full_name === "string" && meta.full_name) ||
        (typeof meta?.name === "string" && meta.name) ||
        null;
      user = { email: u.email, displayName: dn };
    }
  }

  return (
    <div className="relative flex min-h-screen" style={{ background: "var(--surface-0)" }}>
      {/* Very subtle ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 30% at 50% -5%, rgba(34,211,238,0.04) 0%, transparent 60%)," +
            "radial-gradient(ellipse 40% 20% at 100% 0%, rgba(139,92,246,0.03) 0%, transparent 50%)",
        }}
        aria-hidden
      />

      <AppSidebar orgName={org.name} />

      <div className="flex min-w-0 flex-1 flex-col" style={{ background: "var(--surface-0)" }}>
        <AppHeader orgName={org.name} user={user} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto outline-none"
        >
          <div className="mx-auto max-w-[1100px] px-6 py-8 sm:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
