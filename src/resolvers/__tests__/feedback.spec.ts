/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApolloServer } from "@apollo/server";
import casual from "casual";
import assert from "assert";
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// Only emailService gets a full module mock — we want controllable jest.fn()s
// to assert call counts without sending real email. Everything else (model
// classes, authService, projectService, commentPermissions) is REAL, and test
// scenarios are driven by fixture data (project.createdById, token.role,
// primaryCollaborator.userId, etc.) exactly like the proven pre-ESM suite did.
// Real classes are spied per-test via jest.spyOn rather than replacing whole
// modules, which avoids the module-registry ordering pitfalls of
// jest.unstable_mockModule for anything more than a handful of leaf modules.
// ---------------------------------------------------------------------------
const mockSendProjectCollaboratorsCommentsAddedEmail = jest.fn<(...args: any[]) => Promise<any>>();
const mockSendFeedbackRequestEmail = jest.fn<(...args: any[]) => Promise<any>>();
const mockSendFeedbackCompleteEmail = jest.fn<(...args: any[]) => Promise<any>>();

const actualEmailService = await import('../../services/emailService.js');
jest.unstable_mockModule('../../services/emailService.js', () => ({
  ...actualEmailService,
  sendProjectCollaboratorsCommentsAddedEmail: mockSendProjectCollaboratorsCommentsAddedEmail,
  sendFeedbackRequestEmail: mockSendFeedbackRequestEmail,
  sendFeedbackCompleteEmail: mockSendFeedbackCompleteEmail,
}));

const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { User, UserRole } = await import("../../models/User.js");
const { Plan } = await import("../../models/Plan.js");
const { Project } = await import("../../models/Project.js");
const { PlanFeedback } = await import("../../models/PlanFeedback.js");
const { PlanFeedbackComment } = await import("../../models/PlanFeedbackComment.js");
const { VersionedTemplate } = await import("../../models/VersionedTemplate.js");
const { Affiliation } = await import("../../models/Affiliation.js");
const { ProjectCollaborator } = await import("../../models/Collaborator.js");
const { getCurrentDate } = await import("../../utils/helpers.js");

let testServer: ApolloServer;
let affiliationId: string;
let planId: number;
let planFeedbackId: number;
let planFeedbackCommentId: number;
let answerId: number;
let plan: any;
let project: any;
let feedback: any;
let feedbackComment: any;
let researcherToken: any;
let adminToken: any;
let superAdminToken: any;

async function executeQuery(query: string, variables: any, token: any): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation({ query, variables }, { contextValue: context });
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  planId = casual.integer(1, 9999);
  planFeedbackId = casual.integer(1, 9999);
  answerId = casual.integer(1, 9999);

  researcherToken = await mockToken();
  researcherToken.role = UserRole.RESEARCHER;

  adminToken = await mockToken();
  adminToken.role = UserRole.ADMIN;
  adminToken.affiliationId = affiliationId;

  superAdminToken = await mockToken();
  superAdminToken.role = UserRole.SUPERADMIN;
  superAdminToken.affiliationId = affiliationId;

  plan = new Plan({
    id: planId,
    projectId: casual.integer(1, 9999),
    versionedTemplateId: casual.integer(1, 9999),
    title: casual.sentence,
    createdById: casual.integer(1, 9999),
  });

  project = new Project({
    id: plan.projectId,
    createdById: casual.integer(1, 9999),
    title: casual.sentence,
  });

  feedback = new PlanFeedback({
    id: planFeedbackId,
    planId,
    requested: getCurrentDate(),
    requestedById: casual.integer(1, 9999),
    completed: null,
  });

  feedbackComment = new PlanFeedbackComment({
    id: casual.integer(1, 9999),
    answerId,
    feedbackId: planFeedbackId,
    commentText: casual.sentence,
    createdById: casual.integer(1, 9999),
  });
  planFeedbackCommentId = feedbackComment.id;

  jest.spyOn(Plan, 'findById').mockResolvedValue(plan);
  jest.spyOn(Project, 'findById').mockResolvedValue(project);
  jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(feedback);
  jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(PlanFeedback, 'statusForPlan').mockResolvedValue({ status: 'NONE', id: null });
  jest.spyOn(PlanFeedbackComment, 'findById').mockResolvedValue(feedbackComment);
  jest.spyOn(PlanFeedbackComment, 'findByFeedbackId').mockResolvedValue([feedbackComment]);
  jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(
    new VersionedTemplate({ id: plan.versionedTemplateId, ownerId: affiliationId })
  );
  jest.spyOn(User, 'findById').mockResolvedValue(new User({ id: casual.integer(1, 9999) }));
  jest.spyOn(ProjectCollaborator, 'findByProjectId').mockResolvedValue([]);
  jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue(null);
  jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(
    new Affiliation({
      uri: affiliationId,
      feedbackEmails: [casual.email],
      feedbackEnabled: true,
    })
  );
  jest.spyOn(PlanFeedback.prototype, 'create').mockResolvedValue(feedback);
  jest.spyOn(PlanFeedback.prototype, 'update').mockResolvedValue(feedback);
  jest.spyOn(PlanFeedbackComment.prototype, 'create').mockResolvedValue(feedbackComment);
  jest.spyOn(PlanFeedbackComment.prototype, 'update').mockResolvedValue(feedbackComment);
  jest.spyOn(PlanFeedbackComment.prototype, 'delete').mockResolvedValue(feedbackComment);

  mockSendProjectCollaboratorsCommentsAddedEmail.mockResolvedValue(true);
  mockSendFeedbackRequestEmail.mockResolvedValue(true);
  mockSendFeedbackCompleteEmail.mockResolvedValue(true);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// planFeedback query
