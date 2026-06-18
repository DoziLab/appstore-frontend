import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { OpenstackProjectResponse } from "../api/openstackProjects";

/**
 * Active OpenStack project context.
 *
 * The backend's deployment endpoints require the local DB id of the user's
 * OpenStack project as `?openstack_project_id=...` (and inside the create
 * body). Today the user has at most one project active at a time — switching
 * happens by editing it in Settings — so we keep a single value here and
 * read it from anywhere in the app via {@link useActiveOpenstackProject}.
 *
 * The project is loaded once in `App.tsx` (which already calls
 * `listOpenstackProjects()` for the initial routing decision), and that
 * value is passed in via the provider's `project` prop.
 *
 * IMPORTANT: `activeProjectId` is `OpenstackProjectResponse.id` — the local
 * DB primary key — NOT `openstack_project_id` (which is the Keystone tenant
 * UUID). Same naming pitfall as on the Bruno collection side.
 */
type OpenstackProjectContextValue = {
  /** Local DB id of the active OpenstackProject row, or null if the user has none. */
  activeProjectId: string | null;
  /** Full project record, or null. Useful when components want the project name. */
  project: OpenstackProjectResponse | null;
};

const OpenstackProjectContext = createContext<OpenstackProjectContextValue>({
  activeProjectId: null,
  project: null,
});

export function OpenstackProjectProvider({
  project,
  children,
}: {
  project: OpenstackProjectResponse | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ activeProjectId: project?.id ?? null, project }),
    [project]
  );
  return (
    <OpenstackProjectContext.Provider value={value}>
      {children}
    </OpenstackProjectContext.Provider>
  );
}

export function useActiveOpenstackProject(): OpenstackProjectContextValue {
  return useContext(OpenstackProjectContext);
}
