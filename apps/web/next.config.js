/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  // Disable PWA in development to avoid stale Server Action errors (cached JS vs new build).
  // Set PWA_DISABLED=true to also disable in production when needed.
  disable: process.env.NODE_ENV === "development" || process.env.PWA_DISABLED === "true",
  register: true,
  skipWaiting: true,
  // Offline-first: cache app shell and API when possible
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 10,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sils/shared-types"],
  // In dev, use memory cache to avoid PackFileCacheStrategy "Serializing big strings" warning
  webpack: (config, { dev }) => {
    if (dev && config.cache && typeof config.cache === "object") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
