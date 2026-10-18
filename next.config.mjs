/** @type {import('next').NextConfig} */
const nextConfig = {
  // F140: فهد يفتح Studio عبر Tailscale/الشبكة المنزلية؛ بدون هذا يحجب Next ملفات التفاعل فتتعطّل كل الأزرار
  allowedDevOrigins: ["100.86.173.123", "192.168.1.15", "127.0.0.1", "100.73.3.21", "100.78.122.119", "fahad-server-1"],
  reactCompiler: true,
  // F-5B (2026-10-15): the dev-mode "N" badge sat over "Create and send" on /dashboard/invoice. false hides it; Next still
  // shows compile/runtime errors (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/devIndicators.md).
  devIndicators: false,
  experimental: {
    // T-245 (2026-10-14 18:06): server Fast Refresh (default on in Next 16.3) patches server modules in memory and
    // never re-reads them from disk. After a passing "Module not found" while another worker edits, it stops applying
    // updates: SSR stays on the old code until restart while the browser gets the new one, so Hydration fails.
    // Off = Next clears its server cache on each change and renders from the chunks on disk (they are correct).
    turbopackServerFastRefresh: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
