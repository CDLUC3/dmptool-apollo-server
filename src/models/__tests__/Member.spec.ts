import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

// Dynamic imports AFTER all mocks are registered
const { PlanMember, ProjectMember } = await import("../Member.js");
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { getMockORCID } = await import("../../__tests__/helpers.js");
const { MemberRole } = await import("../MemberRole.js");

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ProjectMember', () => {
  let projectMember;

  const memberData = {
    projectId: casual.integer(1, 9),
    affiliationId: casual.url,
    givenName: casual.first_name,
    surName: casual.last_name,
    orcid: getMockORCID(),
    email: casual.email,
    memberRoles: [new MemberRole({ id: casual.integer(1, 99) })],
  }
  beforeEach(() => {
    projectMember = new ProjectMember(memberData);
  });

  it('should initialize options as expected', () => {
    expect(projectMember.projectId).toEqual(memberData.projectId);
    expect(projectMember.affiliationId).toEqual(memberData.affiliationId);
    expect(projectMember.givenName).toEqual(memberData.givenName);
    expect(projectMember.surName).toEqual(memberData.surName);
    expect(projectMember.orcid).toEqual(memberData.orcid);
    expect(projectMember.email).toEqual(memberData.email);
    expect(projectMember.memberRoles).toEqual(memberData.memberRoles);
  });

  it('should return true when calling isValid with a name field', async () => {
    expect(await projectMember.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a projectId field', async () => {
    projectMember.projectId = null;
    expect(await projectMember.isValid()).toBe(false);
    expect(Object.keys(projectMember.errors).length).toBe(1);
    expect(projectMember.errors['projectId']).toBeTruthy();
  });

  it('should return false when calling isValid when the orcid field is not a valid ORCID', async () => {
    projectMember.orcid = '2945yt9u245yt';
    expect(await projectMember.isValid()).toBe(false);
    expect(Object.keys(projectMember.errors).length).toBe(1);
    expect(projectMember.errors['orcid']).toBeTruthy();
  });

  it('should return false when calling isValid when the email field is not a valid email', async () => {
    projectMember.email = 'tester.testing.edu';
    expect(await projectMember.isValid()).toBe(false);
    expect(Object.keys(projectMember.errors).length).toBe(1);
    expect(projectMember.errors['email']).toBeTruthy();
  });

  it('should return false when calling isValid if no name, orcid or email is present', async () => {
    projectMember.givenName = null;
    projectMember.surName = null;
    projectMember.orcid = null;
    projectMember.email = null;
    expect(await projectMember.isValid()).toBe(false);
    expect(Object.keys(projectMember.errors).length).toBe(1);
    expect(projectMember.errors['general']).toBeTruthy();
  });
});

describe('areEqual', () => {
  it('should return true when both members ids match', () => {
    const memberA = new ProjectMember({ id: 1, projectId: 1 });
    const memberB = new ProjectMember({ id: 1, projectId: 2 });
    expect(ProjectMember.areEqual(memberA, memberB)).toBe(true);
  });

  it('should return true when both members orids match', () => {
    const memberA = new ProjectMember({ id: 1, projectId: 1, orcid: '0000-0000-0000-0000' });
    const memberB = new ProjectMember({ id: 2, projectId: 2, orcid: '0000-0000-0000-0000' });
    expect(ProjectMember.areEqual(memberA, memberB)).toBe(true);
  });

  it('should return true when both members emails match', () => {
    const memberA = new ProjectMember({ id: 1, projectId: 1, email: 'test@example.com' });
    const memberB = new ProjectMember({ id: 2, projectId: 2, email: 'test@example.com' });
    expect(ProjectMember.areEqual(memberA, memberB)).toBe(true);
  });

  it('should return true when both members names match', () => {
    const memberA = new ProjectMember({ id: 1, projectId: 1, givenName: 'John', surName: 'Doe' });
    const memberB = new ProjectMember({ id: 2, projectId: 2, givenName: 'John', surName: 'Doe' });
    expect(ProjectMember.areEqual(memberA, memberB)).toBe(true);
  });

  it('should return false when none of id, orcid, email and name do not match', () => {
    const memberA = new ProjectMember({ id: 1, projectId: 1, orcid: '0000-0000-0000-0000', email: 'test@example.com', givenName: 'John', surName: 'Doe' });
    const memberB = new ProjectMember({ id: 2, projectId: 2, orcid: '1111-1111-1111-1111', email: 'test2@example.com', givenName: 'Jane', surName: 'Smith' });
    expect(ProjectMember.areEqual(memberA, memberB)).toBe(false);
  });
});

