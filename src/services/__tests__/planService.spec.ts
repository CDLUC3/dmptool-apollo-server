import { MyContext } from '../../context';
import {
  buildMockContextWithToken,
} from '../../__mocks__/context';
import {
  ensureDefaultPlanContact,
  updateMemberRoles,
  saveMaDMPVersion
} from '../planService';
import { MemberRole } from '../../models/MemberRole';
import { logger } from '../../logger';
import { PlanMember, ProjectMember } from "../../models/Member";
import casual from "casual";
import { Project } from "../../models/Project";
import { Plan } from "../../models/Plan";
import {
  createDMP,
  deleteDMP, DMPExists, planToDMPCommonStandard,
  tombstoneDMP,
  updateDMP
} from '@dmptool/utils';
import { getDynamoConnectionParams } from '../../config/awsConfig';
import { generalConfig } from '../../config/generalConfig';
import { DMPToolDMPType } from "@dmptool/types";

jest.mock('@dmptool/utils');

describe('planService', () => {
  let context: MyContext;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  jest.mock('../../models/MemberRole');

  describe('updateMemberRoles', () => {
    it('should remove roles and return updated role IDs', async () => {
      const reference = 'test-reference';
      const memberId = 1;
      const currentRoleIds = [1, 2, 3];
      const newRoleIds = [2, 4];

      MemberRole.reconcileAssociationIds = jest.fn().mockReturnValue({
        idsToBeRemoved: [1, 3],
        idsToBeSaved: [4],
      });

      MemberRole.findById = jest.fn()
        .mockResolvedValueOnce({ removeFromPlanMember: jest.fn().mockResolvedValue(true), label: 'Role 1' })
        .mockResolvedValueOnce({ removeFromPlanMember: jest.fn().mockResolvedValue(true), label: 'Role 3' })
        .mockResolvedValueOnce({ addToPlanMember: jest.fn().mockResolvedValue(true), label: 'Role 4' });

      const result = await updateMemberRoles(reference, context, memberId, currentRoleIds, newRoleIds);

      expect(result.updatedRoleIds).toEqual([2, 4]);
      expect(result.errors).toEqual([]);
      expect(MemberRole.findById).toHaveBeenCalledTimes(3);
    });

    it('should return errors if roles cannot be removed', async () => {
      const reference = 'test-reference';
      const memberId = 1;
      const currentRoleIds = [1, 2];
      const newRoleIds = [2];

      MemberRole.reconcileAssociationIds = jest.fn().mockReturnValue({
        idsToBeRemoved: [1],
        idsToBeSaved: [],
      });

      MemberRole.findById = jest.fn()
        .mockResolvedValueOnce({ removeFromPlanMember: jest.fn().mockResolvedValue(false), label: 'Role 1' });

      const result = await updateMemberRoles(reference, context, memberId, currentRoleIds, newRoleIds);

      expect(result.updatedRoleIds).toEqual([2]);
      expect(result.errors).toEqual(['unable to remove roles: Role 1']);
      expect(MemberRole.findById).toHaveBeenCalledTimes(1);
    });

    it('should return errors if roles cannot be added', async () => {
      const reference = 'test-reference';
      const memberId = 1;
      const currentRoleIds = [1];
      const newRoleIds = [1, 2];

      MemberRole.reconcileAssociationIds = jest.fn().mockReturnValue({
        idsToBeRemoved: [],
        idsToBeSaved: [2],
      });

      MemberRole.findById = jest.fn()
        .mockResolvedValueOnce({ addToPlanMember: jest.fn().mockResolvedValue(false), label: 'Role 2' });

      const result = await updateMemberRoles(reference, context, memberId, currentRoleIds, newRoleIds);

      expect(result.updatedRoleIds).toEqual([1]);
      expect(result.errors).toEqual(['unable to assign roles: Role 2']);
      expect(MemberRole.findById).toHaveBeenCalledTimes(1);
    });

    it('should handle both add and remove errors', async () => {
      const reference = 'test-reference';
      const memberId = 1;
      const currentRoleIds = [1, 2];
      const newRoleIds = [3];

      MemberRole.reconcileAssociationIds = jest.fn().mockReturnValue({
        idsToBeRemoved: [1, 2],
        idsToBeSaved: [3],
      });

      MemberRole.findById = jest.fn()
        .mockResolvedValueOnce({ removeFromPlanMember: jest.fn().mockResolvedValue(false), label: 'Role 1' })
        .mockResolvedValueOnce({ removeFromPlanMember: jest.fn().mockResolvedValue(false), label: 'Role 2' })
        .mockResolvedValueOnce({ addToPlanMember: jest.fn().mockResolvedValue(false), label: 'Role 3' });

      const result = await updateMemberRoles(reference, context, memberId, currentRoleIds, newRoleIds);

      expect(result.updatedRoleIds).toEqual([1, 2]);
      expect(result.errors).toEqual([
        'unable to remove roles: Role 1, Role 2',
        'unable to assign roles: Role 3',
      ]);
      expect(MemberRole.findById).toHaveBeenCalledTimes(3);
    });
  });
});

