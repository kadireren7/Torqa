import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { getOrganization } from "@/data/queries";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const org = await getOrganization();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar orgName={org.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader orgName={org.name} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
