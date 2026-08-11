import { MyContext } from '../../context';
import {
  buildMockContextWithToken,
} from '../../__mocks__/context';
import {
  ensureDefaultPlanContact,
  updateMemberRoles,
  saveMaDMPVersion,
  getPlanVersions,
  extractPlanOutputs,
} from '../planService';
import { MemberRole } from '../../models/MemberRole';
import { logger } from '../../logger';
import { PlanMember, ProjectMember } from "../../models/Member";
import casual from "casual";
import { Project } from "../../models/Project";
import { Plan } from "../../models/Plan";
import { Answer } from "../../models/Answer";

// For buildDataCiteXMLForPlan
import { buildDataCiteXMLForPlan } from '../planService';
import { Affiliation } from '../../models/Affiliation';
import { PlanFunding, ProjectFunding } from '../../models/Funding';
import { AlternateIdentifier } from '../../models/AlternateIdentifier';
import * as dataciteXMLService from '../dataciteXMLService';

import {
  createDMP,
  deleteDMP, DMPExists, planToDMPCommonStandard,
  tombstoneDMP,
  updateDMP,
  getDMPVersions
} from '@dmptool/utils';
import { getDynamoConnectionParams } from '../../config/awsConfig';
import { generalConfig } from '../../config/generalConfig';
import { DMPToolDMPType } from "@dmptool/types";

jest.mock('@dmptool/utils');

jest.mock('../dataciteXMLService', () => ({
  planToDataCiteMetadata: jest.fn(),
  buildDataCiteXML: jest.fn(),
}));

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