// ---------------------------------------------------------------------------
describe('planFeedback query', () => {
  let query: string;

  beforeEach(() => {
    query = `
      query PlanFeedback($planId: Int!) {
        planFeedback(planId: $planId) {
          id
          requested
          summaryText
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { planId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not an admin', async () => {
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId }, superAdminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the admin belongs to a different affiliation', async () => {
    const differentAffiliationAdmin = await mockToken();
    differentAffiliationAdmin.role = UserRole.ADMIN;
    differentAffiliationAdmin.affiliationId = casual.url; // different from versionedTemplate.ownerId

    const resp = await executeQuery(query, { planId }, differentAffiliationAdmin);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns the planFeedback list when successful', async () => {
    jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([feedback]);

    const resp = await executeQuery(query, { planId }, superAdminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.planFeedback).toHaveLength(1);
    expect(resp.body.singleResult.data.planFeedback[0].id).toEqual(feedback.id);
  });

  it('returns a 500 on a fatal error', async () => {
    jest.spyOn(Plan, 'findById').mockRejectedValue(new Error('DB error'));
    const resp = await executeQuery(query, { planId }, superAdminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// planFeedbackComments query
// ---------------------------------------------------------------------------
describe('planFeedbackComments query', () => {
  let query: string;

  beforeEach(() => {
    query = `
      query PlanFeedbackComments($planId: Int!, $planFeedbackId: Int!) {
        planFeedbackComments(planId: $planId, planFeedbackId: $planFeedbackId) {
          id
          commentText
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { planId, planFeedbackId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user has no permission on the project', async () => {
    // project.createdById does not match token.id and user is not collaborator/admin
    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns the feedback comments when successful', async () => {
    // Grant permission by setting project creator to the token user
    project.createdById = researcherToken.id;

    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.planFeedbackComments).toHaveLength(1);
    expect(resp.body.singleResult.data.planFeedbackComments[0].id)
      .toEqual(feedbackComment.id);
  });

  it('returns a 500 on a fatal error', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedbackComment, 'findByFeedbackId').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// planFeedbackStatus query
// ---------------------------------------------------------------------------
describe('planFeedbackStatus query', () => {
  let query: string;

  beforeEach(() => {
    query = `
      query PlanFeedbackStatus($planId: Int!) {
        planFeedbackStatus(planId: $planId) {
          status
          id
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { planId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 404 when the plan creator is not found', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user has no permission on the project', async () => {
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns the feedback status when successful', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedback, 'statusForPlan').mockResolvedValue({ status: 'REQUESTED', id: planFeedbackId });

    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.planFeedbackStatus.status).toEqual('REQUESTED');
    expect(resp.body.singleResult.data.planFeedbackStatus.id).toEqual(planFeedbackId);
  });
});

// ---------------------------------------------------------------------------
// requestFeedback mutation
// ---------------------------------------------------------------------------
describe('requestFeedback mutation', () => {
  let query: string;

  beforeEach(() => {
    query = `
      mutation RequestFeedback($planId: Int!, $messageToOrg: String) {
        requestFeedback(planId: $planId, messageToOrg: $messageToOrg) {
          id
          requested
        }
      }
    `;
    // By default no existing open feedback
    jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([]);
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { planId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user has no permission on the project', async () => {
    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 403 when there is already an open feedback round', async () => {
    project.createdById = researcherToken.id;
    // Return existing feedback with completed = null (open)
    jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([feedback]);

    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('creates the feedback and returns it when successful', async () => {
    project.createdById = researcherToken.id;
    researcherToken.affiliationId = affiliationId;

    const resp = await executeQuery(
      query,
      { planId, messageToOrg: casual.sentence },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.requestFeedback.id).toEqual(feedback.id);
    expect(PlanFeedback.prototype.create).toHaveBeenCalledTimes(1);
    expect(mockSendFeedbackRequestEmail).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 on a fatal error', async () => {
    project.createdById = researcherToken.id;
    researcherToken.affiliationId = affiliationId;
    jest.spyOn(PlanFeedback.prototype, 'create').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { planId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// completeFeedback mutation
// ---------------------------------------------------------------------------
describe('completeFeedback mutation', () => {
  let query: string;

  beforeEach(() => {
    query = `
      mutation CompleteFeedback($planId: Int!, $planFeedbackId: Int!, $summaryText: String, $sendEmail: Boolean) {
        completeFeedback(planId: $planId, planFeedbackId: $planFeedbackId, summaryText: $summaryText, sendEmail: $sendEmail) {
          id
          requested
          completed
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { planId, planFeedbackId, sendEmail: true }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(query, { planId, planFeedbackId, sendEmail: true }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user has no permission on the project', async () => {
    const resp = await executeQuery(query, { planId, planFeedbackId, sendEmail: true }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the feedback record is not found', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(query, { planId, planFeedbackId, sendEmail: true }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('marks the feedback as complete and returns it when successful', async () => {
    project.createdById = researcherToken.id;
    const completedFeedback = {
      ...feedback,
      completed: getCurrentDate(),
      completedById: researcherToken.id,
      summaryText: casual.sentence,
    };
    jest.spyOn(PlanFeedback.prototype, 'update').mockResolvedValue(completedFeedback);

    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, summaryText: casual.sentence, sendEmail: true },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.completeFeedback.id).toEqual(completedFeedback.id);
    expect(resp.body.singleResult.data.completeFeedback.completed).toBeDefined();
    expect(PlanFeedback.prototype.update).toHaveBeenCalledTimes(1);
    expect(mockSendFeedbackCompleteEmail).toHaveBeenCalledTimes(1);
  });

  it('does not call sendFeedbackCompleteEmail when sendEmail is false', async () => {
    project.createdById = researcherToken.id;

    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, summaryText: casual.sentence, sendEmail: false },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.completeFeedback.id).toEqual(feedback.id);
    expect(PlanFeedback.prototype.update).toHaveBeenCalledTimes(1);
    expect(mockSendFeedbackCompleteEmail).not.toHaveBeenCalled();
  });

  it('returns a 500 on a fatal error', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedback.prototype, 'update').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { planId, planFeedbackId, summaryText: casual.sentence, sendEmail: true }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// addFeedbackComment mutation
// ---------------------------------------------------------------------------
describe('addFeedbackComment mutation', () => {
  let query: string;

  beforeEach(() => {
    query = `
      mutation AddFeedbackComment(
        $planId: Int!, $planFeedbackId: Int!, $answerId: Int!, $commentText: String!
      ) {
        addFeedbackComment(
          planId: $planId, planFeedbackId: $planFeedbackId,
          answerId: $answerId, commentText: $commentText
        ) {
          id
          commentText
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, null
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is neither a collaborator nor an admin', async () => {
    // project.createdById does not match researcherToken.id, no collaborator records
    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, superAdminToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 404 when the feedback record is not found', async () => {
    // adminToken is not a collaborator, but shares an affiliation with the primary collaborator
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue({
      projectId: project.id,
      affiliationId,
    } as any);
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, adminToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the feedback round is already completed', async () => {
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue({
      projectId: project.id,
      affiliationId,
    } as any);
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue({ ...feedback, completed: getCurrentDate() });

    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, adminToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('adds the comment and returns it when successful', async () => {
    // feedback.completed is null by default (open); superadmin bypasses the collaborator check
    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, answerId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.addFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.create).toHaveBeenCalledTimes(1);
    expect(mockSendProjectCollaboratorsCommentsAddedEmail).toHaveBeenCalledTimes(1);
  });

  it('adds the comment when the user is a collaborator even if feedback is not open', async () => {
    // Collaborators can always comment regardless of feedback state
    project.createdById = researcherToken.id;

    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, answerId, commentText: casual.sentence },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.addFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.create).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 on a fatal error', async () => {
    jest.spyOn(PlanFeedbackComment.prototype, 'create').mockRejectedValue(new Error('DB error'));
    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, answerId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// updateFeedbackComment mutation
// ---------------------------------------------------------------------------
describe('updateFeedbackComment mutation', () => {
  let query: string;

  beforeEach(() => {
    query = `
      mutation UpdateFeedbackComment(
        $planId: Int!, $planFeedbackCommentId: Int!, $commentText: String!
      ) {
        updateFeedbackComment(
          planId: $planId, planFeedbackCommentId: $planFeedbackCommentId, commentText: $commentText
        ) {
          id
          commentText
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId, commentText: casual.sentence }, null
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not the comment creator', async () => {
    // feedbackComment.createdById (random) does not match researcherToken.id
    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: casual.sentence },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 404 when the comment is not found', async () => {
    jest.spyOn(PlanFeedbackComment, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('updates the comment and returns it when successful', async () => {
    feedbackComment.createdById = superAdminToken.id;
    const newText = casual.sentence;
    const updatedComment = { ...feedbackComment, commentText: newText };
    jest.spyOn(PlanFeedbackComment.prototype, 'update').mockResolvedValue(updatedComment);

    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: newText },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.updateFeedbackComment.id).toEqual(updatedComment.id);
    expect(PlanFeedbackComment.prototype.update).toHaveBeenCalledTimes(1);
  });

  it('allows a non-admin researcher to update their own comment', async () => {
    feedbackComment.createdById = researcherToken.id;
    const newText = casual.sentence;
    const updatedComment = { ...feedbackComment, commentText: newText };
    jest.spyOn(PlanFeedbackComment.prototype, 'update').mockResolvedValue(updatedComment);

    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: newText },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.updateFeedbackComment.id).toEqual(updatedComment.id);
    expect(PlanFeedbackComment.prototype.update).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 on a fatal error', async () => {
    feedbackComment.createdById = superAdminToken.id;
    jest.spyOn(PlanFeedbackComment.prototype, 'update').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// removeFeedbackComment mutation
// ---------------------------------------------------------------------------
describe('removeFeedbackComment mutation', () => {
  let query: string;

  beforeEach(() => {
    query = `
      mutation RemoveFeedbackComment($planId: Int!, $planFeedbackCommentId: Int!) {
        removeFeedbackComment(planId: $planId, planFeedbackCommentId: $planFeedbackCommentId) {
          id
          commentText
        }
      }
    `;
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, null
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user is neither the comment creator nor a PRIMARY collaborator', async () => {
    // feedbackComment.createdById is random, primaryCollaborator resolves null by default
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the comment is not found', async () => {
    jest.spyOn(PlanFeedbackComment, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('deletes the comment when the user is the PRIMARY collaborator', async () => {
    // feedbackComment.createdById does NOT match researcherToken.id,
    // but researcherToken IS the primary collaborator
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue({
      projectId: project.id,
      userId: researcherToken.id,
      affiliationId,
    } as any);

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.delete).toHaveBeenCalledTimes(1);
  });

  it('deletes the comment when the user is the comment creator', async () => {
    feedbackComment.createdById = researcherToken.id;

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.delete).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 on a fatal error', async () => {
    feedbackComment.createdById = researcherToken.id;
    jest.spyOn(PlanFeedbackComment.prototype, 'delete').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});