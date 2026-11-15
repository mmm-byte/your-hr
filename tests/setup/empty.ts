/**
 * An empty module, aliased in place of `server-only` in the test config.
 *
 * The `server-only` marker throws when a module is imported outside a React
 * Server Component. A test file is neither a Server Component nor a browser
 * bundle, so the marker is aliased to this module: the guard exists to stop
 * server code reaching the browser, and it must not stop that code being
 * tested.
 */
export {};
