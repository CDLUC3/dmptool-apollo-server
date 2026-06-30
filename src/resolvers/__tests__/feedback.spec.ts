import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from "../../resolver";
import casual from "casual";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { User, UserRole } from "../../models/User";
import { Plan } from "../../models/Plan";
import { Project } from "../../models/Project";
import { PlanFeedback } from "../../models/PlanFeedback";
import { PlanFeedbackComment } from "../../models/PlanFeedbackComment";
import { VersionedTemplate } from "../../models/VersionedTemplate";
import { Affiliation } from "../../models/Affiliation";
import { ProjectCollaborator } from "../../models/Collaborator";
import { getCurrentDate } from "../../utils/helpers";
import { sendFeedbackCompleteEmail } from "../../services/emailService";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/emailService');
jest.mock('../../services/openSearchService');

let testServer: ApolloServer;
let affiliationId: string;
let planId: number;
let planFeedbackId: number;
let plan: Plan;
let project: Project;
let feedback: PlanFeedback;
let feedbackComment: PlanFeedbackComment;
let researcherToken: JWTAccessToken;
let adminToken: JWTAccessToken;
let superAdminToken: JWTAccessToken;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeQuery(query: string, variables: any, token: JWTAccessToken): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation({ query, variables }, { contextValue: context });
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  planId = casual.integer(1, 9999);
  planFeedbackId = casual.integer(1, 9999);

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
    answerId: casual.integer(1, 9999),
    feedbackId: planFeedbackId,
    commentText: casual.sentence,
    createdById: casual.integer(1, 9999),
  });

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
    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the feedback record is not found', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(query, { planId, planFeedbackId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('marks the feedback as complete and returns it when successful', async () => {
    project.createdById = researcherToken.id;
    const completedFeedback = new PlanFeedback({
      ...feedback,
      completed: getCurrentDate(),
      completedById: researcherToken.id,
      summaryText: casual.sentence,
    });
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
  });

  it('returns a 500 on a fatal error', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedback.prototype, 'update').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { planId, planFeedbackId, summaryText: casual.sentence, sendEmail: true }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });

  it('should not call sendFeedbackCompleteEmail when sendEmail is false', async () => {
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
    expect(sendFeedbackCompleteEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addFeedbackComment mutation
// ---------------------------------------------------------------------------
describe('addFeedbackComment mutation', () => {
  let query: string;
  let answerId: number;

  beforeEach(() => {
    answerId = casual.integer(1, 9999);
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
    const primaryCollaborator = Object.assign(
      new ProjectCollaborator({ projectId: project.id, email: casual.email }),
      { affiliationId }
    );
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue(
      primaryCollaborator as import('../../models/Collaborator').ProjectCollaboratorWithUser
    );
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, adminToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the feedback round is already completed', async () => {
    const primaryCollaborator = Object.assign(
      new ProjectCollaborator({ projectId: project.id, email: casual.email }),
      { affiliationId }
    );
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue(
      primaryCollaborator as import('../../models/Collaborator').ProjectCollaboratorWithUser
    );
    const completedFeedback = new PlanFeedback({
      ...feedback,
      completed: getCurrentDate(),
    });
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(completedFeedback);

    const resp = await executeQuery(
      query, { planId, planFeedbackId, answerId, commentText: casual.sentence }, adminToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('adds the comment and returns it when successful', async () => {
    // feedback.completed is null by default (open)
    const resp = await executeQuery(
      query,
      { planId, planFeedbackId, answerId, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.addFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.create).toHaveBeenCalledTimes(1);
  });

  it('adds the comment when the user is a collaborator even if feedback is not open', async () => {
    // Collaborators can always comment regardless of feedback state
    project.createdById = researcherToken.id;
    const closedFeedback = new PlanFeedback({ ...feedback, completed: getCurrentDate() });
    jest.spyOn(PlanFeedback, 'findById').mockResolvedValue(closedFeedback);

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
      query, { planId, planFeedbackCommentId: feedbackComment.id, commentText: casual.sentence }, null
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not the comment creator', async () => {
    // feedbackComment.createdById does not match researcherToken.id
    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: casual.sentence },
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
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: casual.sentence },
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
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user is not the comment creator', async () => {
    // feedbackComment.createdById is a random int that won't match the token id
    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: casual.sentence },
      superAdminToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('updates the comment and returns it when successful', async () => {
    feedbackComment.createdById = superAdminToken.id;
    const newText = casual.sentence;
    const updatedComment = new PlanFeedbackComment({ ...feedbackComment, commentText: newText });
    jest.spyOn(PlanFeedbackComment.prototype, 'update').mockResolvedValue(updatedComment);

    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: newText },
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
    const updatedComment = new PlanFeedbackComment({ ...feedbackComment, commentText: newText });
    jest.spyOn(PlanFeedbackComment.prototype, 'update').mockResolvedValue(updatedComment);

    const resp = await executeQuery(
      query,
      { planId, planFeedbackCommentId: feedbackComment.id, commentText: newText },
      researcherToken,
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.updateFeedbackComment.id).toEqual(updatedComment.id);
    expect(PlanFeedbackComment.prototype.update).toHaveBeenCalledTimes(1);
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
      query, { planId, planFeedbackCommentId: feedbackComment.id }, null
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the plan is not found', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user is not the comment creator or a PRIMARY collaborator', async () => {
    // feedbackComment.createdById is random and primaryCollaborator is null (global mock)
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the comment is not found', async () => {
    project.createdById = researcherToken.id;
    jest.spyOn(PlanFeedbackComment, 'findById').mockResolvedValue(null);
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the user is neither the comment creator nor the PRIMARY collaborator', async () => {
    // feedbackComment.createdById is random and primaryCollaborator is null (global mock)
    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('deletes the comment when the user is the PRIMARY collaborator', async () => {
    // feedbackComment.createdById does NOT match researcherToken.id
    // but researcherToken IS the primary collaborator
    const primaryCollaborator = Object.assign(
      new ProjectCollaborator({ projectId: project.id, email: researcherToken.email }),
      { affiliationId: researcherToken.affiliationId }
    );
    primaryCollaborator.userId = researcherToken.id;
    jest.spyOn(ProjectCollaborator, 'findPrimaryUserByProjectId').mockResolvedValue(
      primaryCollaborator as import('../../models/Collaborator').ProjectCollaboratorWithUser
    );

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.delete).toHaveBeenCalledTimes(1);
  });

  it('deletes the comment and returns it when the user is the comment creator', async () => {
    project.createdById = researcherToken.id;
    feedbackComment.createdById = researcherToken.id;

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeFeedbackComment.id).toEqual(feedbackComment.id);
    expect(PlanFeedbackComment.prototype.delete).toHaveBeenCalledTimes(1);
  });

  it('returns a 500 on a fatal error', async () => {
    project.createdById = researcherToken.id;
    feedbackComment.createdById = researcherToken.id;
    jest.spyOn(PlanFeedbackComment.prototype, 'delete').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(
      query, { planId, planFeedbackCommentId: feedbackComment.id }, researcherToken
    );

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});