describe('findBy Queries', () => {
  const originalQuery = ProjectMember.query;

  let localQuery;
  let context;
  let projectMember;

  beforeEach(async () => {
    localQuery = jest.fn();
    (ProjectMember.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    projectMember = new ProjectMember({
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    ProjectMember.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectMemberId = casual.integer(1, 999);
    const result = await ProjectMember.findById('testing', context, projectMemberId);
    const expectedSql = 'SELECT * FROM projectMembers WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectMemberId.toString()], 'testing')
    expect(result).toEqual(projectMember);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectMemberId = casual.integer(1, 999);
    const result = await ProjectMember.findById('testing', context, projectMemberId);
    expect(result).toEqual(null);
  });

  it('findByProjectId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectId = casual.integer(1, 999);
    const result = await ProjectMember.findByProjectId('testing', context, projectId);
    const expectedSql = 'SELECT * FROM projectMembers WHERE projectId = ? ORDER BY surName, givenName';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'testing');
    expect(result).toEqual([projectMember]);
  });

  it('findByProjectId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await ProjectMember.findByProjectId('testing', context, projectId);
    expect(result).toEqual([]);
  });

  it('findByAffiliation should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const affiliationId = casual.url;
    const result = await ProjectMember.findByAffiliation('testing', context, affiliationId);
    const expectedSql = 'SELECT * FROM projectMembers WHERE affiliationId = ? ORDER BY surName, givenName';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliationId], 'testing');
    expect(result).toEqual([projectMember]);
  });

  it('findByAffiliation should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const affiliationId = casual.url;
    const result = await ProjectMember.findByAffiliation('testing', context, affiliationId);
    expect(result).toEqual([]);
  });

  it('findByProjectAndEmail should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectId = casual.integer(1, 999);
    const email = casual.email;
    const result = await ProjectMember.findByProjectAndEmail('testing', context, projectId, email);
    const expectedSql = 'SELECT * FROM projectMembers WHERE projectId = ? AND email = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString(), email], 'testing');
    expect(result).toEqual(projectMember);
  });

  it('findByProjectAndEmail should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const email = casual.email;
    const result = await ProjectMember.findByProjectAndEmail('testing', context, projectId, email);
    expect(result).toEqual(null);
  });

  it('findByProjectAndORCID should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectId = casual.integer(1, 999);
    const orcid = casual.card_number();
    const result = await ProjectMember.findByProjectAndORCID('testing', context, projectId, orcid);
    const expectedSql = 'SELECT * FROM projectMembers WHERE projectId = ? AND orcid = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString(), orcid], 'testing');
    expect(result).toEqual(projectMember);
  });

  it('findByProjectAndORCID should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const orcid = casual.card_number();
    const result = await ProjectMember.findByProjectAndORCID('testing', context, projectId, orcid);
    expect(result).toEqual(null);
  });

  it('findByProjectAndName should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectId = casual.integer(1, 999);
    const givenName = casual.first_name;
    const surName = casual.last_name;
    const result = await ProjectMember.findByProjectAndName('testing', context, projectId, givenName, surName);
    const expectedSql = 'SELECT * FROM projectMembers WHERE projectId = ? AND LOWER(givenName) = ? AND LOWER(surName) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    const vals = [projectId.toString(), givenName.toLowerCase(), surName.toLowerCase()];
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, vals, 'testing');
    expect(result).toEqual(projectMember);
  });

  it('findByProjectAndName should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const givenName = casual.first_name;
    const surName = casual.last_name;
    const result = await ProjectMember.findByProjectAndName('testing', context, projectId, givenName, surName);
    expect(result).toEqual(null);
  });

  it('findByProjectAndNameOrORCIDOrEmail should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectMember]);
    const projectId = casual.integer(1, 999);
    const givenName = casual.first_name;
    const surName = casual.last_name;
    const orcid = casual.card_number();
    const email = casual.email;
    const result = await ProjectMember.findByProjectAndNameOrORCIDOrEmail('testing', context, projectId, givenName, surName, orcid, email);
    const expectedSql = 'SELECT * FROM projectMembers WHERE projectId = ? AND ((LOWER(givenName) = ? AND LOWER(surName) = ?) OR (orcid = ?) ' +
      'OR (email = ?)) ORDER BY orcid DESC, email DESC, surName, givenName';
    expect(localQuery).toHaveBeenCalledTimes(1);
    const vals = [projectId.toString(), givenName.toLowerCase(), surName.toLowerCase(), orcid, email];
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, vals, 'testing');
    expect(result).toEqual(projectMember);
  });

  it('findByProjectAndNameOrORCIDOrEmail should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const givenName = casual.first_name;
    const surName = casual.last_name;
    const orcid = casual.card_number();
    const email = casual.email;
    const result = await ProjectMember.findByProjectAndNameOrORCIDOrEmail('testing', context, projectId, givenName, surName, orcid, email);
    expect(result).toEqual(null);
  });
});

