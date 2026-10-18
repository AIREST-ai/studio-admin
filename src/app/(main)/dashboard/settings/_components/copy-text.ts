"use client";
// F-12 (Fahad 129.2, honest simulation): the Copy buttons of the API token, the API base URL and the webhook secrets
// said "copied" even when nothing was copied. Browsers give navigator.clipboard only to secure pages (https or
// localhost: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), and the preview is opened over plain http
// (http://100.73.3.21:8797), so there the copy goes through the browser's copy command, and the text is put on the
// clipboard by the copy event itself (event.clipboardData.setData, https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event).
// A selected hidden text box is not used: menus and dialogs keep the focus inside them, so the box lost its selection
// and the command "succeeded" with nothing copied. The message says "copied" only when the browser took the text.
import { toast } from "sonner";

function copyWithCommand(text: string): boolean {
  let put = false;
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    put = true;
  };
  document.addEventListener("copy", onCopy, true);
  try {
    return document.execCommand("copy") && put;
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
}

/** Copies `text`; says `done` only when the browser took it. */
export async function copyText(text: string, done: string): Promise<boolean> {
  const byClipboard =
    window.isSecureContext && navigator.clipboard
      ? await navigator.clipboard.writeText(text).then(
          () => true,
          () => false,
        )
      : false;
  const copied = byClipboard || copyWithCommand(text);
  if (copied) toast.success(done);
  else toast.error("Not copied", { description: "The browser refused to copy. Select the text and copy it by hand." });
  return copied;
}
