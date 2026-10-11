/**
 * F153 (Fahad 2026-10-11, council room 3018: «المطلوب ان تفعل نمظ المشاهده»): when Studio is shown inside a frame
 * (8798 watch page, or the Chatwoot copy :8810), tell the parent the page it shows now, as { view: url }, on every
 * change, so the room's screenshot is of the same page Fahad sees. Does nothing when Studio is not framed.
 */
const code = `
  (function () {
    if (window.parent === window) return;
    var sent = "";
    setInterval(function () {
      if (location.href === sent) return;
      sent = location.href;
      window.parent.postMessage({ view: sent }, "*");
    }, 400);
  })();
`;

export function ViewSyncScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static boot script
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
