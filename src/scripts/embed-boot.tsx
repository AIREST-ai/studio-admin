/**
 * F151 (Fahad 2026-10-11): "embedded" mode, for showing Studio pages inside the embedded copy on :8810.
 *
 * On when the URL has ?embed=1, or when the page is framed (at any depth) by an :8810 page.
 * Then Studio's own app sidebar and top header are hidden, so only the page content shows
 * (every /dashboard/* page and /chat; the chat's channel sidebar is page content and stays).
 * Anywhere else nothing changes — including Studio's own /dashboard/chat preview frame and the 8798 watch page.
 * Runs early in <head>, like ThemeBootScript, so there is no flash of the hidden chrome.
 */
const code = `
  (function () {
    try {
      var byQuery = new URLSearchParams(window.location.search).get("embed") === "1";
      var byFrame = false;
      if (window.self !== window.top) {
        var origins = window.location.ancestorOrigins;
        byFrame = origins
          ? Array.prototype.some.call(origins, function (o) { return /:8810$/.test(o); })
          : /:8810\\//.test(document.referrer);
      }
      if (byQuery || byFrame) document.documentElement.setAttribute("data-embed", "1");
    } catch (e) {
      console.warn("EmbedBootScript error:", e);
    }
  })();
`;

const css = `
  html[data-embed="1"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar"],
  html[data-embed="1"] [data-slot="sidebar-wrapper"] > header,
  html[data-embed="1"] [data-slot="sidebar-inset"] > header { display: none !important; }
  html[data-embed="1"] [data-slot="sidebar-wrapper"] { --header-height: 0px; }
  html[data-embed="1"] [data-embed-only] { display: block !important; }
  /* F151 fix: in the embedded frame, hide the Next.js dev "N" button; keep the layout-settings gear in the bottom-right corner. */
  html[data-embed="1"] nextjs-portal { display: none !important; }
  html[data-embed="1"] [data-embed-only] { width: max-content; }
`;

export function EmbedBootScript() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-hydration boot script */}
      <script dangerouslySetInnerHTML={{ __html: code }} />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS for the embedded mode */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
