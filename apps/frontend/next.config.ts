import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["dotenv"],

  // TypeScript 7's compiler (tsgo) doesn't expose the old Program/LanguageService
  // API Next's built-in type-checker calls directly — this tells Next to shell out
  // to the `tsc` CLI instead, which TS7 does support.
  experimental: {
    useTypeScriptCli: true,
  },

  // Next 16 runs Turbopack by default. An empty object is a valid, explicit
  // "Turbopack needs no special configuration here" — without it, Next errors out
  // because a `webpack` key is present but no `turbopack` one, assuming the webpack
  // config was meant to be migrated and was forgotten.
  turbopack: {},

  // Only consulted when building with `next build --webpack`. Turbopack resolves
  // hammerjs correctly on its own (verified: the Turbopack build prerenders every
  // chart page without this alias), but the workaround is kept so the webpack
  // fallback keeps working rather than silently regressing.
  webpack: (config, { isServer }) => {
    if (isServer) {
      // hammerjs (required by chartjs-plugin-zoom) accesses `window` at module
      // evaluation time and crashes during Next.js server-side prerendering.
      // Resolve it to an empty module on the server; the real library loads only
      // in the browser where `window` exists.
      config.resolve.alias = {
        ...config.resolve.alias,
        hammerjs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
