/// <reference path="../../support/index.d.ts" />

// Visual-regression capture spec
// ──────────────────────────────
// This spec navigates each page in two viewports (desktop 1440×900 and
// mobile 390×844) and calls cy.screenshot(). It does not assert layout —
// the caller compares baseline vs. current PNGs side-by-side.

type PageSpec = {
  slug: string;
  url: string;
  role: "lecturer" | "admin" | "student";
  ready: string;
  overrides?: Record<string, { fixture?: string; body?: any; statusCode?: number }>;
};

const PAGES: PageSpec[] = [
  {
    slug: "01-dashboard",
    url: "/dashboard",
    role: "lecturer",
    ready: "Dashboard",
    overrides: { getDeployments: { fixture: "deployments/list-3.json" } },
  },
  { slug: "02-appstore", url: "/appstore", role: "lecturer", ready: "App Store" },
  { slug: "03-courses", url: "/courses", role: "lecturer", ready: "Kurse" },
  { slug: "04-config-settings", url: "/config", role: "lecturer", ready: "Einstellungen" },
  {
    slug: "05-admin-projects",
    url: "/admin/projects",
    role: "admin",
    ready: "Projektübersicht",
    overrides: { getDeployments: { fixture: "deployments/list-3.json" } },
  },
  {
    slug: "06-admin-templates",
    url: "/admin/templates",
    role: "admin",
    ready: "Template-Freigaben",
  },
  {
    slug: "07-admin-lecturers",
    url: "/admin/lecturers",
    role: "admin",
    ready: "Dozenten-Verwaltung",
  },
  {
    slug: "08-student-dashboard",
    url: "/student/dashboard",
    role: "student",
    ready: "Meine Deployments",
  },
];

const VIEWPORTS = [
  { folder: "desktop", w: 1440, h: 900 },
  { folder: "mobile", w: 390, h: 844 },
] as const;

function mockStudentApis() {
  cy.intercept("GET", "/api/v1/student/deployments*", {
    statusCode: 200,
    body: { success: true, data: [], errors: [], timestamp: "2026-07-01T00:00:00Z", request_id: "test" },
  }).as("getStudentDeployments");
}

describe("visual capture", () => {
  for (const vp of VIEWPORTS) {
    describe(`viewport=${vp.folder} (${vp.w}×${vp.h})`, () => {
      beforeEach(() => {
        cy.viewport(vp.w, vp.h);
      });

      for (const page of PAGES) {
        it(`renders ${page.slug}`, () => {
          cy.mockApi(page.overrides ?? {});
          mockStudentApis();
          cy.loginAs(page.role, page.url);
          // Scope to the page <h1>: the ready strings (e.g. "Dashboard",
          // "Kurse") also appear as sidebar nav links, which are hidden on
          // mobile — matching them would fail the visibility assertion.
          cy.contains("h1", page.ready, { timeout: 15000 }).should("be.visible");
          cy.wait(400);
          cy.screenshot(`${vp.folder}/${page.slug}`, {
            capture: "viewport",
            overwrite: true,
          });
        });
      }

      if (vp.folder === "mobile") {
        it("renders mobile drawer open", () => {
          cy.mockApi();
          mockStudentApis();
          cy.loginAs("lecturer", "/dashboard");
          cy.contains("h1", "Dashboard").should("be.visible");
          cy.get('[aria-label="Menü öffnen"]').click();
          // Two sidebars live in the DOM: the desktop one (hidden md:flex) and
          // the drawer's. Scope to the open Sheet dialog so we match the
          // drawer's visible "Kurse" link, not the hidden desktop nav.
          cy.get('[role="dialog"]').contains("Kurse").should("be.visible");
          cy.wait(500);
          cy.screenshot("mobile/09-drawer-open", {
            capture: "viewport",
            overwrite: true,
          });
        });
      }
    });
  }
});
