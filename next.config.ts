import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * `serverExternalPackages` keeps Node-only drivers out of the bundler.
   *
   * The Neon serverless client and `ws` are required at runtime for the
   * transaction-capable driver (D-015): `drizzle-orm/neon-serverless` opens a
   * WebSocket connection through the `Pool`, and bundling either package breaks
   * that connection.
   */
  serverExternalPackages: ['@neondatabase/serverless', 'ws'],

  /**
   * Typed routes are generated from the app directory. They give a compile-time
   * error when a link points at a route that does not exist, which is how the
   * route map in `docs/UX-JOURNEY.md` §2 stays honest as pages are added.
   */
  typedRoutes: true,

  // Emit a build that Vercel and any other Node host can run.
  output: 'standalone',
};

export default nextConfig;