describe('update', () => {
  let updateQuery;
  let projectMember;

  beforeEach(() => {
    updateQuery = jest.fn();
    (ProjectMember.update as jest.Mock) = updateQuery;

    projectMember = new ProjectMember({
      id: casual.integer(1, 9999),
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    })
  });

  it('returns the ProjectMember with errors if it is not valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (projectMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await projectMember.update(context);
    expect(result).toBeInstanceOf(ProjectMember);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the ProjectMember has no id', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (projectMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    projectMember.id = null;
    const result = await projectMember.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated ProjectMember', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (projectMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(projectMember);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(projectMember);

    const result = await projectMember.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectMember);
  });
});

describe('create', () => {
  const originalInsert = ProjectMember.insert;
  let insertQuery;
  let projectMember;

  beforeEach(() => {
    insertQuery = jest.fn();
    (ProjectMember.insert as jest.Mock) = insertQuery;

    projectMember = new ProjectMember({
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    });
  });

  afterEach(() => {
    ProjectMember.insert = originalInsert;
    ProjectMember.findByProjectAndEmail = null; //originalFindByProjectAndEmail;
  });

  it('returns the ProjectMember without errors if it is valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (projectMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await projectMember.create(context);
    expect(result).toBeInstanceOf(ProjectMember);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the ProjectMember with errors if it is invalid', async () => {
    projectMember.projectId = undefined;
    const response = await projectMember.create(context);
    expect(response.errors['projectId']).toBe('Project can\'t be blank');
  });

  it('returns the ProjectMember with an error if the question already exists', async () => {
    const mockFindBy = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findByProjectAndORCID as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(projectMember);

    const result = await projectMember.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added ProjectMember', async () => {
    const mockFindBy = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findByProjectAndEmail as jest.Mock) = mockFindBy;
    (ProjectMember.findByProjectAndORCID as jest.Mock) = mockFindBy;
    (ProjectMember.findByProjectAndName as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(projectMember);

    const result = await projectMember.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(3);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectMember);
  });
});

