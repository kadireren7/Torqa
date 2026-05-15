import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan report",
  description: "Local Torqa scan report.",
  robots: { index: false, follow: false },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
