/**
 * Boot script that reads user preference values from cookies or localStorage
 * based on the configured persistence mode.
 *
 * Runs early in <head> to apply the correct data attributes before hydration,
 * preventing layout or theme flicker and keeping RootLayout fully static.
 */
import { PREFERENCE_REGISTRY } from "@/lib/preferences/preferences-config";

export function ThemeBootScript() {
  const registry = JSON.stringify(PREFERENCE_REGISTRY);

  const code = `
    (function () {
      try {
        var root = document.documentElement;
        var REGISTRY = ${registry};

        function readCookie(name) {
          var match = document.cookie.split("; ").find(function(c) {
            return c.startsWith(name + "=");
          });
          return match ? decodeURIComponent(match.split("=")[1]) : null;
        }

        function readLocal(name) {
          try {
            return window.localStorage.getItem(name);
          } catch (e) {
            return null;
          }
        }

        function readPreference(key, definition) {
          var mode = definition.persistence;
          var value = null;

          if (mode === "localStorage") {
            value = readLocal(key);
          }

          if (!value && (mode === "client-cookie" || mode === "server-cookie")) {
            value = readCookie(key);
          }

          return definition.values.indexOf(value) >= 0 ? value : definition.defaultValue;
        }

        var preferences = {};

        Object.keys(REGISTRY).forEach(function(key) {
          var definition = REGISTRY[key];
          var value = readPreference(key, definition);

          preferences[key] = value;
          root.setAttribute(definition.attribute, value);
        });

        var mode = preferences.theme_mode;
        // V-24: default is dark. Only an explicit "light" (or system+light OS) turns the class off.
        function applyResolved() {
          var currentMode = root.getAttribute("data-theme-mode") || mode;
          var wantDark;
          if (currentMode === "light") {
            wantDark = false;
          } else if (currentMode === "system" && window.matchMedia) {
            wantDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          } else {
            wantDark = true;
          }
          root.classList.toggle("dark", wantDark);
          root.style.colorScheme = wantDark ? "dark" : "light";
        }

        applyResolved();

        // React 19 streaming hydration on async pages (e.g. /dashboard/calls)
        // can strip html.dark after this script. Restore it while the
        // stored preference still wants dark.
        if (typeof MutationObserver === "function") {
          var observer = new MutationObserver(function () {
            applyResolved();
          });
          observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme-mode"] });
        }

      } catch (e) {
        console.warn("ThemeBootScript error:", e);
      }
    })();
  `;

  /* biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-hydration boot script */
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
