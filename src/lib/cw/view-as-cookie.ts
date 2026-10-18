// F-5A: the "View as" cookie, kept apart from ./view-as.ts (a client module) so the dashboard layout, a server
// component, can read it and render the page as the chosen person from the first byte (no flash of the admin view).
import { CURRENT_USER_ID } from "./data";

/** The cookie that keeps the chosen person in this browser. */
export const VIEW_AS_COOKIE = "studio_view_as";

/** The agent id kept in the cookie, or null (the signed-in sample administrator). */
export function parseViewAs(value: string | undefined | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id !== CURRENT_USER_ID ? id : null;
}
