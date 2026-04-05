import { useEffect } from "react";

/** P120: fade/slide sections into view once (respects prefers-reduced-motion in CSS). */
export function useP120ScrollReveal(locale: string, routeKey: string) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-p120-reveal]");
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            ent.target.classList.add("p120-reveal--visible");
            io.unobserve(ent.target);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [locale, routeKey]);
}
