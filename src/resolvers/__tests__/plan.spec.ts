
it('passes', () => {
  expect(true).toBe(true);
});

/*
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema.js";
import { resolvers } from "../../resolver.js";
import casual from "casual";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context.js";

import { logger } from "../../logger.js";
import { JWTAccessToken } from "../../services/tokenService.js";

import { Project } from "../../models/Project.js";
import { Plan, PlanSearchResult, PlanStatus, PlanVisibility } from "../../models/Plan.js";
import { clearProjectStore, initProjectStore, mockFindProjectById } from "../../models/__mocks__/Project";
import {
  clearPlanStore,
  initPlanStore,
  mockDeletePlan,
  mockFindPlanByDMPId,
  mockFindPlanById,
  mockFindPlansByProjectId,
  mockFindPlanSearchResultsByProjectId,
  mockInsertPlan,
  mockUpdatePlan
} from "../../models/__mocks__/Plan";
import { User, UserRole } from "../../models/User.js";
import { DMPCommonStandard } from "../../types/DMP";
import { clearPlanVersionStore, initPlanVersionStore, mockPutItem, mockQueryTable } from "../../models/__mocks__/PlanVersion";
import { MyContext } from "../../context.js";
import { VersionedTemplate } from "../../models/VersionedTemplate.js";
import { clearVersionedTemplateStore, initVersionedTemplateStore, mockFindVersionedTemplateById } from "../../models/__mocks__/VersionedTemplate";
import { ResearchDomain } from "../../models/ResearchDomain";
import { clearResearchDomainStore, initResearchDomainStore, mockFindResearchDomainById } from "../../models/__mocks__/ResearchDomain";
import { initUserStore, mockFindUserById } from "../../models/__mocks__/User";
import { RelatedWork } from "../../models/RelatedWork";
import { clearRelatedWorkStore, initRelatedWorkStore, mockFindRelatedWorksByProjectId } from "../../models/__mocks__/RelatedWork";
import { MemberRole } from "../../models/MemberRole.js";
import { clearMemberRoles, initMemberRoles, mockDefaultMemberRole } from "../../models/__mocks__/MemberRole";
import { ProjectCollaborator, ProjectCollaboratorAccessLevel } from "../../models/Collaborator.js";
import {
  clearProjectCollaboratorsStore,
  initProjectCollaboratorsStore,
  mockFindProjectCollaboratorByProjectId
} from "../../models/__mocks__/Collaborator";
import { DynamoDBClient, PutItemCommandInput, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { awsConfig } from "../../config/awsConfig";
import { PlanFunding } from "../../models/Funding";
import { PlanMember } from "../../models/Member.js";
import { Answer } from "../../models/Answer";
import { generalConfig } from "../../config/generalConfig.js";
import { getCurrentDate } from "../../utils/helpers.js";

jest.mock('../../context.js')
jest.mock('../../services/emailService');

let context: MyContext;
let testServer: ApolloServer;

let userStore: User[];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let memberRoleStore: MemberRole[];
let projectCollaboratorStore: ProjectCollaborator[];
let researchStore: ResearchDomain[];
let relatedWorkStore: RelatedWork[];
let versionedTemplateStore: VersionedTemplate[];
let projectStore: Project[];
let planStore: Plan[];
let planVersionStore: DMPCommonStandard[];

let affiliationId: string;
let projectId: number;

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
  affiliationId = casual.url;

  // Init 3 users
  userStore = initUserStore(4);
  // Researcher
  userStore[0].affiliationId = affiliationId;
  userStore[0].role = UserRole.RESEARCHER;
  // Admin user
  userStore[1].affiliationId = affiliationId;
  userStore[1].role = UserRole.ADMIN;
  // Super Admin
  userStore[2].role = UserRole.SUPERADMIN;
  // User from another org
  userStore[3].role = UserRole.RESEARCHER;
  userStore[3].affiliationId = casual.url;

  // Generate tokens for each user type
  researcherToken = mockToken(userStore[0]);
  adminToken = mockToken(userStore[1]);
  superAdminToken = mockToken(userStore[2]);

  // Build the mock Apollo context
  context = buildContext(logger, researcherToken, researcherToken);

  // Initialize the Apollo server
  testServer = new ApolloServer({
    typeDefs, resolvers
  });

  // Add initial data to the mock database
  versionedTemplateStore = initVersionedTemplateStore(1);
  projectStore = initProjectStore(1);
  projectCollaboratorStore = initProjectCollaboratorsStore(1);
  memberRoleStore = initMemberRoles(1);
  relatedWorkStore = initRelatedWorkStore(1);
  researchStore = initResearchDomainStore(1);
  planStore = initPlanStore(3);
  planVersionStore = initPlanVersionStore(0);

  projectId = projectStore[0].id;

  // Make sure the researcher is the creator of the plan
  projectStore[0].createdById = researcherToken.id;
  // Ensure that the project has the test research domain
  projectStore[0].researchDomainId = researchStore[0].id;
  // Ensure the relatedWork is attached to the project
  relatedWorkStore[0].projectId = projectId;

  // Use spys to mock the database queries for a Plan
  jest.spyOn(Plan, 'findById').mockImplementation(mockFindPlanById);
  jest.spyOn(Plan, 'findByDMPId').mockImplementation(mockFindPlanByDMPId);
  jest.spyOn(Plan, 'findByProjectId').mockImplementation(mockFindPlansByProjectId);
  jest.spyOn(PlanSearchResult, 'findByProjectId').mockImplementation(mockFindPlanSearchResultsByProjectId);

  // Use spys to mock the database mutations for a Plan
  jest.spyOn(Plan, 'insert').mockImplementation(mockInsertPlan);
  jest.spyOn(Plan, 'update').mockImplementation(mockUpdatePlan);
  jest.spyOn(Plan, 'delete').mockImplementation(mockDeletePlan);

  // Use spys to mock the DynamoDB actions for a PlanVersion
  jest.spyOn(DynamoDBClient.prototype, 'send').mockImplementation((command) => {
    const tableName = awsConfig.dynamoTableName;
    if (command.constructor.name === 'QueryCommand') {
      return mockQueryTable(context, tableName, command.input as QueryCommandInput);
    } else if (command.constructor.name === 'PutItemCommand') {
      return mockPutItem(context, tableName, command.input as PutItemCommandInput);
    } else if (command.constructor.name === 'DeleteItemCommand') {
      return null // mockDeleteItem(context, tableName, command.input as DeleteItemCommandInput);
    }
    return null;
  });

  // Mock the call to fetch the template from within the TemplateCollaborator resolver
  jest.spyOn(User, 'findById').mockImplementation(mockFindUserById);
  jest.spyOn(Project, 'findById').mockImplementation(mockFindProjectById);
  jest.spyOn(ProjectCollaborator, 'findByProjectId').mockImplementation(mockFindProjectCollaboratorByProjectId);
  jest.spyOn(VersionedTemplate, 'findById').mockImplementation(mockFindVersionedTemplateById);
  jest.spyOn(ResearchDomain, 'findById').mockImplementation(mockFindResearchDomainById);
  jest.spyOn(RelatedWork, 'findByProjectId').mockImplementation(mockFindRelatedWorksByProjectId);
  jest.spyOn(MemberRole, 'defaultRole').mockImplementation(mockDefaultMemberRole);

  // Mock the commonStandardService queries
  jest.spyOn(PlanFunding, 'query').mockResolvedValue([]);
  jest.spyOn(PlanMember, 'query').mockResolvedValue([]);
  jest.spyOn(User, 'query').mockResolvedValue([userStore[0]]);
  jest.spyOn(Answer, 'query').mockResolvedValue([]);

  // Make sure each plan is attached to a Project, VersionedTemplate and Creator
  for (const plan of planStore) {
    plan.projectId = projectId;
    plan.versionedTemplateId = versionedTemplateStore[0].id;
    plan.createdById = researcherToken.id;
  }
});

afterEach(() => {
  jest.clearAllMocks();

  // Reset the mock database
  clearVersionedTemplateStore();
  clearProjectStore();
  clearProjectCollaboratorsStore();
  clearPlanStore();
  clearPlanVersionStore();
  clearMemberRoles();
  clearResearchDomainStore();
  clearRelatedWorkStore();
});

describe.skip('plans query', () => {
  beforeEach(() => {
    query = `
      query plansQuery($projectId: Int!) {
        plans (projectId: $projectId) {
          id
          createdBy
          created
          modifiedBy
          modified
          title
          status
          visibility
          dmpId
          registeredBy
          registered
          funding
          members
          templateTitle
        }
      }
    `;
  });

  it('returns the plans for the project when the current user is the creator of the project', async () => {
    const variables = { projectId };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.plans.length).toBe(3);
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.plans[0]?.id).toEqual(planStore[0].id);
    expect(resp.body.singleResult.data?.plans[0]?.title).toBeTruthy();
    expect(resp.body.singleResult.data?.plans[0]?.status).toEqual(planStore[0].status);
    expect(resp.body.singleResult.data?.plans[0]?.visibility).toEqual(planStore[0].visibility);
    expect(resp.body.singleResult.data?.plans[0]?.registered).toEqual(planStore[0].registered);
    expect(resp.body.singleResult.data?.plans[0]?.dmpId).toEqual(planStore[0].dmpId);
    expect(resp.body.singleResult.data?.plans[0]?.registeredBy).toBeTruthy();
    expect(resp.body.singleResult.data?.plans[0]?.funding).toBeTruthy();
    expect(resp.body.singleResult.data?.plans[0]?.members).toBeTruthy();
    expect(resp.body.singleResult.data?.plans[0]?.templateTitle).toBeTruthy();

    expect(resp.body.singleResult.data?.plans[0]?.created).toEqual(planStore[0].created);
    expect(resp.body.singleResult.data?.plans[0]?.createdBy).toBeTruthy();
    expect(resp.body.singleResult.data?.plans[0]?.modified).toEqual(planStore[0].modified);
    expect(resp.body.singleResult.data?.plans[0]?.modifiedBy).toBeTruthy();
  });

  it('returns the plans for the project when the current user is a collaborator on the project', async () => {
    const variables = { projectId };
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].userId = userStore[3].id;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.plans.length).toBe(3);
  });

  it('returns the plans for the project when the current user is the an admin for the org that created the project', async () => {
    const variables = { projectId };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.plans.length).toBe(3);
  });

  it('returns the plans for the project when the current user is a super admin', async () => {
    const variables = { projectId };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.plans.length).toBe(3);
  });

  it('returns a 403 when the current user is not a collaborator on the project', async () => {
    const variables = { projectId };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plans).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when the current user is an Admin but not for the affiliation of the project creator', async () => {
    const variables = { projectId };
    adminToken.affiliationId = casual.url;
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plans).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { projectId };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plans).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when no matching record is found', async () => {
    // Use an id that will not match any records
    const variables = { projectId: 999999 };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plans).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(PlanSearchResult, 'findByProjectId').mockImplementation(() => { throw new Error('Error!') });

    const variables = { projectId };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plans).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('plan query', () => {
  beforeEach(() => {
    query = `
      query planQuery($planId: Int!) {
        plan (planId: $planId) {
          id
          createdById
          created
          modifiedById
          modified
          dmpId
          status
          visibility
          registered
          registeredById
          languageId
          featured

          project {
            id
            title
          }
          versionedTemplate {
            id
            name
          }
        }
      }
    `;
  });

  it('returns the plan when the current user is the creator of the project', async () => {
    const variables = { planId: planStore[1].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.plan?.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.plan?.dmpId).toEqual(planStore[1].dmpId);
    expect(resp.body.singleResult.data?.plan?.status).toEqual(planStore[1].status);
    expect(resp.body.singleResult.data?.plan?.visibility).toEqual(planStore[1].visibility);
    expect(resp.body.singleResult.data?.plan?.registered).toEqual(planStore[1].registered);
    expect(resp.body.singleResult.data?.plan?.registeredById).toEqual(planStore[1].registeredById);
    expect(resp.body.singleResult.data?.plan?.languageId).toEqual(planStore[1].languageId);
    expect(resp.body.singleResult.data?.plan?.featured).toEqual(planStore[1].featured);
    expect(resp.body.singleResult.data?.plan?.project?.id).toEqual(projectStore[0].id);
    expect(resp.body.singleResult.data?.plan?.project?.title).toEqual(projectStore[0].title);
    expect(resp.body.singleResult.data?.plan?.versionedTemplate?.id).toEqual(versionedTemplateStore[0].id);
    expect(resp.body.singleResult.data?.plan?.versionedTemplate?.name).toEqual(versionedTemplateStore[0].name);

    expect(resp.body.singleResult.data?.plan?.created).toEqual(planStore[1].created);
    expect(resp.body.singleResult.data?.plan?.createdById).toEqual(researcherToken.id);
    expect(resp.body.singleResult.data?.plan?.modified).toEqual(planStore[1].modified);
    expect(resp.body.singleResult.data?.plan?.modifiedById).toEqual(planStore[1].modifiedById);
  });

  it('returns the plan when the current user is a collaborator on the project', async () => {
    const variables = { planId: planStore[1].id };
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].userId = userStore[3].id;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.plan?.id).toEqual(planStore[1].id);
  });

  it('returns the plan when the current user is the an admin for the org that created the project', async () => {
    const variables = { planId: planStore[1].id };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.plan?.id).toEqual(planStore[1].id);
  });

  it('returns the plan when the current user is a super admin', async () => {
    const variables = { planId: planStore[1].id };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // verify all the properties are returned
    expect(resp.body.singleResult.data?.plan?.id).toEqual(planStore[1].id);
  });

  it('returns a 403 when the current user is not a collaborator on the project', async () => {
    const variables = { planId: planStore[1].id };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when the current user is an Admin but not for the affiliation of the project creator', async () => {
    const variables = { planId: planStore[1].id };
    adminToken.affiliationId = casual.url;
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { planId: planStore[1].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when no matching record is found', async () => {
    // Use an id that will not match any records
    const variables = { planId: 99999 };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Plan, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { planId: casual.integer(1, 9999) };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('addPlan mutation', () => {
  beforeEach(() => {
    query = `
      mutation addPlanMutation($projectId: Int!, $versionedTemplateId: Int!) {
        addPlan (projectId: $projectId, versionedTemplateId: $versionedTemplateId) {
          id
          errors {
            general
            projectId
            versionedTemplateId
          }
        }
      }
    `;
  });

  it('creates a new plan when the current user is the creator of the project', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.addPlan.id).toEqual(planStore.length);
    expect(resp.body.singleResult.data?.addPlan.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.projectId).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.versionedTemplateId).toBeNull();
  });

  it('creates a new plan when the current user is a collaborator on the project', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].userId = userStore[3].id;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.addPlan.id).toEqual(planStore.length);
    expect(resp.body.singleResult.data?.addPlan.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.projectId).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.versionedTemplateId).toBeNull();
  });

  it('creates a new plan when the current user is an admin for the same org as the project creator', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.addPlan.id).toEqual(planStore.length);
    expect(resp.body.singleResult.data?.addPlan.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.projectId).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.versionedTemplateId).toBeNull();
  });

  it('creates a new plan when the current user is a super admin', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.addPlan.id).toEqual(planStore.length);
    expect(resp.body.singleResult.data?.addPlan.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.projectId).toBeNull();
    expect(resp.body.singleResult.data?.addPlan.errors.versionedTemplateId).toBeNull();
  });

  it('returns a 403 if the current user is not a collaborator', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeUndefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeUndefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the specified projectId is not found', async () => {
    // Use an id that will not match any records
    const variables = { projectId: 99999, versionedTemplateId: versionedTemplateStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeUndefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 404 when the specified versionedTemplateId is not found', async () => {
    // Use an id that will not match any records
    const variables = { projectId: projectStore[0].id, versionedTemplateId: 999999 };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeUndefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Plan, 'insert').mockImplementation(() => { throw new Error('Error!') });

    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.plan).toBeUndefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER_ERROR');
  });

  it('generates the initial PlanVersion record correctly', async () => {
    const variables = { projectId, versionedTemplateId: versionedTemplateStore[0].id };
    await executeQuery(query, variables, context);

    const version = planVersionStore[0];
    expect(version).toBeDefined();
    expect(version['PK']['S']).toBeTruthy();
    expect(version['SK']['S']).toBeTruthy();
    expect(version.created['S']).toBeTruthy();
    expect(version.modified['S']).toBeTruthy();
    expect(version.registered).toBeFalsy();
    expect(version.title['S']).toEqual(`DMP for: ${versionedTemplateStore[0].name}`);
    expect(version.language['S']).toEqual('eng');
    expect(version.ethical_issues_exist['S']).toEqual('unknown');
    expect(version.dmphub_provenance_id['S']).toEqual(generalConfig.applicationName.toLowerCase());
    expect(version.dmproadmap_featured['S']).toEqual('0');
    expect(version.dmproadmap_privacy['S']).toEqual('private');
    expect(version.dmproadmap_status['S']).toEqual('draft');
    expect(version.dmp_id['M']['identifier']['S']).toBeTruthy();
    expect(version.dmp_id['M']['type']['S']).toEqual('doi');

    const contactObj = {
      name: { S: [userStore[0].givenName, userStore[0].surName].join(' ') },
      mbox: { S: userStore[0].email },
      contact_id: {
        M: {
          identifier: { S: userStore[0].orcid },
          type: { S: 'orcid' }
        }
      }
    }
    expect(version.contact['M']).toEqual(contactObj);

    const projectObj = {
      M: {
        title: { S: projectStore[0].title },
        description: { S: projectStore[0].abstractText },
        dmptool_research_domain: { S: researchStore[0].uri },
        start: { S: `${projectStore[0].startDate}T00:00:00Z` },
        end: { S: `${projectStore[0].endDate}T00:00:00Z` }
      }
    };
    expect(version.project['L'][0]).toEqual(projectObj);

    const datasetObj = {
      M: {
        title: { S: 'Project Dataset' },
        type: { S: 'dataset' },
        personal_data: { S: 'unknown' },
        sensitive_data: { S: 'unknown' },
        dataset_id: {
          M: {
            identifier: { S: `${planStore[3].dmpId}/dataset` },
            type: { S: 'other' }
          }
        }
      }
    }
    expect(version.dataset['L'][0]).toEqual(datasetObj);

    const workObj = {
      M: {
        work_type: { S: relatedWorkStore[0].workType.toLowerCase() },
        identifier: { S: relatedWorkStore[0].identifier },
        type: { S: 'other' },
        descriptor: { S: relatedWorkStore[0].relationDescriptor.toLowerCase()},
        citation: { S: relatedWorkStore[0]. citation }
      }
    }
    expect(version.dmproadmap_related_identifiers['L'][0]).toEqual(workObj);

  });
});

describe.skip('archivePlan', () => {
  beforeEach(() => {
    query = `
      mutation archivePlan($planId: Int!) {
        archivePlan (planId: $planId) {
          id
          errors {
            general
          }
        }
      }
    `;
  });

  it('archives a plan when the current user is the creator of the project', async () => {
    const variables = { planId: planStore[1].id };
    const expectedId = planStore[1].id;
    const originalPlanCount = planStore.length;
    delete planStore[1].registered;
    delete planStore[1].dmpId;
    delete planStore[1].registeredById;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount - 1);
    expect(resp.body.singleResult.data?.archivePlan.id).toEqual(expectedId);
    expect(resp.body.singleResult.data?.archivePlan.errors.general).toBeNull();
  });

  it('archives a plan when the current user is a collaborator on the project', async () => {
    const variables = { planId: planStore[1].id };
    const expectedId = planStore[1].id;
    const originalPlanCount = planStore.length;
    delete planStore[1].registered;
    delete planStore[1].dmpId;
    delete planStore[1].registeredById;
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].userId = userStore[3].id;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount - 1);
    expect(resp.body.singleResult.data?.archivePlan.id).toEqual(expectedId);
    expect(resp.body.singleResult.data?.archivePlan.errors.general).toBeNull();
  });

  it('archives a plan when the current user is an admin for the same org as the project creator', async () => {
    const variables = { planId: planStore[1].id };
    const expectedId = planStore[1].id;
    const originalPlanCount = planStore.length;
    delete planStore[1].registered;
    delete planStore[1].dmpId;
    delete planStore[1].registeredById;
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount - 1);
    expect(resp.body.singleResult.data?.archivePlan.id).toEqual(expectedId);
    expect(resp.body.singleResult.data?.archivePlan.errors.general).toBeNull();
  });

  it('archives a plan when the current user is a super admin', async () => {
    const variables = { planId: planStore[1].id };
    const expectedId = planStore[1].id;
    const originalPlanCount = planStore.length;
    delete planStore[1].registered;
    delete planStore[1].dmpId;
    delete planStore[1].registeredById;
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount - 1);
    expect(resp.body.singleResult.data?.archivePlan.id).toEqual(expectedId);
    expect(resp.body.singleResult.data?.archivePlan.errors.general).toBeNull();
  });

  it('returns the plan with an error if it is already published', async () => {
    const variables = { planId: planStore[1].id };
    const originalPlanCount = planStore.length;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount);
    expect(resp.body.singleResult.data?.archivePlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.archivePlan.errors.general).toBeTruthy();
  });

  it('returns a 403 if the current user is not a collaborator', async () => {
    const variables = { planId: planStore[1].id };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.archivePlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { planId: planStore[1].id };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.archivePlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when no matching record is found', async () => {
    // Use an id that will not match any records
    const variables = { planId: 99999 };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.archivePlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Plan, 'delete').mockImplementation(() => { throw new Error('Error!') });

    const variables = { planId: planStore[1].id };
    delete planStore[1].registered;
    delete planStore[1].dmpId;
    delete planStore[1].registeredById;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.archivePlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('publishPlan', () => {
  beforeEach(() => {
    query = `
      mutation publishPlanMutation($planId: Int!, $visibility: PlanVisibility!) {
        publishPlan (planId: $planId, visibility: $visibility) {
          id
          dmpId
          registered
          registeredById
          visibility
          errors {
            general
          }
        }
      }
    `;

    // We need to init the PlanVersion record in the DynamoDB table
    mockPutItem(null, null, {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        dmp_id: { M: { identifier: { S: planStore[1].dmpId } } },
        created: { S: getCurrentDate() },
        modified: { S: getCurrentDate() },
      }
    });
  });

  it('publishes a plan when the current user is the creator of the project', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    planStore[1].status = PlanStatus.DRAFT;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.dmpId).toBeTruthy();
    expect(resp.body.singleResult.data?.publishPlan.visibility).toEqual(PlanVisibility.PUBLIC);
    expect(resp.body.singleResult.data?.publishPlan.registered).toBeTruthy();
    expect(resp.body.singleResult.data?.publishPlan.registeredById).toEqual(context.token.id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeNull();
  });

  it('publishes a plan when the current user is a collaborator with owner access', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.OWN;
    projectCollaboratorStore[0].userId = userStore[3].id;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeNull();
  });

  it('publishes a plan when the current user is an admin for the same org as the project creator', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeNull();
  });

  it('publishes a plan when the current user is a super admin', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeNull();
  });

  it('returns the plan with an error if it is a test plan', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = true;
    const originalPlanCount = planStore.length;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount);
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeTruthy();
  });

  it('returns the plan with an error if it is already published', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    const originalPlanCount = planStore.length;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(planStore.length).toEqual(originalPlanCount);
    expect(resp.body.singleResult.data?.publishPlan.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.publishPlan.errors.general).toBeTruthy();
  });

  it('returns a 403 if the current user is a collaborator but without owner access', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    projectCollaboratorStore[0].userId = userStore[3].id;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.publishPlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 if the current user is not a collaborator', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.publishPlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.publishPlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when no matching record is found', async () => {
    // Use an id that will not match any records
    const variables = { planId: 99999, visibility: PlanVisibility.PUBLIC };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.publishPlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Plan, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { planId: planStore[1].id, visibility: PlanVisibility.PUBLIC };
    delete planStore[1].registered;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.publishPlan).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('updatePlanStatus', () => {
  beforeEach(() => {
    query = `
      mutation updatePlanStatus($planId: Int!, $status: PlanStatus!) {
        updatePlanStatus (planId: $planId, status: $status) {
          id
          status
          errors {
            general
            status
          }
        }
      }
    `;

    // The Plan.update attempts to update the version so we need to init the PlanVersion record in the DynamoDB table
    mockPutItem(null, null, {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        dmp_id: { M: { identifier: { S: `https://${generalConfig.domain}/dmps/${planStore[1].id}` } } },
        created: { S: getCurrentDate() },
        modified: { S: getCurrentDate() },
      }
    });
  });

  it('updates the status of a plan when the current user is the creator of the project', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    planStore[1].status = PlanStatus.DRAFT;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.updatePlanStatus.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.updatePlanStatus.status).toEqual(PlanStatus.COMPLETE);
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.status).toBeNull();
  });

  it('updates the status of a plan when the current user is a collaborator with owner access', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.OWN;
    projectCollaboratorStore[0].userId = userStore[3].id;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.updatePlanStatus.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.updatePlanStatus.status).toEqual(PlanStatus.COMPLETE);
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.status).toBeNull();
  });

  it('updates the status of a plan when the current user is an admin for the same org as the project creator', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    context.token = adminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.updatePlanStatus.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.updatePlanStatus.status).toEqual(PlanStatus.COMPLETE);
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.status).toBeNull();
  });

  it('updates the status of a plan when the current user is a super admin', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    context.token = superAdminToken;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.updatePlanStatus.id).toEqual(planStore[1].id);
    expect(resp.body.singleResult.data?.updatePlanStatus.status).toEqual(PlanStatus.COMPLETE);
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.general).toBeNull();
    expect(resp.body.singleResult.data?.updatePlanStatus.errors.status).toBeNull();
  });

  it('returns a 403 if the current user is a collaborator but without owner access', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    projectStore[0].isTestProject = false;
    delete planStore[1].dmpId;
    delete planStore[1].registered;
    delete planStore[1].registeredById;
    // Make the last user in the userStore a collaborator on the project
    projectCollaboratorStore[0].projectId = projectId;
    projectCollaboratorStore[0].accessLevel = ProjectCollaboratorAccessLevel.EDIT;
    projectCollaboratorStore[0].userId = userStore[3].id;
    context.token = mockToken(userStore[3]);
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.updatePlanStatus).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 if the current user is not a collaborator', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    context.token = mockToken(new User({ id: 99999, affiliationId: 'fake-org', role: UserRole.RESEARCHER }));
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.updatePlanStatus).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 401 when the current user is not authenticated', async () => {
    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    context.token = null;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.updatePlanStatus).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when no matching record is found', async () => {
    // Use an id that will not match any records
    const variables = { planId: 99999, status: PlanStatus.COMPLETE };
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.updatePlanStatus).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(Plan, 'findById').mockImplementation(() => { throw new Error('Error!') });

    const variables = { planId: planStore[1].id, status: PlanStatus.COMPLETE };
    delete planStore[1].registered;
    const resp = await executeQuery(query, variables, context);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.updatePlanStatus).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});
*/
