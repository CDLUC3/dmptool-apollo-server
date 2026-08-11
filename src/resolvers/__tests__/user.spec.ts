import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from "../../resolver";
import casual from "casual";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { User, UserRole } from "../../models/User";
import { UserEmail } from "../../models/UserEmail";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/emailService');
jest.mock('../../services/openSearchService');

let testServer: ApolloServer;
let affiliationId: string;
let userId: number;
let researcherToken: JWTAccessToken;
let adminToken: JWTAccessToken;
let activeUser: User;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeQuery(query: string, variables: any, token: JWTAccessToken): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation({ query, variables }, { contextValue: context });
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  userId = casual.integer(1, 9999);

  researcherToken = await mockToken();
  researcherToken.role = UserRole.RESEARCHER;
  researcherToken.affiliationId = affiliationId;

  adminToken = await mockToken();
  adminToken.role = UserRole.ADMIN;
  adminToken.affiliationId = affiliationId;

  activeUser = new User({
    id: userId,
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId,
    role: UserRole.RESEARCHER,
  });
  activeUser.active = true;
  activeUser.locked = false;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// updateUserProfile mutation
// ---------------------------------------------------------------------------
describe('updateUserProfile mutation', () => {
  let query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: any;

  beforeEach(() => {
    query = `
      mutation UpdateUserProfile($input: UpdateUserProfileInput!) {
        updateUserProfile(input: $input) {
          id
          givenName
        }
      }
    `;
    input = { givenName: casual.first_name, surName: casual.last_name, affiliationId };
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { input }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user account is locked', async () => {
    const lockedUser = new User({ id: userId, affiliationId, role: UserRole.RESEARCHER });
    lockedUser.active = true;
    lockedUser.locked = true;
    jest.spyOn(User, 'findById').mockResolvedValue(lockedUser);

    const resp = await executeQuery(query, { input }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 500 on a fatal error', async () => {
    jest.spyOn(User, 'findById').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { input }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// updateUserNotifications mutation
// ---------------------------------------------------------------------------
describe('updateUserNotifications mutation', () => {
  let query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: any;

  beforeEach(() => {
    query = `
      mutation UpdateUserNotifications($input: UpdateUserNotificationsInput!) {
        updateUserNotifications(input: $input) {
          id
        }
      }
    `;
    input = {
      notify_on_comment_added: true,
      notify_on_template_shared: true,
      notify_on_feedback_complete: true,
      notify_on_plan_shared: true,
      notify_on_plan_visibility_change: true,
    };
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { input }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user account is inactive', async () => {
    const inactiveUser = new User({ id: userId, affiliationId, role: UserRole.RESEARCHER });
    inactiveUser.active = false;
    jest.spyOn(User, 'findById').mockResolvedValue(inactiveUser);

    const resp = await executeQuery(query, { input }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// setUserOrcid mutation
// ---------------------------------------------------------------------------
describe('setUserOrcid mutation', () => {
  const query = `
    mutation SetUserOrcid($orcid: String!) {
      setUserOrcid(orcid: $orcid) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { orcid: '0000-0000-0000-0000' }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });
});

// ---------------------------------------------------------------------------
// addUserEmail mutation
// ---------------------------------------------------------------------------
describe('addUserEmail mutation', () => {
  const query = `
    mutation AddUserEmail($email: String!, $isPrimary: Boolean!) {
      addUserEmail(email: $email, isPrimary: $isPrimary) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { email: casual.email, isPrimary: false }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });
});

// ---------------------------------------------------------------------------
// removeUserEmail mutation
// ---------------------------------------------------------------------------
describe('removeUserEmail mutation', () => {
  const query = `
    mutation RemoveUserEmail($email: String!) {
      removeUserEmail(email: $email) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { email: casual.email }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the email does not belong to the user', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(activeUser);
    jest.spyOn(UserEmail, 'findByUserIdAndEmail').mockResolvedValue(null);

    const resp = await executeQuery(query, { email: casual.email }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// setPrimaryUserEmail mutation
// ---------------------------------------------------------------------------
describe('setPrimaryUserEmail mutation', () => {
  const query = `
    mutation SetPrimaryUserEmail($email: String!) {
      setPrimaryUserEmail(email: $email) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { email: casual.email }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 404 when the email does not belong to the user', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(activeUser);
    jest.spyOn(UserEmail, 'findByUserId').mockResolvedValue([]);

    const resp = await executeQuery(query, { email: casual.email }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// updatePassword mutation
// ---------------------------------------------------------------------------
describe('updatePassword mutation', () => {
  const query = `
    mutation UpdatePassword($oldPassword: String!, $newPassword: String!, $email: String!) {
      updatePassword(oldPassword: $oldPassword, newPassword: $newPassword, email: $email) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const variables = { oldPassword: casual.password, newPassword: casual.password, email: casual.email };
    const resp = await executeQuery(query, variables, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });
});

// ---------------------------------------------------------------------------
// deactivateUser mutation
// ---------------------------------------------------------------------------
describe('deactivateUser mutation', () => {
  const query = `
    mutation DeactivateUser($userId: Int!) {
      deactivateUser(userId: $userId) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { userId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not an admin', async () => {
    const resp = await executeQuery(query, { userId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the user is not found', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(query, { userId }, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('returns a 403 when the admin belongs to a different affiliation', async () => {
    const otherUser = new User({ id: userId, affiliationId: casual.url, role: UserRole.RESEARCHER });
    jest.spyOn(User, 'findById').mockResolvedValue(otherUser);

    const resp = await executeQuery(query, { userId }, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 500 on a fatal error', async () => {
    jest.spyOn(User, 'findById').mockRejectedValue(new Error('DB error'));

    const resp = await executeQuery(query, { userId }, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

// ---------------------------------------------------------------------------
// activateUser mutation
// ---------------------------------------------------------------------------
describe('activateUser mutation', () => {
  const query = `
    mutation ActivateUser($userId: Int!) {
      activateUser(userId: $userId) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { userId }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not an admin', async () => {
    const resp = await executeQuery(query, { userId }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when the user is not found', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(query, { userId }, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// mergeUsers mutation
// ---------------------------------------------------------------------------
describe('mergeUsers mutation', () => {
  const query = `
    mutation MergeUsers($userIdToBeMerged: Int!, $userIdToKeep: Int!) {
      mergeUsers(userIdToBeMerged: $userIdToBeMerged, userIdToKeep: $userIdToKeep) {
        id
      }
    }
  `;

  it('returns a 401 when the user is not authenticated', async () => {
    const resp = await executeQuery(query, { userIdToBeMerged: userId, userIdToKeep: userId + 1 }, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('returns a 403 when the user is not an admin', async () => {
    const resp = await executeQuery(query, { userIdToBeMerged: userId, userIdToKeep: userId + 1 }, researcherToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('returns a 404 when one of the users is not found', async () => {
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    const resp = await executeQuery(query, { userIdToBeMerged: userId, userIdToKeep: userId + 1 }, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('NOT_FOUND');
  });
});
