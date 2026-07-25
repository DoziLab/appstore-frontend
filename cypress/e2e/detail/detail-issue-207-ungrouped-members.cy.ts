/// <reference path="../../support/index.d.ts" />

// issue-207-ungrouped-members
// ───────────────────────────
// Visual repro for issue #207: a course member who is in NO group must appear
// in an "Ohne Gruppe" section of the CourseGroupsCard ("Gruppen & Mitglieder"),
// with a group <Select> + "Hinzufügen" button that POSTs to
// /api/v1/courses/{id}/groups/{groupId}/members (addGroupMembers).
//
// Fixture setup: course-alpha has 3 active members (cm-1, cm-2, cm-3). cm-1 is
// in grp-1, cm-2 is in grp-2 — so cm-3 (user u3-neu) is ungrouped and must
// surface in the amber "Ohne Gruppe" block.

describe("DeploymentDetails · issue #207 ungrouped course members", () => {
  beforeEach(() => {
    cy.mockApi();

    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001*", (req) => {
      if (req.url.includes("/logs")) return;
      req.reply({ fixture: "deployments/detail-running.json" });
    }).as("getDeployment");

    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs*", {
      fixture: "deployments/logs-heat-ansible.json",
    }).as("getLogs");
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs/stream*", {
      statusCode: 200,
      body: "",
    }).as("getLogsStream");
    cy.intercept("GET", "/api/v1/openstack/flavors*", {
      statusCode: 200,
      body: { flavors: [] },
    }).as("getOpenstackFlavors");
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakAdminGroups");

    // Course endpoints driving CourseGroupsCard.
    cy.intercept("GET", "/api/v1/courses/course-alpha/groups", {
      fixture: "courses/groups-two.json",
    }).as("getCourseGroups");
    cy.intercept("GET", "/api/v1/courses/course-alpha/members", {
      fixture: "courses/members-with-ungrouped.json",
    }).as("getCourseMembers");
    cy.intercept(
      "GET",
      "/api/v1/courses/course-alpha/groups/grp-1/members",
      { fixture: "courses/group-members-grp1.json" },
    ).as("getGrp1Members");
    cy.intercept(
      "GET",
      "/api/v1/courses/course-alpha/groups/grp-2/members",
      { fixture: "courses/group-members-grp2.json" },
    ).as("getGrp2Members");

    // POST add-to-group — echo back a created group member for cm-3.
    cy.intercept(
      "POST",
      "/api/v1/courses/course-alpha/groups/grp-1/members",
      {
        statusCode: 201,
        body: {
          success: true,
          message: "Added 1 member(s) to group successfully",
          data: [
            {
              id: "gm-new",
              group_id: "grp-1",
              course_member_id: "cm-3",
              joined_at: "2026-07-24T12:00:00Z",
            },
          ],
          errors: null,
          timestamp: "2026-07-24T12:00:00Z",
          request_id: "req-add",
        },
      },
    ).as("addGroupMembers");
  });

  it("shows the 'Ohne Gruppe' section and adds the member to a group", () => {
    cy.loginAs("lecturer", "/deployment/dep-alpha-0001");
    cy.wait(["@getDeployment", "@getLogs"]);
    cy.contains("h1", "test-deploy-alpha").should("be.visible");

    // Expand the card. The card sits far down the page inside a scroll
    // container, so bring its title into view before asserting visibility.
    cy.contains("Gruppen & Mitglieder").scrollIntoView().should("be.visible");
    cy.contains("button", "Anzeigen").scrollIntoView().click();
    cy.wait(["@getCourseGroups", "@getCourseMembers"]);

    // The ungrouped section must appear with the new member.
    cy.contains("Ohne Gruppe").scrollIntoView().should("be.visible");
    cy.contains(
      "Der Student erhält erst Zugriff, wenn er einer zugewiesenen Gruppe hinzugefügt wird.",
    ).should("be.visible");
    cy.contains("u3-neu").should("be.visible");

    cy.screenshot("issue-207-ohne-gruppe-section", { capture: "viewport" });

    // Choose a group and add.
    cy.contains("li", "u3-neu").within(() => {
      cy.get("button").contains("Hinzufügen").should("be.disabled");
      cy.get("[role='combobox']").click();
    });
    cy.get("[role='option']").contains("Gruppe A").click();
    cy.contains("li", "u3-neu").within(() => {
      cy.get("button").contains("Hinzufügen").click();
    });

    cy.wait("@addGroupMembers").its("request.body").should("deep.equal", {
      member_ids: ["cm-3"],
    });

    // After the add, the ungrouped member is gone from "Ohne Gruppe".
    cy.contains("Ohne Gruppe").should("not.exist");
    cy.screenshot("issue-207-after-add", { capture: "viewport" });
  });
});
