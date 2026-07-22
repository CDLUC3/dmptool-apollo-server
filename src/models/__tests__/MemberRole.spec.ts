import casual from 'casual';
import { MemberRole } from '../MemberRole';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from "../../logger";

describe('MemberRole', () => {
  it('constructor should initialize as expected', () => {
    const displayOrder = casual.integer(1, 9);
    const label = casual.words(3);
    const uri = casual.url;
    const createdById = casual.integer(1, 999);

    const role = new MemberRole({ displayOrder, label, uri, createdById });

    expect(role.displayOrder).toEqual(displayOrder);
    expect(role.label).toEqual(label);
    expect(role.uri).toEqual(uri);
    expect(role.description).toBeFalsy();
    expect(role.createdById).toEqual(createdById);
  });

  it('isValid returns true when the displayOrder, label and url are present', async () => {
    const displayOrder = casual.integer(1, 9);
    const label = casual.words(3);
    const uri = casual.url;
    const createdById = casual.integer(1, 999);

    const role = new MemberRole({ displayOrder, label, uri, createdById });
    expect(await role.isValid()).toBe(true);
  });

  it('isValid returns false when the displayOrder is NOT present', async () => {
    const label = casual.words(3);
    const uri = casual.url;
    const createdById = casual.integer(1, 999);

    const role = new MemberRole({ label, uri, createdById });
    expect(await role.isValid()).toBe(false);
    expect(Object.keys(role.errors).length).toBe(1);
    expect(role.errors['displayOrder']).toBeTruthy();
  });

  it('isValid returns false when the label is NOT present', async () => {
    const displayOrder = casual.integer(1, 9);
    const uri = casual.url;
    const createdById = casual.integer(1, 999);

    const role = new MemberRole({ displayOrder, uri, createdById });
    expect(await role.isValid()).toBe(false);
    expect(Object.keys(role.errors).length).toBe(1);
    expect(role.errors['label']).toBeTruthy();
  });

  it('isValid returns false when the uri is NOT present', async () => {
    const displayOrder = casual.integer(1, 9);
    const label = casual.words(3);
    const createdById = casual.integer(1, 999);

    const role = new MemberRole({ displayOrder, label, createdById });
    expect(await role.isValid()).toBe(false);
    expect(Object.keys(role.errors).length).toBe(1);
    expect(role.errors['uri']).toBeTruthy();
  });
});

describe('addToProjectMember', () => {
  let context;
  let mockRole;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRole = new MemberRole({
      id: casual.integer(1, 99),
      label: casual.word,
      uri: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the MemberRole to the specified ProjectMember', async () => {
    const projectMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(mockRole);
    const result = await mockRole.addToProjectMember(context, projectMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    let expectedSql = 'INSERT INTO projectMemberRoles (memberRoleId, projectMemberId, ';
    expectedSql += 'createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockRole.id.toString(), projectMemberId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'MemberRole.addToProjectMember', undefined)
    expect(result).toBe(true);
  });

  it('returns null if the role cannot be associated with the ProjectMember', async () => {
    const projectMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(null);
    const result = await mockRole.addToProjectMember(context, projectMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('addToPlanMember', () => {
  let context;
  let mockRole;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRole = new MemberRole({
      id: casual.integer(1, 99),
      label: casual.word,
      uri: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the MemberRole to the specified PlanMember', async () => {
    const planMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(mockRole);
    const result = await mockRole.addToPlanMember(context, planMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    let expectedSql = 'INSERT INTO planMemberRoles (memberRoleId, planMemberId, ';
    expectedSql += 'createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockRole.id.toString(), planMemberId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'MemberRole.addToPlanMember', undefined)
    expect(result).toBe(true);
  });

  it('returns null if the role cannot be associated with the PlanMember', async () => {
    const planMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(null);
    const result = await mockRole.addToPlanMember(context, planMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('removeFromProjectMember', () => {
  let context;
  let mockRole;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRole = new MemberRole({
      id: casual.integer(1, 99),
      label: casual.word,
      uri: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the MemberRole association from the specified ProjectMember', async () => {
    const projectMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(mockRole);
    const result = await mockRole.removeFromProjectMember(context, projectMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'DELETE FROM projectMemberRoles WHERE memberRoleId = ? AND projectMemberId = ?';
    const vals = [mockRole.id.toString(), projectMemberId.toString()]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'MemberRole.removeFromProjectMember', undefined);
    expect(result).toBe(true);
  });

  it('returns null if the role cannot be associated with the ProjectMember', async () => {
    const projectMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(null);
    const result = await mockRole.removeFromProjectMember(context, projectMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('removeFromPlanMember', () => {
  let context;
  let mockRole;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockRole = new MemberRole({
      id: casual.integer(1, 99),
      label: casual.word,
      uri: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the MemberRole association from the specified PlanMember', async () => {
    const planMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(mockRole);
    const result = await mockRole.removeFromPlanMember(context, planMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'DELETE FROM planMemberRoles WHERE memberRoleId = ? AND planMemberId = ?';
    const vals = [mockRole.id.toString(), planMemberId.toString()]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'MemberRole.removeFromPlanMember', undefined)
    expect(result).toBe(true);
  });

  it('returns null if the role cannot be associated with the PlanMember', async () => {
    const planMemberId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce(null);
    const result = await mockRole.removeFromPlanMember(context, planMemberId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('queries', () => {
  const originalQuery = MemberRole.query;
  let mockQuery;
  let context;
  let mockRole;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    (MemberRole.insert as jest.Mock) = mockQuery;

    context = await buildMockContextWithToken(logger);

    mockRole = {
      id: casual.integer(1, 99),
      label: casual.word,
      uri: casual.url
    };
  });

  afterEach(() => {
    MemberRole.query = originalQuery;
  });

  it('all performs the expected query', async () => {
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce([mockRole]);
    await MemberRole.all('Testing', context);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM memberRoles ORDER BY label';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [], 'Testing', undefined)
  });

  it('findById performs the expected query', async () => {
    const memberRoleId = casual.integer(1, 999);
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce([mockRole]);
    await MemberRole.findById('Testing', context, memberRoleId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM memberRoles WHERE id = ?';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [memberRoleId.toString()], 'Testing', undefined)
  });

  it('findByURL performs the expected query', async () => {
    const memberRoleUrl = casual.url;
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce([mockRole]);
    await MemberRole.findByURL('Testing', context, memberRoleUrl);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM memberRoles WHERE uri = ?';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [memberRoleUrl], 'Testing', undefined)
  });

  it('findByProjectMemberId should call query with correct params and return an array', async () => {
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce([mockRole]);
    const memberId = casual.integer(1, 999);
    await MemberRole.findByProjectMemberId('testing', context, memberId);
    let sql = 'SELECT mr.* FROM projectMemberRoles pmr INNER JOIN memberRoles mr ON pmr.memberRoleId = mr.id';
    sql = `${sql} WHERE pmr.projectMemberId = ?`;
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith(context, sql, [memberId.toString()], 'testing', undefined);
  });

  it('findByPlanMemberId should call query with correct params and return an array', async () => {
    const querySpy = jest.spyOn(MemberRole, 'query').mockResolvedValueOnce([mockRole]);
    const memberId = casual.integer(1, 999);
    await MemberRole.findByPlanMemberId('testing', context, memberId);
    let sql = 'SELECT mr.* FROM planMemberRoles pmr INNER JOIN memberRoles mr ON pmr.memberRoleId = mr.id';
    sql = `${sql} WHERE pmr.planMemberId = ?`;
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith(context, sql, [memberId.toString()], 'testing', undefined);
  });
});
