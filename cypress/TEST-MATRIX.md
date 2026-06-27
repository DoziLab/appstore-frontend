# Cypress Integration Test Matrix — appstore-frontend

> Autogeneriert vor der Implementierung. Quelle: Repo-Analyse (Routing/Auth, Pages, Existing Tests) + Synthese durch ein Modell.
> Ziel: solide Kern-Suite (~25–40 Tests), API komplett gemockt (`cy.intercept`), Keycloak komplett gestubbt.

## Setup-Annahmen

- **Cypress** als neue Dev-Dependency, `cypress run` als npm script.
- **Keycloak-Stub**: window-level Shim, der vor App-Bootstrap das `keycloak-js`-Singleton ersetzt. Auth-State wird über Fixtures gewählt (`keycloak/lecturer.json`, `keycloak/admin.json`, `keycloak/unauthenticated.json`).
- **API-Base**: Cypress läuft gegen `http://localhost:5173` (Vite dev server). Alle Calls auf `/api/v1/**` werden via `cy.intercept` bedient — der Vite-Proxy wird damit umgangen.
- **data-testid**: minimal-invasiv ergänzt, nur dort wo role/text-basierte Selektoren brüchig wären.

## Custom Commands

| Command | Zweck |
| --- | --- |
| `cy.loginAs(role)` | Stubt Keycloak (Fixture nach Rolle) + besucht URL mit `onBeforeLoad`-Shim |
| `cy.stubKeycloak(fixture)` | Setzt das window-Shim für den Keycloak-Singleton |
| `cy.mockApi()` | Registriert die gängigen Intercepts (deployments, templates, quotas, projects) mit sinnvollen Defaults |
| `cy.expectNoRequest(alias)` | Asserts dass ein aliased Intercept nie gefeuert hat |

## data-testid Erweiterungen

| Selektor | Komponente |
| --- | --- |
| `deployment-row` | Dashboard- / Courses-Deployment-Karte |
| `wizard-step-indicator` | Wizard-Step-Pill |
| `template-card` | AppStore-Grid-Card |
| `approval-queue-row` | AdminMonitoring-Queue-Item |
| `delete-deployment-button`, `confirm-delete-button` | Deployment-Detail |

## Matrix

```
Bereich
└── Funktion
    └── Testfall [Prio · Typ]
        Ziel · Risiko bei Regression
```

### 1. routing-and-auth · keycloak-bootstrap-and-guards

- `auth-redirect-unauthenticated-to-login` **[P0 · permission]**
  Ziel: Unauth'd → /dashboard → Login-Screen, keine geschützten Calls. Risiko: Auth-Gate kaputt, anonymer Zugriff.
- `auth-authenticated-lands-on-dashboard` **[P0 · success]**
  Ziel: Lecturer mit Projekt landet auf /dashboard. Risiko: Setup-Loop.
- `auth-lecturer-without-project-trapped-in-setup` **[P0 · permission]**
  Ziel: Wildcard-Redirect auf /setup wenn kein Projekt. Risiko: API-403-Sturm.
- `auth-admin-bypasses-setup-gate` **[P0 · permission]**
  Ziel: Admin ohne Projekt darf trotzdem /dashboard und /admin. Risiko: Admin-Lockout.
- `auth-non-admin-cannot-access-admin-route` **[P0 · permission]**
  Ziel: Lecturer auf /admin geblockt. Risiko: Privilege Escalation.
- `auth-token-refresh-on-api-call` **[P1 · state]**
  Ziel: `updateToken` flippt Token, neue Bearer-Header gehen raus. Risiko: 401-Sturm.
- `auth-keycloak-init-error-banner` **[P1 · error]**
  Ziel: Init-Reject zeigt Error-UI. Risiko: Blank Screen wenn SSO down.
- `auth-logout-clears-session` **[P1 · success]**
  Ziel: Logout-Button ruft `keycloak.logout({redirectUri: origin})`. Risiko: Stale Tokens.
- `auth-github-callback-public-route` **[P2 · edge]**
  Ziel: `/github/connected` läuft ohne Auth durch. Risiko: OAuth-Bounce.

### 2. dashboard · deployment-summary-and-quotas

- `dashboard-renders-deployments-and-quotas` **[P0 · success]** — Liste + Quota-Bars rendern. Risiko: Perma-Loading.
- `dashboard-empty-state` **[P1 · edge]** — Empty-State + CTA zum AppStore. Risiko: Broken UI bei Erstkontakt.
- `dashboard-row-click-navigates-to-detail` **[P0 · success]** — Klick → `/deployment/{id}`. Risiko: Primärnavigation tot.
- `dashboard-api-error-shows-banner` **[P1 · error]** — 500 zeigt Banner mit Retry. Risiko: stille Backend-Fehler.
- `dashboard-expiry-warning-badge` **[P2 · state]** — Expiry-Icon bei naher Ablaufzeit. Risiko: verpasste Reminder.

