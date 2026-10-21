// F-6A (sim2 problems 5 and 17; task item 5): this preview has no accounts. Login, Register and Live demo are an honest
// simulation: they check the form, say plainly that no account was checked or created, keep nothing that was typed
// (no email, no password), and only remember in this browser that someone entered the preview, so "/" knows where
// to go (Chatwoot's root sends a visitor who is not signed in to its login page, and a signed-in one to the
// dashboard: config/routes.rb `root to: 'dashboard#index'` and the app router's login redirect).
// Log out forgets it and goes back to the login page. The dashboard itself still opens without it: the preview has
// no sign-in, and the login page says so.
export const PREVIEW_SIGNIN_COOKIE = "studio_preview_signin";
export const PREVIEW_LANDING_PATH = "/dashboard/start";

/** How the visitor entered: the demo account, the login form or the register form. No typed value is kept. */
export type PreviewSignin = "demo" | "login" | "register";

export const DEMO_ACCOUNT = {
  name: "Arham Khan",
  role: "Administrator",
  workspace: "Weblabs Studio",
} as const;

/** The line every way in shows: true to what happened. */
export const NO_REAL_ACCOUNT = "Preview — no real account is created";
