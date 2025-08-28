// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  // keep PWA off in dev to avoid confusion
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*\.(png|jpe?g|webp|svg|gif)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /^https?.*\.(js|css|woff2?|ttf|eot)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-resources",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
  ],
  fallbacks: {
    document: "/offline", // make sure you have /app/offline/page.(tsx|jsx)
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // ➜ IMPORTANT: let Webpack load .wasm used by tesseract.js
  webpack: (config, { isServer }) => {
    // enable async WebAssembly
    config.experiments = {
      ...(config.experiments || {}),
      asyncWebAssembly: true,
    };

    // treat .wasm as async modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // make sure Node-only modules don't break client bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

module.exports = withPWA(nextConfig);
