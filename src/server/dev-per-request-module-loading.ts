// F-15 (2026-10-15): dev-only workaround for a Next.js 16.3.8 dev-server bug behind the intermittent 500s
// «Missing PreferencesStoreProvider» and «module factory is not available» under parallel requests.
//
// Next installs the loaders that SSR uses to load client components on two process-wide globals,
// globalThis.__next_require__ and __next_chunk_load__, once per request (installGlobalModuleLoadingHandlers in
// node_modules/next/dist/server/app-render/app-render.js:1465), and React's Flight client reads them on every client
// component it resolves (react-server-dom-turbopack-client.node.development.js:68, :90 and :109). With
// experimental.turbopackServerFastRefresh false (next.config.mjs, T-245), every rebuild drops the Turbopack server
// runtime from require.cache (hot-reloader-turbopack.js:533-559), so pages loaded after it run on a new runtime with
// its own module cache while pages loaded before keep the old one. A second request that starts mid-render replaces
// the globals, and the first request then loads part of its client components from the other runtime: two copies of
// preferences-provider.tsx (two contexts, so AppSidebar finds none), or a module whose chunk was loaded only into the
// other runtime («module factory is not available»).
//
// F-15 q3 (2026-10-16): this file is imported conditionally from src/app/layout.tsx under
// NODE_ENV === "development" && process.env.TURBOPACK, so the internal path below is reached in development only and
// stays out of the production bundle. The module-level check at the end of the file remains as the second guard.
//
// The fix keeps the two globals but makes each request read back its own loaders: the value Next sets is stored
// against the request's WorkStore (the AsyncLocalStorage Next runs every render in, a single shared instance:
// next/dist/server/app-render/work-async-storage.external), and read from it. Outside a request, or for a request
// that did not set them, the last value set is returned, exactly as before. Development with Turbopack only; installed
// once per process, so a change to this file takes effect after the next restart of the dev server.
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";

type Loader = (...args: unknown[]) => unknown;
type Globals = Record<PropertyKey, unknown>;

const INSTALLED = Symbol.for("studio-admin.f15.per-request-module-loading");

function keepPerRequest(name: "__next_require__" | "__next_chunk_load__") {
  const globals = globalThis as unknown as Globals;
  const byRequest = new WeakMap<object, Loader>();
  let latest = globals[name] as Loader | undefined;
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: false,
    get() {
      const store = workAsyncStorage.getStore();
      return (store && byRequest.get(store)) ?? latest;
    },
    set(loader: Loader) {
      latest = loader;
      const store = workAsyncStorage.getStore();
      if (store) byRequest.set(store, loader);
    },
  });
}

const globals = globalThis as unknown as Globals;
if (process.env.NODE_ENV === "development" && process.env.TURBOPACK && !globals[INSTALLED]) {
  globals[INSTALLED] = true;
  keepPerRequest("__next_require__");
  keepPerRequest("__next_chunk_load__");
}
