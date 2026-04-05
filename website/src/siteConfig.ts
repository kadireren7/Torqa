/** Optional public contact email (set via `VITE_CONTACT_EMAIL` at build time). */
export function publicContactEmail(): string {
  const v = import.meta.env.VITE_CONTACT_EMAIL;
  return typeof v === "string" ? v.trim() : "";
}