describe('delete', () => {
  const originalFindById = ProjectMember.findById;
  const originalPlanMemberFindByPlanId = PlanMember.findByPlanId;
  const originalFindByProjectMemberId = PlanMember.findByProjectMemberId;

  let projectMember;
  let projectMember2;
  let memberData1;
  let memberData2

  beforeEach(() => {
    projectMember = new ProjectMember({
      id: casual.integer(1, 9999),
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    });

    projectMember2 = new ProjectMember({
      id: casual.integer(1, 9999),
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    });

    memberData1 = new PlanMember({
      id: casual.integer(1, 99),
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 99),
      isPrimaryContact: true,
      error: null
    });

    memberData2 = new PlanMember({
      id: casual.integer(1, 99),
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 99),
      isPrimaryContact: true,
      error: null
    });
  })

  afterEach(() => {
    jest.clearAllMocks();
    ProjectMember.findById = originalFindById;
    PlanMember.findByPlanId = originalPlanMemberFindByPlanId;
    PlanMember.findByProjectMemberId = originalFindByProjectMemberId;
  });

  it('returns null if the ProjectMember has no id', async () => {
    projectMember.id = null;
    expect(await projectMember.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {

    // Mock ProjectMember.delete
    const deleteQuery = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(null);

    // Mock PlanMember.delete
    const mockPlanMemberDelete = jest.fn<() => Promise<boolean>>();
    (PlanMember.delete as jest.Mock) = mockPlanMemberDelete;
    mockPlanMemberDelete.mockResolvedValue(true); // or whatever you want it to return

    const mockFindByProjectId = jest.fn<() => Promise<InstanceType<typeof ProjectMember>[] | null>>();
    (ProjectMember.findByProjectId as jest.Mock) = mockFindByProjectId;
    mockFindByProjectId.mockResolvedValueOnce([projectMember, projectMember2]);//Need more than just one projectMember in order to get to the delete function

    const mockPlanMemberFindByProjectMemberId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[] | null>>();
    (PlanMember.findByProjectMemberId as jest.Mock) = mockPlanMemberFindByProjectMemberId;
    mockPlanMemberFindByProjectMemberId.mockResolvedValueOnce([memberData1, memberData2]);

    const mockPlanMemberFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[] | null>>();
    (PlanMember.findByPlanId as jest.Mock) = mockPlanMemberFindByPlanId;
    mockPlanMemberFindByPlanId.mockResolvedValue([memberData1, memberData2]); // Need more than one, or it won't reach the delete function

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(projectMember);

    expect(await projectMember.delete(context)).toBe(null);
  });

  it('returns the ProjectMember if it was able to delete the record', async () => {
    const deleteQuery = jest.fn<() => Promise<boolean>>();
    (ProjectMember.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(projectMember);

    // Mock PlanMember.delete
    const mockPlanMemberDelete = jest.fn<() => Promise<boolean>>();
    (PlanMember.delete as jest.Mock) = mockPlanMemberDelete;
    mockPlanMemberDelete.mockResolvedValueOnce(projectMember);

    const mockFindByProjectId = jest.fn<() => Promise<InstanceType<typeof ProjectMember>[] | null>>();
    (ProjectMember.findByProjectId as jest.Mock) = mockFindByProjectId;
    mockFindByProjectId.mockResolvedValueOnce([projectMember, projectMember2]);//Need more than just one projectMember in order to get to the delete function

    const mockPlanMemberFindByProjectMemberId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[]>>();
    (PlanMember.findByProjectMemberId as jest.Mock) = mockPlanMemberFindByProjectMemberId;
    mockPlanMemberFindByProjectMemberId.mockResolvedValueOnce([memberData1, memberData2]);

    const mockPlanMemberFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[] | null>>();
    (PlanMember.findByPlanId as jest.Mock) = mockPlanMemberFindByPlanId;
    mockPlanMemberFindByPlanId.mockResolvedValue([memberData1, memberData2]); // Need more than one, or it won't reach the delete function

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(projectMember);

    const result = await projectMember.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectMember);
    // Test that PlanMember.delete was called for each plan member
    expect(mockPlanMemberDelete).toHaveBeenCalledTimes(2); // Called once for memberData1 and once for memberData2

    // Test the specific calls to PlanMember.delete
    expect(mockPlanMemberDelete).toHaveBeenNthCalledWith(1, context, PlanMember.tableName, memberData1.id, 'ProjectMember.delete');
    expect(mockPlanMemberDelete).toHaveBeenNthCalledWith(2, context, PlanMember.tableName, memberData2.id, 'ProjectMember.delete');

    // You can also test that ProjectMember.delete was called
    expect(deleteQuery).toHaveBeenCalledTimes(1);
    expect(deleteQuery).toHaveBeenCalledWith(context, ProjectMember.tableName, projectMember.id, 'ProjectMember.delete');
  });

  it('returns an error if there is only one project member', async () => {
    const deleteQuery = jest.fn<() => Promise<boolean>>();
    (ProjectMember.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(projectMember);

    const mockFindByProjectId = jest.fn<() => Promise<InstanceType<typeof ProjectMember>[]>>();
    (ProjectMember.findByProjectId as jest.Mock) = mockFindByProjectId;
    mockFindByProjectId.mockResolvedValueOnce([projectMember]);

    const mockPlanMemberFindByProjectMemberId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[]>>();
    (PlanMember.findByProjectMemberId as jest.Mock) = mockPlanMemberFindByProjectMemberId;
    mockPlanMemberFindByProjectMemberId.mockResolvedValueOnce([memberData1, memberData2]);

    const mockPlanMemberFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[] | null>>();
    (PlanMember.findByPlanId as jest.Mock) = mockPlanMemberFindByPlanId;
    mockPlanMemberFindByPlanId.mockResolvedValue([memberData1, memberData2]); // Need more than one, or it won't reach the delete function

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectMember> | null>>();
    (ProjectMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValue(projectMember);

    const result = await projectMember.delete(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result).toBeInstanceOf(ProjectMember);
    expect(result.errors.general).toBe('A project needs at least one member, so you cannot remove the last one.');
  });
});

describe('PlanMember', () => {
  let planMember;

  const memberData = {
    planId: casual.integer(1, 9),
    projectMemberId: casual.url,
    memberRoleIds: [casual.integer(1, 99)],
  }
  beforeEach(() => {
    planMember = new PlanMember(memberData);
  });

  it('should initialize options as expected', () => {
    expect(planMember.planId).toEqual(memberData.planId);
    expect(planMember.projectMemberId).toEqual(memberData.projectMemberId);
    expect(planMember.memberRoleIds).toEqual(memberData.memberRoleIds);
  });

  it('should return true when calling isValid with a name field', async () => {
    expect(await planMember.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a planId field', async () => {
    planMember.planId = null;
    expect(await planMember.isValid()).toBe(false);
    expect(Object.keys(planMember.errors).length).toBe(1);
    expect(planMember.errors['planId']).toBeTruthy();
  });

  it('should return false when calling isValid without a projectMemberId field', async () => {
    planMember.projectMemberId = null;
    expect(await planMember.isValid()).toBe(false);
    expect(Object.keys(planMember.errors).length).toBe(1);
    expect(planMember.errors['projectMemberId']).toBeTruthy();
  });

  it('should return false when calling isValid if there are no memberRoleIds', async () => {
    planMember.memberRoleIds = [];
    expect(await planMember.isValid()).toBe(false);
    expect(Object.keys(planMember.errors).length).toBe(1);
    expect(planMember.errors['memberRoleIds']).toBeTruthy();
  });
});

describe('findByPlanId', () => {
  const originalQuery = PlanMember.query;

  let localQuery;
  let context;
  let planMember;

  beforeEach(async () => {
    localQuery = jest.fn();
    (PlanMember.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    planMember = new PlanMember({
      planId: casual.integer(1, 999),
      affiliationId: casual.url,
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: getMockORCID(),
      email: casual.email,
      memberRoles: [new MemberRole({ id: casual.integer(1, 99) })]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PlanMember.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planMember]);
    const planMemberId = casual.integer(1, 999);
    const result = await PlanMember.findById('testing', context, planMemberId);
    const expectedSql = 'SELECT * FROM planMembers WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planMemberId.toString()], 'testing');
    expect(result).toEqual(planMember);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planMemberId = casual.integer(1, 999);
    const result = await PlanMember.findById('testing', context, planMemberId);
    expect(result).toEqual(null);
  });

  it('findByPlanAndProjectMember should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planMember]);
    const planId = casual.integer(1, 999);
    const planMemberId = casual.integer(1, 999);
    const result = await PlanMember.findByPlanAndProjectMember('testing', context, planId, planMemberId);
    const expectedSql = 'SELECT * FROM planMembers WHERE planId = ? AND projectMemberId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString(), planMemberId.toString()], 'testing');
    expect(result).toEqual(planMember);
  });

  it('findByPlanAndProjectMember should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const planMemberId = casual.integer(1, 999);
    const result = await PlanMember.findByPlanAndProjectMember('testing', context, planId, planMemberId);
    expect(result).toEqual(null);
  });

  it('findByPlanId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planMember]);
    const planId = casual.integer(1, 999);
    const result = await PlanMember.findByPlanId('testing', context, planId);
    const expectedSql = 'SELECT * FROM planMembers WHERE planId = ? ORDER BY isPrimaryContact DESC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString()], 'testing');
    expect(result).toEqual([planMember]);
  });

  it('findByPlanId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const result = await PlanMember.findByPlanId('testing', context, planId);
    expect(result).toEqual([]);
  });

  it('findByProjectMemberId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planMember]);
    const projectMemberId = casual.integer(1, 999);
    const result = await PlanMember.findByProjectMemberId('testing', context, projectMemberId);
    const expectedSql = 'SELECT * FROM planMembers WHERE projectMemberId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectMemberId.toString()], 'testing');
    expect(result).toEqual([planMember]);
  });

  it('findByProjectMemberId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectMemberId = casual.integer(1, 999);
    const result = await PlanMember.findByProjectMemberId('testing', context, projectMemberId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let planMember;

  beforeEach(() => {
    updateQuery = jest.fn();
    (PlanMember.update as jest.Mock) = updateQuery;

    planMember = new PlanMember({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 999),
      memberRoles: [casual.integer(1, 99)]
    })
  });

  it('returns the PlanMember with errors if it is not valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (planMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planMember.update(context);
    expect(result).toBeInstanceOf(PlanMember);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the PlanMember has no id', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (planMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    planMember.id = null;
    const result = await planMember.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated PlanMember', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (planMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(planMember);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planMember);

    const result = await planMember.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanMember);
  });
});

