// T-49: site feature switches. F-17 (T-91, Fahad 13 Oct: «من لوحة تحكمي أنا للموقع كله», «تخفى لدي في لوحة تحكم
// الادارة»): these are now the DEFAULTS only. The site owner shows or hides each section for the whole site in the
// Owner console (/super_admin, src/lib/owner/site-sections.ts), and the owner's choice, saved in the preview state,
// wins over the value here. A section the owner never changed follows this file.
// Set only by whoever runs the server (its environment), never from the URL, cookies or the browser's storage.
// NEXT_PUBLIC_ so the client reads the same default; it is fixed when the server starts (dev) or is built (production).
// Hiding a section hides it; its code and data stay.
//
// My Inbox (/dashboard/notifications) and the header bell are on by default since T-132 (T-98/T-113, turned on by the
// monitor's decision on Fahad's order, 2026-10-14 00:08). Default off: NEXT_PUBLIC_STUDIO_NOTIFICATIONS=off, then
// restart the dev server (or rebuild for production).
//
// T-53: E-commerce (/dashboard/ecommerce) is off by default the same way. Default on: NEXT_PUBLIC_STUDIO_ECOMMERCE=on,
// then restart (or rebuild). The owner can show it from the Owner console without either.
export const FEATURES = {
  notifications: process.env.NEXT_PUBLIC_STUDIO_NOTIFICATIONS !== "off",
  ecommerce: process.env.NEXT_PUBLIC_STUDIO_ECOMMERCE === "on",
} as const;
