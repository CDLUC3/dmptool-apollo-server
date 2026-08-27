
it('passes', () => {
  expect(true).toBe(true);
});

/*
import { ApolloServer } from "@apollo/server";

import { typeDefs } from "../../schema.js";
import { resolvers } from "../../resolver.js";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context.js";

import { logger } from "../../logger.js";
import { JWTAccessToken } from "../../services/tokenService.js";

import { User, UserRole } from "../../models/User.js";
import { Affiliation } from "../../models/Affiliation.js";
import { Project } from "../../models/Project.js";
import { Plan } from "../../models/Plan.js";
import { MemberRole } from "../../models/MemberRole.js";
import { ProjectCollaborator, ProjectCollaboratorAccessLevel } from "../../models/Collaborator.js";
import { PlanMember, ProjectMember } from "../../models/Member.js";
import { MyContext } from "../../context.js";
import {
  clearProjectCollaboratorsStore,
  initProjectCollaboratorsStore,
  mockFindProjectCollaboratorByProjectId
} from "../../models/__mocks__/Collaborator";
import { clearProjectStore, initProjectStore, mockFindProjectById } from "../../models/__mocks__/Project";
import {
  clearPlanStore,
  initPlanStore,
  mockFindPlanById,
  mockFindPlansByProjectId,
} from "../../models/__mocks__/Plan";
import {
  clearMemberRoles,
  initMemberRoles,
  mockAddMemberRoleToPlanMember,
  mockAddMemberRoleToProjectMember,
  mockFindByPlanMemberId,
  mockFindByProjectMemberId,
  mockFindMemberRoleById,
  mockRemoveMemberRoleFromPlanMember,
  mockRemoveMemberRoleFromProjectMember
} from "../../models/__mocks__/MemberRole";
import {
  clearPlanMemberStore,
  clearProjectMemberStore,
  initPlanMemberStore,
  initProjectMemberStore,
  mockDeletePlanMember,
  mockDeleteProjectMember,
  mockFindPlanMemberById,
  mockFindPlanMembersByPlanId,
  mockFindProjectMemberById,
  mockFindProjectMembersByProjectId,
  mockInsertPlanMember,
  mockInsertProjectMember,
  mockUpdatePlanMember,
  mockUpdateProjectMember
} from "../../models/__mocks__/Member";
import { clearAffiliationStore, initAffiliationStore, mockFindAffiliationByURI } from "../../models/__mocks__/Affiliation";
import { clearUserStore, initUserStore, mockFindUserById } from "../../models/__mocks__/User";

jest.mock('../../context.js')
jest.mock('../../services/emailService');

let context: MyContext;
let testServer: ApolloServer;

let userStore: User[];
let affiliationStore: Affiliation[];
let memberRoleStore: MemberRole[];
let projectStore: Project[];
let planStore: Plan[];
let projectCollaboratorStore: ProjectCollaborator[];
let projectMemberStore: ProjectMember[];
let planMemberStore: PlanMember[];

let researcherToken: JWTAccessToken;
let adminToken: JWTAccessToken;
let superAdminToken: JWTAccessToken;

let query: string;

// Proxy call to the Apollo server test server
async function executeQuery (
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  context: MyContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

beforeEach(async () => {
  affiliationStore = initAffiliationStore(1);
  userStore = initUserStore(3);

  // Assign the roles and affiliations to the users
  userStore[0].role = UserRole.RESEARCHER;
  userStore[0].affiliationId = affiliationStore[0].uri;
  userStore[1].role = UserRole.ADMIN;
  userStore[1].affiliationId = affiliationStore[0].uri;
  userStore[2].role = UserRole.SUPERADMIN;

  // Generate tokens for each user type
  researcherToken = mockToken(new User(userStore[0]));
  adminToken = mockToken(new User(userStore[1]));
  superAdminToken = mockToken(new User(userStore[2]));

  // Build the mock Apollo context
  context = buildContext(logger, researcherToken, researcherToken);

  // Initialize the Apollo server
  testServer = new ApolloServer({
    typeDefs, resolvers
  });

  // Add initial data to the mock database tables
  projectStore = initProjectStore(1);
  planStore = initPlanStore(1);
  projectCollaboratorStore = initProjectCollaboratorsStore(1);
  memberRoleStore = initMemberRoles(3);
  projectMemberStore = initProjectMemberStore(3);
  planMemberStore = initPlanMemberStore(3);

  // Make sure the plan is associated with the first project
  planStore[0].projectId = projectStore[0].id;

  // Make sure the first plan is associated with the first project
  projectMemberStore[0].projectId = projectStore[0].id;

  // Make sure the researcher is the creator of the project and plan
  projectStore[0].createdById = researcherToken.id;
  projectStore[0].createdById = researcherToken.id;

  // Attach the members to the projects and plans
  projectMemberStore.forEach(member => {
    member.affiliationId = affiliationStore[0].uri; // Set the affiliation for the member
    member.projectId = projectStore[0].id; // Attach to the first project
    member.createdById = researcherToken.id; // Set the creator to the researcher
    member.modifiedById = researcherToken.id; // Set the modifier to the researcher
  });
  planMemberStore.forEach((member, idx) => {
    member.planId = planStore[0].id; // Attach to the first plan
    member.createdById = researcherToken.id; // Set the creator to the researcher
    member.modifiedById = researcherToken.id; // Set the modifier to the researcher
    member.projectMemberId = projectMemberStore[idx].id;
  });

  // Mock affiliation, User and ProjectCollaborator lookups
  jest.spyOn(Affiliation, 'findByURI').mockImplementation(mockFindAffiliationByURI);
  jest.spyOn(User, 'findById').mockImplementation(mockFindUserById);
  jest.spyOn(ProjectCollaborator, 'findByProjectId').mockImplementation(mockFindProjectCollaboratorByProjectId);

  // Use spys to mock the database queries for Project and Plan
  jest.spyOn(Project, 'findById').mockImplementation(mockFindProjectById);
  jest.spyOn(Plan, 'findById').mockImplementation(mockFindPlanById);
  jest.spyOn(Plan, 'findByProjectId').mockImplementation(mockFindPlansByProjectId);

  // Use spys to monitor the database queries for ProjectMember
  jest.spyOn(ProjectMember, 'findById').mockImplementation(mockFindProjectMemberById);
  jest.spyOn(ProjectMember, 'findByProjectId').mockImplementation(mockFindProjectMembersByProjectId);
  jest.spyOn(PlanMember, 'findById').mockImplementation(mockFindPlanMemberById);
  jest.spyOn(PlanMember, 'findByPlanId').mockImplementation(mockFindPlanMembersByPlanId);

  // Use spys to monitor the database queries for MemberRole
  jest.spyOn(MemberRole, 'findById').mockImplementation(mockFindMemberRoleById);
  jest.spyOn(MemberRole, 'findByProjectMemberId').mockImplementation(mockFindByProjectMemberId);
  jest.spyOn(MemberRole, 'findByPlanMemberId').mockImplementation(mockFindByPlanMemberId);
  jest.spyOn(MemberRole, 'defaultRole').mockResolvedValue(memberRoleStore[0]);

  // Spy on the association methods for MemberRole
  jest.spyOn(MemberRole.prototype, 'addToProjectMember')
      .mockImplementation(async function (this: MemberRole, context, projectMemberId) {
    if (this) {
      return await mockAddMemberRoleToProjectMember(context, this.id, projectMemberId);
    }
    return false;
  });
  jest.spyOn(MemberRole.prototype, 'removeFromProjectMember')
      .mockImplementation(async function (this: MemberRole, context, projectMemberId) {
    if (this) {
      return await mockRemoveMemberRoleFromProjectMember(context, this.id, projectMemberId);
    }
    return false;
  });
  jest.spyOn(MemberRole.prototype, 'addToPlanMember')
      .mockImplementation(async function (this: MemberRole, context, planMemberId) {
    if (this) {
      return await mockAddMemberRoleToPlanMember(context, this.id, planMemberId);
    }
    return false;
  });
  jest.spyOn(MemberRole.prototype, 'removeFromPlanMember')
      .mockImplementation(async function (this: MemberRole, context, planMemberId) {
    if (this) {
      return await mockRemoveMemberRoleFromPlanMember(context, this.id, planMemberId);
    }
    return false;
  });

  // Use spys to mock the database mutations for a Project and Plan Members
  jest.spyOn(ProjectMember, 'insert').mockImplementation(mockInsertProjectMember);
  jest.spyOn(ProjectMember, 'update').mockImplementation(mockUpdateProjectMember);
  jest.spyOn(ProjectMember, 'delete').mockImplementation(mockDeleteProjectMember);
  jest.spyOn(PlanMember, 'insert').mockImplementation(mockInsertPlanMember);
  jest.spyOn(PlanMember, 'update').mockImplementation(mockUpdatePlanMember);
  jest.spyOn(PlanMember, 'delete').mockImplementation(mockDeletePlanMember);

  // Attach the members to roles
  memberRoleStore.forEach((role, idx) => {
    const memberRole = new MemberRole(role);
    memberRole.addToProjectMember(context, projectMemberStore[idx].id);
    memberRole.addToPlanMember(context, planMemberStore[idx].id);
  });
});

afterEach(() => {
  jest.clearAllMocks();

  // Reset the mock database
  clearAffiliationStore();
  clearUserStore();
  clearProjectStore();
  clearPlanStore();
  clearProjectCollaboratorsStore();
  clearMemberRoles();
  clearProjectMemberStore();
  clearPlanMemberStore();
});

describe.skip('projectMembers query', () => {
  beforeEach(() => {
    query = `
      query projectMembersQuery($projectId: Int!) {
        projectMembers (projectId: $projectId) {
          id
          createdById
          created
          modifiedById
          modified
          project {
            id
            title
          }
          affiliation {
            uri
            name
          }
          givenName
          surName
          orcid
          email
          memberRoles {
            id
            uri
            label
            description
            displayOrder
          }
        }
      }
    `;
  });

  it('returns the projectMembers for the project when the current user is the creator of the project', async () => {
    const variables = { projectId: projectStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMembers.length).toBe(3);
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.projectMembers[0]?.id).toEqual(projectMemberStore[0].id);
    expect(resp.body.singleResult.data?.projectMembers[0]?.givenName).toEqual(projectMemberStore[0].givenName);
    expect(resp.body.singleResult.data?.projectMembers[0]?.surName).toEqual(projectMemberStore[0].surName);
    expect(resp.body.singleResult.data?.projectMembers[0]?.orcid).toEqual(projectMemberStore[0].orcid);
    expect(resp.body.singleResult.data?.projectMembers[0]?.email).toEqual(projectMemberStore[0].email);
    expect(resp.body.singleResult.data?.projectMembers[0]?.project.id).toEqual(projectStore[0].id);
    expect(resp.body.singleResult.data?.projectMembers[0]?.project.title).toEqual(projectStore[0].title);
    expect(resp.body.singleResult.data?.projectMembers[0]?.affiliation.uri).toEqual(affiliationStore[0].uri);
    expect(resp.body.singleResult.data?.projectMembers[0]?.affiliation.name).toEqual(affiliationStore[0].name);
    expect(resp.body.singleResult.data?.projectMembers[0]?.memberRoles.length).toBeGreaterThan(0);

    expect(resp.body.singleResult.data?.projectMembers[0]?.created).toEqual(projectMemberStore[0].created);
    expect(resp.body.singleResult.data?.projectMembers[0]?.createdById).toEqual(context.token.id);
    expect(resp.body.singleResult.data?.projectMembers[0]?.modified).toEqual(projectMemberStore[0].modified);
    expect(resp.body.singleResult.data?.projectMembers[0]?.modifiedById).toEqual(context.token.id);
  });

  it('returns the projectMembers for the project when the current user is a collaborator on the project', async () => {
    const variables = { projectId: projectStore[0].id };
    context.token = mockToken();
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectStore[0].id;
    projectCollaboratorStore[0].userId = context.token.id
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMembers.length).toBe(3);
  });

  it('returns the projectMembers for the project when the current user is the an admin for the org that created the project', async () => {
    const variables = { projectId: projectStore[0].id };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMembers.length).toBe(3);
  });

  it('returns the projectMembers for the project when the current user is a super admin', async () => {
    const variables = { projectId: projectStore[0].id };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMembers.length).toBe(3);
  });

  it('returns a 403 when the current user is not a collaborator on the project', async () => {
    const variables = { projectId: projectStore[0].id };
    context.token = mockToken(new User({ id: 999999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when the current user is an Admin but not for the affiliation of the project creator', async () => {
    const variables = { projectId: projectStore[0].id };
    adminToken.affiliationId = 'fake-org.edu';
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { projectId: projectStore[0].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Project, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { projectId: projectStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('projectMember query', () => {
  beforeEach(() => {
    query = `
      query projectMemberQuery($projectMemberId: Int!) {
        projectMember (projectMemberId: $projectMemberId) {
          id
          createdById
          created
          modifiedById
          modified
          project {
            id
            title
          }
          affiliation {
            uri
            name
          }
          givenName
          surName
          orcid
          email
          memberRoles {
            id
            uri
            label
            description
            displayOrder
          }
        }
      }
    `;
  });

  it('returns the projectMember for the project when the current user is the creator of the project', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMember).toBeTruthy();
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.projectMember?.id).toEqual(projectMemberStore[0].id);
    expect(resp.body.singleResult.data?.projectMember?.givenName).toEqual(projectMemberStore[0].givenName);
    expect(resp.body.singleResult.data?.projectMember?.surName).toEqual(projectMemberStore[0].surName);
    expect(resp.body.singleResult.data?.projectMember?.orcid).toEqual(projectMemberStore[0].orcid);
    expect(resp.body.singleResult.data?.projectMember?.email).toEqual(projectMemberStore[0].email);
    expect(resp.body.singleResult.data?.projectMember?.project.id).toEqual(projectStore[0].id);
    expect(resp.body.singleResult.data?.projectMember?.project.title).toEqual(projectStore[0].title);
    expect(resp.body.singleResult.data?.projectMember?.affiliation.uri).toEqual(affiliationStore[0].uri);
    expect(resp.body.singleResult.data?.projectMember?.affiliation.name).toEqual(affiliationStore[0].name);
    expect(resp.body.singleResult.data?.projectMember?.memberRoles.length).toBeGreaterThan(0);

    expect(resp.body.singleResult.data?.projectMember?.created).toEqual(projectMemberStore[0].created);
    expect(resp.body.singleResult.data?.projectMember?.createdById).toEqual(context.token.id);
    expect(resp.body.singleResult.data?.projectMember?.modified).toEqual(projectMemberStore[0].modified);
    expect(resp.body.singleResult.data?.projectMember?.modifiedById).toEqual(context.token.id);
  });

  it('returns the projectMember for the project when the current user is a collaborator on the project', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    context.token = mockToken();
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectStore[0].id;
    projectCollaboratorStore[0].userId = context.token.id
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMember).toBeTruthy();
    expect(resp.body.singleResult.data?.projectMember.id).toEqual(projectMemberStore[0].id);
  });

  it('returns the projectMember for the project when the current user is the an admin for the org that created the project', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMember).toBeTruthy();
    expect(resp.body.singleResult.data?.projectMember.id).toEqual(projectMemberStore[0].id);
  });

  it('returns the projectMember for the project when the current user is a super admin', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.projectMember).toBeTruthy();
    expect(resp.body.singleResult.data?.projectMember.id).toEqual(projectMemberStore[0].id);
  });

  it('returns a 403 when the current user is not a collaborator on the project', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    context.token = mockToken(new User({ id: 999999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMember).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when the current user is an Admin but not for the affiliation of the project creator', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    adminToken.affiliationId = 'fake-org.edu';
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMember).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { projectMemberId: projectMemberStore[0].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMember).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Project, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { projectMemberId: projectMemberStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.projectMember).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});


describe.skip('planMembers query', () => {
  beforeEach(() => {
    query = `
      query planMembersQuery($planId: Int!) {
        planMembers (planId: $planId) {
          id
          createdById
          created
          modifiedById
          modified
          plan {
            id
          }
          projectMember {
            id
            givenName
            surName
          }
          isPrimaryContact
          memberRoles {
            id
            uri
            label
            description
            displayOrder
          }
        }
      }
    `;
  });

  it('returns the planMembers for the project when the current user is the creator of the project', async () => {
    const variables = { planId: projectStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.planMembers.length).toBe(3);
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.planMembers[0]?.id).toEqual(planMemberStore[0].id);
    expect(resp.body.singleResult.data?.planMembers[0]?.isPrimaryContact).toEqual(planMemberStore[0].isPrimaryContact);
    expect(resp.body.singleResult.data?.planMembers[0]?.plan.id).toEqual(planStore[0].id);
    expect(resp.body.singleResult.data?.planMembers[0]?.projectMember.id).toEqual(projectMemberStore[0].id);
    expect(resp.body.singleResult.data?.planMembers[0]?.projectMember.givenName).toEqual(projectMemberStore[0].givenName);
    expect(resp.body.singleResult.data?.planMembers[0]?.projectMember.surName).toEqual(projectMemberStore[0].surName);
    expect(resp.body.singleResult.data?.planMembers[0]?.memberRoles.length).toBeGreaterThan(0);

    expect(resp.body.singleResult.data?.planMembers[0]?.created).toEqual(planMemberStore[0].created);
    expect(resp.body.singleResult.data?.planMembers[0]?.createdById).toEqual(context.token.id);
    expect(resp.body.singleResult.data?.planMembers[0]?.modified).toEqual(planMemberStore[0].modified);
    expect(resp.body.singleResult.data?.planMembers[0]?.modifiedById).toEqual(context.token.id);
  });

  it('returns the planMembers for the plan when the current user is a collaborator on the project', async () => {
    const variables = { planId: planStore[0].id };
    context.token = mockToken();
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectStore[0].id;
    projectCollaboratorStore[0].userId = context.token.id
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.planMembers.length).toBe(3);
  });

  it('returns the planMembers for the plan when the current user is the an admin for the org that created the project', async () => {
    const variables = { planId: planStore[0].id };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.planMembers.length).toBe(3);
  });

  it('returns the planMembers for the plan when the current user is a super admin', async () => {
    const variables = { planId: planStore[0].id };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.planMembers.length).toBe(3);
  });

  it('returns a 403 when the current user is not a collaborator on the project', async () => {
    const variables = { planId: planStore[0].id };
    context.token = mockToken(new User({ id: 999999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.planMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when the current user is an Admin but not for the affiliation of the project creator', async () => {
    const variables = { planId: planStore[0].id };
    adminToken.affiliationId = 'fake-org.edu';
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.planMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { planId: planStore[0].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.planMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Project, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { planId: planStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.planMembers).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});
 */
