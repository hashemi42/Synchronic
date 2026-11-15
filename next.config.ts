import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The page's metadata depends on the query (NF-6 link previews) but is computed in memory, so
  // every visitor gets it in <head> at once rather than streamed after the content.
  htmlLimitedBots: /.*/,
  // harfbuzzjs loads its .wasm from its own folder at run time, so it is not bundled.
  serverExternalPackages: ["harfbuzzjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