describe('buildDataCiteXMLForPlan', () => {
  let context: MyContext;
  let plan: Plan;
  let project: Project;

  const mockPlanToDataCiteMetadata = dataciteXMLService.planToDataCiteMetadata as jest.Mock;
  const mockBuildDataCiteXML = dataciteXMLService.buildDataCiteXML as jest.Mock;

  let originalProjectFindById: typeof Project.findById;
  let originalFindByProjectId: typeof ProjectMember.findByProjectId;
  let originalFindByProjectMemberId: typeof MemberRole.findByProjectMemberId;
  let originalFindByURI: typeof Affiliation.findByURI;
  let originalPlanFundingFindByPlanId: typeof PlanFunding.findByPlanId;
  let originalProjectFundingFindById: typeof ProjectFunding.findById;
  let originalAltIdFindByPlanId: typeof AlternateIdentifier.findByPlanId;

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);

    project = new Project({
      id: casual.integer(1, 999),
      title: casual.sentence,
      abstractText: casual.text,
    });
    plan = new Plan({
      id: casual.integer(1, 999),
      projectId: project.id,
      title: casual.sentence,
      languageId: 'en-US',
    });

    originalProjectFindById = Project.findById;
    originalFindByProjectId = ProjectMember.findByProjectId;
    originalFindByProjectMemberId = MemberRole.findByProjectMemberId;
    originalFindByURI = Affiliation.findByURI;
    originalPlanFundingFindByPlanId = PlanFunding.findByPlanId;
    originalProjectFundingFindById = ProjectFunding.findById;
    originalAltIdFindByPlanId = AlternateIdentifier.findByPlanId;

    jest.spyOn(Project, 'findById').mockResolvedValue(project);
    jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([]);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([]);
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(null);
    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findById').mockResolvedValue(null);
    jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);

    mockPlanToDataCiteMetadata.mockReturnValue({ title: plan.title, creators: [{ familyName: 'Test' }] });
    mockBuildDataCiteXML.mockReturnValue('<resource>mock-xml</resource>');
  });

  afterEach(() => {
    Project.findById = originalProjectFindById;
    ProjectMember.findByProjectId = originalFindByProjectId;
    MemberRole.findByProjectMemberId = originalFindByProjectMemberId;
    Affiliation.findByURI = originalFindByURI;
    PlanFunding.findByPlanId = originalPlanFundingFindByPlanId;
    ProjectFunding.findById = originalProjectFundingFindById;
    AlternateIdentifier.findByPlanId = originalAltIdFindByPlanId;
  });

  it('returns the XML string produced by buildDataCiteXML', async () => {
    const result = await buildDataCiteXMLForPlan(context, plan, project);
    expect(result).toBe('<resource>mock-xml</resource>');
  });

  it('uses the provided project instead of fetching it', async () => {
    await buildDataCiteXMLForPlan(context, plan, project);
    expect(Project.findById).not.toHaveBeenCalled();
  });

  it('fetches the project when none is provided', async () => {
    await buildDataCiteXMLForPlan(context, plan);
    expect(Project.findById).toHaveBeenCalledWith(
      'planService.buildDataCiteXMLForPlan',
      context,
      plan.projectId
    );
  });

  it('passes the plan\'s languageId through to planToDataCiteMetadata', async () => {
    await buildDataCiteXMLForPlan(context, plan, project);
    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en-US' })
    );
  });

  it('maps a primary-contact member with a ROR affiliation correctly', async () => {
    const memberRole = new MemberRole({ id: casual.integer(1, 999), uri: 'credit.niso.org/contributor-roles/supervision' });
    const projectMember = new ProjectMember({
      id: casual.integer(1, 999),
      projectId: project.id,
      isPrimaryContact: true,
      givenName: 'Ada',
      surName: 'Lovelace',
      orcid: '0000-0001-5727-2427',
      affiliationId: 'https://ror.org/03efmqc40',
    });

    (ProjectMember.findByProjectId as jest.Mock).mockResolvedValue([projectMember]);
    (MemberRole.findByProjectMemberId as jest.Mock).mockResolvedValue([memberRole]);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue({
      name: 'Arizona State University',
      uri: 'https://ror.org/03efmqc40',
      provenance: 'ROR',
    });

    await buildDataCiteXMLForPlan(context, plan, project);

    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [
          expect.objectContaining({
            isPrimaryContact: true,
            memberRoles: [{ uri: memberRole.uri }],
            projectMember: expect.objectContaining({
              givenName: 'Ada',
              surName: 'Lovelace',
              orcid: '0000-0001-5727-2427',
              affiliation: expect.objectContaining({
                name: 'Arizona State University',
                provenance: 'ROR',
              }),
            }),
          }),
        ],
      })
    );
  });

  it('omits affiliation when the member has no affiliationId', async () => {
    const projectMember = new ProjectMember({
      id: casual.integer(1, 999),
      projectId: project.id,
      isPrimaryContact: false,
      givenName: 'No',
      surName: 'Affiliation',
      affiliationId: null,
    });
    (ProjectMember.findByProjectId as jest.Mock).mockResolvedValue([projectMember]);

    await buildDataCiteXMLForPlan(context, plan, project);

    expect(Affiliation.findByURI).not.toHaveBeenCalled();
    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [
          expect.objectContaining({
            projectMember: expect.objectContaining({ affiliation: undefined }),
          }),
        ],
      })
    );
  });

  it('maps a funding reference resolved via ProjectFunding + Affiliation', async () => {
    const planFunding = new PlanFunding({
      id: casual.integer(1, 999),
      planId: plan.id,
      projectFundingId: casual.integer(1, 999),
    });
    const projectFunding = new ProjectFunding({
      id: planFunding.projectFundingId,
      affiliationId: 'https://ror.org/021nxhr62',
      grantId: 'AWD-12345',
    });

    (PlanFunding.findByPlanId as jest.Mock).mockResolvedValue([planFunding]);
    (ProjectFunding.findById as jest.Mock).mockResolvedValue(projectFunding);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue({
      name: 'National Science Foundation',
      uri: 'https://ror.org/021nxhr62',
      provenance: 'ROR',
      fundrefId: '100000001',
    });

    await buildDataCiteXMLForPlan(context, plan, project);

    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        fundings: [
          {
            projectFunding: {
              affiliation: expect.objectContaining({
                name: 'National Science Foundation',
                fundrefId: '100000001',
              }),
              grantId: 'AWD-12345',
            },
          },
        ],
      })
    );
  });

  it('returns { projectFunding: undefined } when the linked ProjectFunding row is missing', async () => {
    const planFunding = new PlanFunding({
      id: casual.integer(1, 999),
      planId: plan.id,
      projectFundingId: casual.integer(1, 999),
    });
    (PlanFunding.findByPlanId as jest.Mock).mockResolvedValue([planFunding]);
    (ProjectFunding.findById as jest.Mock).mockResolvedValue(null);

    await buildDataCiteXMLForPlan(context, plan, project);

    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        fundings: [{ projectFunding: undefined }],
      })
    );
  });

  it('maps alternate identifier records to the shape planToDataCiteMetadata expects', async () => {
    (AlternateIdentifier.findByPlanId as jest.Mock).mockResolvedValue([
      { alternateIdentifier: '10.1234/abcd' },
      { alternateIdentifier: 'legacy-id-9999' },
    ]);

    await buildDataCiteXMLForPlan(context, plan, project);

    expect(mockPlanToDataCiteMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        alternateIdentifiers: [
          { alternateIdentifier: '10.1234/abcd' },
          { alternateIdentifier: 'legacy-id-9999' },
        ],
      })
    );
  });

  it('propagates errors thrown by planToDataCiteMetadata (e.g. no primary contact)', async () => {
    mockPlanToDataCiteMetadata.mockImplementation(() => {
      throw new Error('Project has no member marked as primary contact; cannot determine a DataCite creator');
    });

    await expect(buildDataCiteXMLForPlan(context, plan, project)).rejects.toThrow(
      'Project has no member marked as primary contact'
    );
  });

  it('propagates errors thrown by a model call (e.g. DB failure)', async () => {
    (ProjectMember.findByProjectId as jest.Mock).mockRejectedValue(new Error('db error'));

    await expect(buildDataCiteXMLForPlan(context, plan, project)).rejects.toThrow('db error');
  });
});

