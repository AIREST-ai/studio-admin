/** @type {import('next').NextConfig} */
const nextConfig = {
  // F140: فهد يفتح Studio عبر Tailscale/الشبكة المنزلية؛ بدون هذا يحجب Next ملفات التفاعل فتتعطّل كل الأزرار
  allowedDevOrigins: ["100.86.173.123", "192.168.1.15", "127.0.0.1"],
  reactCompiler: true,
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
