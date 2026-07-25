# Cypress Delta Test Matrix — staging update (2026-07)

> Ergänzung zur ursprünglichen `TEST-MATRIX.md`. Erfasst (A) Reparaturen bestehender Tests nach dem großen staging-Update (~7.800 geänderte src-Zeilen) und (B) neue Feature-Tests. Konventionen wie zuvor: Keycloak gestubbt, alle API via `cy.intercept` + Fixtures, keine festen Waits, stabile Selektoren.

## Kontext des Updates

Zwischen der Test-Baseline (`d1af1a7`) und `origin/staging` kamen u.a. hinzu: Student-Self-Service, Lecturer-Verwaltung (Admin), Admin-Rework (Split von `/admin` in `/admin/projects|templates|lecturers` mit `ProtectedRoute`), Redeploy/VM-Config-Override, Kurs-Filter, 36-Monate-Laufzeit, Expiry-Farbstufen, Owner-Only-Gating für Deployment-Aktionen, `NoRolePage`, `MobileTopBar`, `TemplateIconUpload`, `CredentialInstanceCard`.

## Teil A — Reparaturen (erledigt)

| Test | Ursache der Regression | Fix | Status |
| --- | --- | --- | --- |
| `auth-admin-bypasses-setup-gate` | `/admin` existiert nicht mehr (Split) | Ziel-Route → `/admin/projects`, Heading → „Projektübersicht" | ✅ e762bc2 |
| `admin-approve-template-version` | Approval-Queue nach `AdminTemplateApprovals` (`/admin/templates`) verschoben | `cy.loginAs("admin","/admin/templates")` | ✅ a3d1705 |
| `detail-delete-confirmation-flow` | Owner-Only-Gate (`fix/126`): Delete-Button ohne `owner_id` disabled | `owner_id: user-lec-1` in Fixture | ✅ a14815f |
| `auth-non-admin-cannot-access-admin-route` | War geskippt (Befund); jetzt via `ProtectedRoute requireAdmin` behoben | Neu geschrieben: Redirect `/admin/templates`→`/dashboard`, reaktiviert | ✅ 265a90d |
| `detail-issue-207-ungrouped-members` (fremd) | CourseGroupsCard-Rendering/Selektor geändert | in Arbeit (Sub-Agent) | 🔧 |

## Teil B — Neue Feature-Tests (geplant, P0/P1-Tiefe wie Bestand)

```
Bereich
└── Funktion
    └── Testfall [Prio · Typ] — Ziel · Risiko bei Regression
```

### student · self-service
- `student-dashboard-lists-deployments` **[P0 · success]** — Pure Student → `/student/dashboard`, `GET /api/v1/student/deployments` rendert Karten. Risiko: Studenten sehen ihre Umgebungen nicht.
- `student-dashboard-empty-state` **[P1 · edge]** — leere Liste → „Aktuell keine Deployments für dich verfügbar." Risiko: kaputter Erstkontakt.
- `student-role-routing-guard` **[P0 · permission]** — Pure Student auf `/dashboard`/`/appstore` → Redirect `/student/dashboard`. Risiko: Student sieht Lecturer-UI.
- `student-deployment-details-credentials` **[P1 · success]** — `/student/deployment/:id` lädt Credentials, `CredentialInstanceCard` (mode=student) rendert. Risiko: Zugangsdaten unerreichbar.

### admin · lecturer-management
- `lecturer-management-lists` **[P1 · success]** — `/admin/lecturers`, `GET /api/v1/lecturers` Tabelle. Risiko: Admin-Verwaltung tot.
- `lecturer-delete-cascade-poll` **[P1 · success]** — Detail-Dialog → „Account löschen" → Type-to-confirm → DELETE 202 → Poll 200→404 → Erfolg. Risiko: Cascade-Delete-Feedback bricht.

### admin · project-overview
- `admin-project-overview-renders` **[P1 · success]** — `/admin/projects`, Stat-Cards + View-Selector. Risiko: globale Übersicht kaputt.

### admin · template-approvals (reject)
- `admin-reject-template-with-reason` **[P1 · success]** — „Ablehnen" → Reason → POST `/reject` `{reason}`. Risiko: Autoren ohne Feedback.

### deployment · redeploy
- `redeploy-deployment-config-override` **[P1 · success]** — „Neu deployen" (running+owner) → Param ändern → POST `/redeploy` mit `deployment_parameter_overrides`+`preserve_credentials`. Risiko: Redeploy-Feature tot.
- `redeploy-only-owner-running` **[P1 · permission]** — Button disabled für Nicht-Owner / nicht-running. Risiko: unautorisierter Redeploy.

### courses · course-filters
- `course-filters-toggle-chip` **[P1 · state]** — Chip klicken filtert Kursliste client-seitig. Risiko: Filter unbenutzbar.
- `course-filters-admin-crud` **[P1 · success]** — Admin: Filter hinzufügen (POST) / löschen (DELETE). Risiko: Filterverwaltung kaputt.
- `course-filters-lecturer-readonly` **[P2 · permission]** — Lecturer sieht keine Add/Edit/Delete-Controls. Risiko: Nicht-Admin ändert Filter.

### wizard · runtime
- `wizard-36-months-runtime` **[P2 · edge]** — 36-Monate-Option („3 Jahre") wählbar, `runtime_months:36` im POST. Risiko: neue Laufzeit nicht buchbar.

### dashboard · expiry-tiers
- `dashboard-expiry-color-tiers` **[P2 · state]** — critical/warning/expired via dynamischen `expires_at` zeigen korrektes Icon. Risiko: verpasste Ablaufwarnungen.

### cross-cutting · mobile-nav
- `mobile-topbar-drawer-nav` **[P2 · state]** — `cy.viewport(375,667)` → Hamburger öffnet Sidebar-Drawer. Risiko: Mobile-Navigation kaputt.
```

## Priorisierung

- **P0**: student-dashboard-lists, student-role-routing-guard (Kern-Sicherheit + Kernpfad des neuen größten Bereichs)
- **P1**: student-details/-empty, lecturer-mgmt (2), admin-project-overview, admin-reject, redeploy (2), course-filters (2)
- **P2**: course-filters-readonly, 36-months, expiry-tiers, mobile-nav

Umfang orientiert sich am Bestand (P0/P1-Tiefe): kritische Happy-Paths + wichtigste Guards/Fehlerfälle pro Feature, keine erschöpfende Rollen-/Edge-Matrix.
