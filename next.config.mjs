import withSerwistInit from "@serwist/next";
import { fileURLToPath } from "node:url";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

/** @type {import('next').NextConfig} */
const nextConfig = { outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)) };

export default withSerwist(nextConfig);
