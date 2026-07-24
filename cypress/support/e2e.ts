// Cypress support file — loaded before every spec.
//
// - Imports the custom commands (cy.loginAs, cy.stubKeycloak, cy.mockApi,
//   cy.expectNoRequest).
// - Polyfills crypto.randomUUID into the AUT window (defense in depth; the
//   production code in src/main.tsx already polyfills it).
// - Filters out the noisy ResizeObserver loop limit error that some Radix /
//   Recharts components trigger during layout — it is benign and shouldn't
//   fail a test.

import "./commands";

Cypress.on("window:before:load", (win) => {
  const c = (win as any).crypto;
  if (c && typeof c.randomUUID !== "function" && typeof c.getRandomValues === "function") {
    c.randomUUID = function randomUUID(): string {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
  }
});

Cypress.on("uncaught:exception", (err) => {
  // ResizeObserver loop limit exceeded is benign UI noise.
  if (/ResizeObserver loop/i.test(err.message)) {
    return false;
  }
  // Let everything else bubble up and fail the test.
  return undefined;
});
