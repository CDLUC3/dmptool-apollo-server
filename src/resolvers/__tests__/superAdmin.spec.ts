import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from "../../resolver";
import casual from "casual";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { UserRole } from "../../models/User";
import { Plan } from "../../models/Plan";
import { saveMaDMPVersion } from "../../services/planService";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/planService');
jest.mock('../../services/openSearchService');

let testServer: ApolloServer;
let planId: number;
let researcherToken: JWTAccessToken;
let superAdminToken: JWTAccessToken;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeQuery(query: string, variables: any, token: JWTAccessToken): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation({ query, variables }, { contextValue: context });
}

const query = `
  mutation SuperSyncPlanMaDMP($planId: Int!) {
    superSyncPlanMaDMP(planId: $planId)
  }
`;

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  planId = casual.integer(1, 9999);

  researcherToken = await mockToken();
  researcherToken.role = UserRole.RESEARCHER;

  superAdminToken = await mockToken();
  superAdminToken.role = UserRole.SUPERADMIN;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('superSyncPlanMaDMP mutation', () => {
  it('returns a 403 when the user is not a super admin', async () => {
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

  it('returns true when the plan was synchronized', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue({ id: planId, dmpId: casual.uuid } as Plan);
    (saveMaDMPVersion as jest.Mock).mockResolvedValue(true);

    const resp = await executeQuery(query, { planId }, superAdminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.superSyncPlanMaDMP).toBe(true);
  });

  it('returns a 500 on a fatal error', async () => {
    jest.spyOn(Plan, 'findById').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { planId }, superAdminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});
