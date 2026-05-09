import type { Metadata } from "next";
import { MarketplaceClient } from "./marketplace-client";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse and install governance policy packs.",
};

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