### 3. appstore-templates · browse-and-filter-templates

- `appstore-lists-approved-templates` **[P0 · success]** — Cards mit Deploy-Button. Risiko: AppStore blank.
- `appstore-search-filters-templates` **[P1 · success]** — Suche filtert client-seitig. Risiko: großer Katalog unbenutzbar.
- `appstore-visibility-and-ownership-filters` **[P1 · state]** — Toggles narrowen Liste. Risiko: private Templates verloren.
- `appstore-empty-state-when-no-results` **[P2 · edge]** — „Keine Templates gefunden". Risiko: kein Feedback.
- `appstore-deploy-button-navigates-to-wizard` **[P0 · success]** — Deploy → `/deploy/{id}`. Risiko: Wizard-Entry tot.

### 4. deployment-wizard · multi-step-deploy

- `wizard-step0-validates-deployment-name` **[P0 · edge]** — Name-Regex blockt Continue. Risiko: kryptische BE-Fehler.
- `wizard-direct-to-review-shortcut` **[P1 · success]** — „Direkt zur Übersicht" springt zu Review. Risiko: Shortcut tot.
- `wizard-full-flow-to-deploy-success` **[P0 · success]** — Komplettlauf inkl. POST `/deployments`. Risiko: Kernprodukt tot.
- `wizard-deploy-api-error-stays-on-review` **[P0 · error]** — 500 hält Stand, Inputs bleiben. Risiko: Eingabeverlust.
- `wizard-cancel-returns-to-appstore` **[P1 · success]** — Cancel → `/appstore` ohne POST. Risiko: ungewolltes Deploy.
- `wizard-file-upload-converts-to-base64` **[P1 · success]** — `user_files` als base64 im Payload. Risiko: Files lautlos verloren.
- `wizard-retry-prefills-from-failed-deployment` **[P2 · state]** — Retry öffnet Wizard bei Review prefilled. Risiko: erneutes Tippen.

### 5. deployment-details · live-status-and-lifecycle

- `detail-renders-status-and-phases` **[P0 · success]** — Phasen+Progress bei Running. Risiko: Statuspanel kaputt.
- `detail-not-found-shows-error` **[P1 · error]** — 404 → „Deployment nicht gefunden". Risiko: App-Crash bei alten Links.
- `detail-delete-confirmation-flow` **[P0 · success]** — Delete → Bestätigung → DELETE → `/dashboard`. Risiko: Quota-Cleanup blockiert.
- `detail-delete-cancel-keeps-deployment` **[P1 · edge]** — Cancel im Dialog → kein DELETE. Risiko: destruktive Aktion ungeschützt.

### 6. courses · course-list-and-filter

- `courses-renders-grouped-deployments` **[P1 · success]** — Gruppierung nach Kurs. Risiko: Überblick verloren.
- `courses-prefix-filter-quick-button` **[P2 · state]** — WWI/WI/INF/WIN-Quick-Filter. Risiko: Liste unbenutzbar.

### 7. openstack-setup-and-config · credentials-setup

- `setup-form-submit-creates-project` **[P0 · success]** — POST /openstack-projects → /dashboard. Risiko: Onboarding tot.
- `setup-yaml-paste-parses-credentials` **[P1 · success]** — clouds.yaml-Parser füllt Felder. Risiko: manuelle Eingabe für alle.
- `setup-conflict-409-falls-back-to-update` **[P2 · edge]** — 409 → PUT mit extrahierter ID. Risiko: Re-Onboarding kaputt.
- `config-delete-project-confirmation` **[P1 · permission]** — Delete erfordert Bestätigung. Risiko: destruktiv ohne Schutz.

### 8. admin-monitoring · approval-queue

- `admin-queue-renders-pending-versions` **[P1 · success]** — Queue mit Approve/Reject. Risiko: Approvals stocken.
- `admin-approve-template-version` **[P0 · success]** — Approve entfernt Row. Risiko: Templates nie veröffentlicht.
- `admin-reject-with-reason` **[P1 · success]** — Reason landet im Payload. Risiko: Autoren ohne Feedback.

### 9. cross-cutting · toasts-loading-empty

- `loading-states-show-before-data-resolves` **[P1 · state]** — Spinner vor Daten sichtbar. Risiko: Flicker.
- `toast-on-github-connected-success` **[P2 · success]** — Success-Toast + Redirect. Risiko: UX-Signal weg.
- `toast-on-github-connected-error` **[P2 · error]** — Error-Toast mit Reason. Risiko: stille Fehler.

## Verteilung

- **P0** — 13 Tests (kritische Happy Paths + Auth-Guards)
- **P1** — 17 Tests (wichtige Edge/Error Cases)
- **P2** — 12 Tests (Nice-to-have)
- **Gesamt** — 42 Tests
