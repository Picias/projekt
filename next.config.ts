import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // pdf-parse ciągnie pdfjs-dist i natywne @napi-rs/canvas — bundler Nexta
  // łamie ich workerów, więc zostawiamy je Node'owi.
  serverExternalPackages: ["pdf-parse", "pdf-parse/worker", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
