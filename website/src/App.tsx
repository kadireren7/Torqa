import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./layout/SiteLayout";
import { ContactPage } from "./pages/ContactPage";
import { DocsPage } from "./pages/DocsPage";
import { HomePage } from "./pages/HomePage";
import { PricingPage } from "./pages/PricingPage";
import { ProductPage } from "./pages/ProductPage";
import { ProofPage } from "./pages/ProofPage";
import { TryPage } from "./pages/TryPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/proof" element={<ProofPage />} />
        <Route path="/try" element={<TryPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
