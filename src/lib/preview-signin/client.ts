"use client";
// F-6A: the browser side of the preview sign-in (see ./shared.ts). A plain cookie, so the server page "/" can read it;
// it holds only how the visitor entered ("demo", "login" or "register"), never an email or a password.
import { deleteClientCookie, setClientCookie } from "@/lib/cookie.client";

import { PREVIEW_SIGNIN_COOKIE, type PreviewSignin } from "./shared";

export function enterPreview(how: PreviewSignin, remember = true) {
  setClientCookie(PREVIEW_SIGNIN_COOKIE, how, remember ? 30 : 1);
}

export function leavePreview() {
  deleteClientCookie(PREVIEW_SIGNIN_COOKIE);
}