describe('ensureDefaultPlanContact', () => {
  let context: MyContext;
  let project: Project;
  let plan: Plan;
  let defaultMember: ProjectMember;
  let defaultRole: MemberRole;

  let originalFindPrimaryContact: typeof ProjectMember.findPrimaryContact;
  let originalDefaultRole: typeof MemberRole.defaultRole;
  let originalFindByProjectMemberId: typeof MemberRole.findByProjectMemberId;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = await buildMockContextWithToken(logger)

    originalFindPrimaryContact = ProjectMember.findPrimaryContact;
    originalDefaultRole = MemberRole.defaultRole;
    originalFindByProjectMemberId = MemberRole.findByProjectMemberId;

    defaultRole = new MemberRole({
      id: casual.integer(1, 999),
      label: 'Test',
    });
    jest.spyOn(MemberRole, 'defaultRole').mockResolvedValue(defaultRole);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([defaultRole]);

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence
    });
    plan = new Plan({
      id: casual.integer(1, 999),
      projectId: project.id,
      affiliationId: casual.url,
    });
    defaultMember = new ProjectMember({
      id: casual.integer(1, 999),
      projectId: project.id,
      email: casual.email,
      givenName: casual.first_name,
      surName: casual.last_name,
      memberRoles: [defaultRole],
      memberRoleIds: [defaultRole.id],
    });

    jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(defaultMember);
  });

  afterEach(() => {
    ProjectMember.findPrimaryContact = originalFindPrimaryContact;
    MemberRole.defaultRole = originalDefaultRole;
    MemberRole.findByProjectMemberId = originalFindByProjectMemberId;
  })

  it('sets default primary contact', async () => {
    const originalFindPrimaryContact = PlanMember.findPrimaryContact;
    const originalInsert = PlanMember.insert;
    const originalFindByPlanAndProjectMember = PlanMember.findByPlanAndProjectMember;
    const originalFindById = PlanMember.findById;

    const newId = casual.integer(1, 9999);
    const newMember = new PlanMember({
      email: casual.email,
      planId: plan.id,
      projectMemberId: defaultMember.id,
      isPrimaryContact: true,
      memberRoleIds: defaultMember.memberRoles.map(mr => mr.id),
    });
    jest.spyOn(PlanMember, 'findPrimaryContact').mockResolvedValue(null);
    jest.spyOn(PlanMember, 'insert').mockResolvedValue(newId);
    jest.spyOn(PlanMember, 'findByPlanAndProjectMember').mockResolvedValue(null);
    jest.spyOn(PlanMember, 'findById').mockResolvedValue(newMember);

    expect(await ensureDefaultPlanContact(context, plan, project)).toBe(true);
    expect(PlanMember.insert).toHaveBeenCalledWith(
      context,
      'planMembers',
      newMember,
      'PlanMember.create',
      ['memberRoleIds']
    );
    PlanMember.findPrimaryContact = originalFindPrimaryContact;
    PlanMember.findByPlanAndProjectMember = originalFindByPlanAndProjectMember;
    PlanMember.findById = originalFindById;
    PlanMember.insert = originalInsert;
  });

  it('returns false if the plan or project are missing', async () => {
    expect(await ensureDefaultPlanContact(context, null, project)).toBe(false);
    expect(await ensureDefaultPlanContact(context, plan, null)).toBe(false);
  });

  it('returns false if there was a problem creating the PlanMember', async () => {
    const originalFindPrimaryContact = PlanMember.findPrimaryContact;
    jest.spyOn(PlanMember, 'findPrimaryContact').mockImplementation(() => {
      throw new Error('test error');
    });

    await expect(ensureDefaultPlanContact(context, plan, project)).rejects.toThrow('test error');
    PlanMember.findPrimaryContact = originalFindPrimaryContact;
  });

  it('returns true if the plan already has a primary contact', async () => {
    const originalFindPrimaryContact = PlanMember.findPrimaryContact;
    const current = new PlanMember({
      planId: plan.id,
      email: casual.email,
    });
    jest.spyOn(PlanMember, 'findPrimaryContact').mockResolvedValue(current);

    expect(await ensureDefaultPlanContact(context, plan, project)).toBe(true);
    PlanMember.findPrimaryContact = originalFindPrimaryContact;
  });
});