describe('create', () => {
  const originalInsert = PlanMember.insert;
  let insertQuery;
  let planMember;

  beforeEach(() => {
    insertQuery = jest.fn();
    (PlanMember.insert as jest.Mock) = insertQuery;

    planMember = new PlanMember({
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 999),
      memberRoleIds: [casual.integer(1, 99)],
    });
  });

  afterEach(() => {
    PlanMember.insert = originalInsert;
    PlanMember.findByPlanAndProjectMember = null;
  });

  it('returns the PlanMember without errors if it is valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (planMember.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planMember.create(context);
    expect(result).toBeInstanceOf(PlanMember);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the PlanMember with errors if it is invalid', async () => {
    planMember.planId = undefined;
    const response = await planMember.create(context);
    expect(response.errors['planId']).toBe('Plan can\'t be blank');
  });

  it('returns the PlanMember with an error if the question already exists', async () => {
    const mockFindBy = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findByPlanAndProjectMember as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(planMember);

    const result = await planMember.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added PlanMember', async () => {
    const mockFindBy = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findByPlanAndProjectMember as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planMember);

    const result = await planMember.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanMember);
  });
});

describe('delete', () => {
  let planMember;
  let planMember2;

  beforeEach(() => {
    planMember = new PlanMember({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 999),
      memberRoleIds: [casual.integer(1, 99)],
    });

    planMember2 = new PlanMember({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 999),
      projectMemberId: casual.integer(1, 999),
      memberRoleIds: [casual.integer(1, 99)],
    });
  })

  it('returns null if the PlanMember has no id', async () => {
    planMember.id = null;
    expect(await planMember.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn<() => Promise<Boolean>>();
    (PlanMember.delete as jest.Mock) = deleteQuery;

    const mockFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[]>>();
    (PlanMember.findByPlanId as jest.Mock) = mockFindByPlanId;
    mockFindByPlanId.mockResolvedValueOnce([planMember, planMember2]);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planMember);

    deleteQuery.mockResolvedValueOnce(null);
    expect(await planMember.delete(context)).toBe(null);
  });

  it('returns the PlanMember if it was able to delete the record', async () => {
    const deleteQuery = jest.fn<() => Promise<Boolean>>();
    (PlanMember.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(planMember);

    const mockFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[]>>();
    (PlanMember.findByPlanId as jest.Mock) = mockFindByPlanId;
    mockFindByPlanId.mockResolvedValueOnce([planMember, planMember2]);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planMember);

    const result = await planMember.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanMember);
  });

  it('returns error when there is only one plan member for the given planId', async () => {
    const deleteQuery = jest.fn<() => Promise<Boolean>>();
    (PlanMember.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(planMember);

    const mockFindByPlanId = jest.fn<() => Promise<InstanceType<typeof PlanMember>[]>>();
    (PlanMember.findByPlanId as jest.Mock) = mockFindByPlanId;
    mockFindByPlanId.mockResolvedValueOnce([planMember]);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof PlanMember> | null>>();
    (PlanMember.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planMember);

    const result = await planMember.delete(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result).toBeInstanceOf(PlanMember);
  });
});