describe('getPlanVersions', () => {
  let context: MyContext;
  const reference = 'test-reference';
  const dmpId = 'https://doi.org/11.2222/3A4B5c';
  const mockGetDMPVersions = getDMPVersions as jest.MockedFunction<typeof getDMPVersions>;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return an empty array when dmpId is null or undefined', async () => {
    expect(await getPlanVersions(reference, context, null)).toEqual([]);
    expect(await getPlanVersions(reference, context, undefined)).toEqual([]);
    expect(mockGetDMPVersions).not.toHaveBeenCalled();
  });

  it('should return an empty array when no versions are found', async () => {
    mockGetDMPVersions.mockResolvedValue([]);

    const result = await getPlanVersions(reference, context, dmpId);

    expect(result).toEqual([]);
    expect(mockGetDMPVersions).toHaveBeenCalledWith(getDynamoConnectionParams(context.logger), dmpId);
  });

  it('should map each version to a timestamp and public-facing URL', async () => {
    mockGetDMPVersions.mockResolvedValue([
      { dmpId, modified: '2026-08-01T14:32:00Z' },
      { dmpId, modified: '2026-06-15T09:10:00Z' },
    ]);

    const result = await getPlanVersions(reference, context, dmpId);

    expect(result).toEqual([
      {
        timestamp: '2026-08-01T14:32:00Z',
        url: `https://${generalConfig.domain}/dmps/${dmpId.replace('https://', '')}?version=${encodeURIComponent('2026-08-01T14:32:00Z')}`,
      },
      {
        timestamp: '2026-06-15T09:10:00Z',
        url: `https://${generalConfig.domain}/dmps/${dmpId.replace('https://', '')}?version=${encodeURIComponent('2026-06-15T09:10:00Z')}`,
      },
    ]);
  });

  it('should return an empty array and logs an error if getDMPVersions throws', async () => {
    mockGetDMPVersions.mockRejectedValue(new Error('dynamo error'));

    const result = await getPlanVersions(reference, context, dmpId);

    expect(result).toEqual([]);
  });
});