describe('saveMaDMPVersion', () => {
  let context: MyContext;
  const reference = 'test-reference';
  const planId = 123;
  const dmpId = "https://doi.org/11.2222/3A4B5c";
  const mockExists = DMPExists as jest.MockedFunction<typeof DMPExists>;
  const mockPlanToMaDMP = planToDMPCommonStandard as jest.MockedFunction<typeof planToDMPCommonStandard>;
  const mockCreate = createDMP as jest.MockedFunction<typeof createDMP>;
  const mockUpdate = updateDMP as jest.MockedFunction<typeof updateDMP>;
  const mockDelete = deleteDMP as jest.MockedFunction<typeof deleteDMP>;
  const mockTombstone = tombstoneDMP as jest.MockedFunction<typeof tombstoneDMP>;

  const mockMaDMP: DMPToolDMPType = {
    dmp: {
      contact: {
        contact_id: [{
          identifier: "http://example.com/contacts/123",
          type: "url"
        }],
        mbox: "tester@example.com",
        name: "Test Contact"
      },
      created: "2021-01-01 03:11:23Z",
      dataset: [{
        title: "Test Dataset",
        dataset_id: {
          identifier: "http://example.com/datasets/123",
          type: "other"
        },
        personal_data: "unknown",
        sensitive_data: "no"
      }],
      dmp_id: {
        identifier: "http://example.com/dmps/123",
        type: "other"
      },
      ethical_issues_exist: "unknown",
      language: "eng",
      modified: "2021-01-01 02:23:11Z",
      provenance: "test-system",
      title: "Test DMP"
    }
  }

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call createDMP when shouldDelete is false and a latest maDMP version does NOT exist', async () => {
    mockExists.mockResolvedValue(false);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockCreate.mockResolvedValue(mockMaDMP);

    const dmpId: string = mockMaDMP.dmp.dmp_id.identifier;
    const result = await saveMaDMPVersion(reference, context, planId, dmpId, false);

    expect(result).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(getDynamoConnectionParams(context.logger), generalConfig.domain, dmpId, mockMaDMP);
  });

  it('should call updateDMP when shouldDelete is false and a latest maDMP version exists', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockUpdate.mockResolvedValue(mockMaDMP);

    const dmpId: string = mockMaDMP.dmp.dmp_id.identifier;
    const result = await saveMaDMPVersion(reference, context, planId, dmpId, false);

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(getDynamoConnectionParams(context.logger), generalConfig.domain, dmpId, mockMaDMP, 3600000);
  });

  it('should call deleteDMP when shouldDelete is true and plan is not registered', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockDelete.mockResolvedValue(mockMaDMP);

    const dmpId: string = mockMaDMP.dmp.dmp_id.identifier;
    const result = await saveMaDMPVersion(reference, context, planId, dmpId, true);

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(getDynamoConnectionParams(context.logger), generalConfig.domain, dmpId);
  });

  it('should call tombstoneDMP when shouldDelete is true and plan is registered', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue({ dmp: { ...mockMaDMP['dmp'], registered: '2026-01-01T13:12:11Z' } });
    mockTombstone.mockResolvedValue(mockMaDMP);

    const dmpId: string = mockMaDMP.dmp.dmp_id.identifier;
    const result = await saveMaDMPVersion(reference, context, planId, dmpId, true);

    expect(result).toBe(true);
    expect(mockTombstone).toHaveBeenCalledWith(getDynamoConnectionParams(context.logger), generalConfig.domain, dmpId);
  });


  it('should return false id planId is undefined', async () => {
    const result = await saveMaDMPVersion(reference, context, undefined, dmpId, true);

    expect(result).toBe(false);
  });

  it('should return false id plan could not be converted to maDMP JSON', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue(undefined);

    const result = await saveMaDMPVersion(reference, context, planId, dmpId, true);

    expect(result).toBe(false);
  });

  it('should return false id createDMP failed', async () => {
    mockExists.mockResolvedValue(false);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockCreate.mockResolvedValue(undefined);

    const result = await saveMaDMPVersion(reference, context, planId, dmpId, false);

    expect(result).toBe(false);
  });

  it('should return false id updateDMP failed', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockUpdate.mockResolvedValue(undefined);

    const result = await saveMaDMPVersion(reference, context, planId, dmpId, false);

    expect(result).toBe(false);
  });

  it('should return false id deleteDMP failed', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue(mockMaDMP);
    mockDelete.mockResolvedValue(undefined);

    const result = await saveMaDMPVersion(reference, context, planId, dmpId, true);

    expect(result).toBe(false);
  });

  it('should return false id tombstoneDMP failed', async () => {
    mockExists.mockResolvedValue(true);
    mockPlanToMaDMP.mockResolvedValue({ dmp: { ...mockMaDMP['dmp'], registered: '2026-01-01T13:12:11Z' } });
    mockTombstone.mockResolvedValue(undefined);

    const result = await saveMaDMPVersion(reference, context, planId, dmpId, true);

    expect(result).toBe(false);
  });
});


