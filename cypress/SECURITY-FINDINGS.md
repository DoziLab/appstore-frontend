# Security findings discovered while writing the Cypress test suite

> These are real findings that surfaced while authoring integration tests against the appstore-frontend. They are NOT introduced by the tests — the tests merely revealed the existing behaviour. Each entry contains the finding, the proof, and the suggested fix. The associated Cypress spec is left in the repo as `describe.skip(...)` so it becomes a regression test the moment the production fix lands.

---

## 1. `/admin` is not gated on the frontend for non-admin users

**Severity**: High (privilege escalation, defence-in-depth)
**Discovered while writing**: `cypress/e2e/auth/auth-non-admin-cannot-access-admin-route.cy.ts`
**State**: Test is `describe.skip(...)` until the fix lands.

### Finding

`AdminMonitoring.tsx` has no role gate. `App.tsx` line 159 wires `<AdminMonitoring />` at `/admin` for any authenticated user. The Sidebar nav link IS gated (`Sidebar.tsx` line 121 checks `isAdmin`), but that is only a UI affordance, not a security boundary.

A user authenticated with `roles=["lecturer"]` (no admin role) who navigates directly to `/admin` sees:

- the full `Administration` heading and tabbed UI;
- `getAllDeployments(null)` is fired — returns the **global** deployment list (every lecturer's work), not just their own;
- `getTemplateVersionsQueue({ status: "pending", visibility: "public" })` is fired — the approval queue is rendered;
- Approve / Reject buttons are wired and will call `approveTemplateVersion()` / `rejectTemplateVersion()` against the backend if clicked.

The backend is the only line of defence on those endpoints. Any backend regression on admin-only enforcement immediately becomes a frontend-visible escalation.

### Empirical proof

Running the unskipped test produced:

```
AssertionError: Timed out retrying after 8000ms: Expected not to find content:
'/^Administration$/' but continuously found it.
```

The lecturer's browser sat on `/admin` with the full admin H1 rendered for the entire 8s wait window. The `@getTemplateVersions` intercept also recorded a call, proving the data-fetch effects ran.

### Suggested fix

Inside `src/pages/AdminMonitoring.tsx`, before the first `useState`/`useEffect`:

```tsx
import { useCurrentUser } from "../auth/useCurrentUser";

export function AdminMonitoring() {
  const { isAdmin } = useCurrentUser();
  if (!isAdmin) return null; // or a "Zugriff verweigert"-Card if a visible state is preferred
  // … existing implementation
}
```

After this fix:

- Lecturers hitting `/admin` see an empty page (or the explicit denied card).
- The admin-only `useEffect`s never run, so `getTemplateVersionsQueue` / `getAllDeployments` are not called for non-admins.
- The skipped test (`auth-non-admin-cannot-access-admin-route.cy.ts`) can have its `.skip` dropped — its three invariants will then hold and pin the gate.

### Optional hardening: route-level guard

For belt-and-braces, also gate the route in `App.tsx`:

```tsx
<Route path="/admin" element={isAdmin ? <AdminMonitoring /> : <Navigate to="/dashboard" replace />} />
```

This makes the protection observable in the router and prevents the page from mounting at all for non-admins.