describe('extractPlanOutputs', () => {
  const buildAnswer = (json: unknown): Answer => ({ json } as unknown as Answer);

  it('should return an empty array when there are no answers', () => {
    expect(extractPlanOutputs([])).toEqual([]);
  });

  it('should skip answers that are not valid JSON', () => {
    const answers = [buildAnswer('{not valid json')];
    expect(extractPlanOutputs(answers)).toEqual([]);
  });

  it('should skip answers whose type is not researchOutputTable', () => {
    const answers = [buildAnswer({ type: 'someOtherType', answer: [] })];
    expect(extractPlanOutputs(answers)).toEqual([]);
  });

  it('should skip answers whose "answer" field is not an array', () => {
    const answers = [buildAnswer({ type: 'researchOutputTable', answer: 'not-an-array' })];
    expect(extractPlanOutputs(answers)).toEqual([]);
  });

  it('should extract a fully-populated output row, including byteSize and byteSizeUnit', () => {
    const answers = [
      buildAnswer({
        type: 'researchOutputTable',
        answer: [
          {
            columns: [
              { commonStandardId: 'title', answer: 'RO Question 1' },
              { commonStandardId: 'description', answer: '<p>RO Question 1 description</p>' },
              { commonStandardId: 'type', answer: 'dataset' },
              { commonStandardId: 'issued', answer: '2026-09-30' },
              { commonStandardId: 'byte_size', answer: { value: 2, context: 'mb' } },
              { commonStandardId: 'host', answer: [{ repositoryName: 'Zenodo', repositoryId: 'https://zenodo.org' }] },
              { commonStandardId: 'metadata', answer: [{ metadataStandardName: 'DDI', metadataStandardId: 'https://ddialliance.org' }] },
              { commonStandardId: 'license_ref', answer: [{ licenseName: 'CC0-1.0', licenseId: 'https://spdx.org/licenses/CC0-1.0.json' }] },
            ],
          },
        ],
      }),
    ];

    const result = extractPlanOutputs(answers);

    expect(result).toEqual([
      {
        title: 'RO Question 1',
        description: '<p>RO Question 1 description</p>',
        type: 'dataset',
        issued: '2026-09-30',
        byteSize: 2,
        byteSizeUnit: 'mb',
        hosts: [{ name: 'Zenodo', url: 'https://zenodo.org' }],
        metadataStandards: [{ name: 'DDI', uri: 'https://ddialliance.org' }],
        licenses: [{ name: 'CC0-1.0', uri: 'https://spdx.org/licenses/CC0-1.0.json' }],
      },
    ]);
  });

  it('should default missing hosts/metadataStandards/licenses to empty arrays', () => {
    const answers = [
      buildAnswer({
        type: 'researchOutputTable',
        answer: [
          {
            columns: [
              { commonStandardId: 'title', answer: 'RO Question 2' },
            ],
          },
        ],
      }),
    ];

    const result = extractPlanOutputs(answers);

    expect(result[0]).toEqual(
      expect.objectContaining({
        title: 'RO Question 2',
        hosts: [],
        metadataStandards: [],
        licenses: [],
      })
    );
    expect(result[0].byteSize).toBeUndefined();
    expect(result[0].byteSizeUnit).toBeUndefined();
  });

  it('should default title to an empty string when missing', () => {
    const answers = [
      buildAnswer({
        type: 'researchOutputTable',
        answer: [{ columns: [] }],
      }),
    ];

    const result = extractPlanOutputs(answers);

    expect(result[0].title).toBe('');
  });

  it('should handle answer.json provided as an already-parsed object (not a string)', () => {
    const answers: Answer[] = [
      {
        json: {
          type: 'researchOutputTable',
          answer: [
            { columns: [{ commonStandardId: 'title', answer: 'RO Question 3' }] },
          ],
        },
      } as unknown as Answer,
    ];

    const result = extractPlanOutputs(answers);

    expect(result[0].title).toBe('RO Question 3');
  });

  it('should extract outputs across multiple answers and multiple rows', () => {
    const answers = [
      buildAnswer({
        type: 'researchOutputTable',
        answer: [
          { columns: [{ commonStandardId: 'title', answer: 'Row A' }] },
          { columns: [{ commonStandardId: 'title', answer: 'Row B' }] },
        ],
      }),
      buildAnswer({
        type: 'researchOutputTable',
        answer: [
          { columns: [{ commonStandardId: 'title', answer: 'Row C' }] },
        ],
      }),
    ];

    const result = extractPlanOutputs(answers);

    expect(result.map((o) => o.title)).toEqual(['Row A', 'Row B', 'Row C']);
  });
});

