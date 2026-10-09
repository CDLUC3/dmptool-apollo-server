/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../datasources/mysql.js', () => ({
  MySQLConnection: jest.fn().mockImplementation(() => ({
    pool: null, query: jest.fn(), withTransaction: jest.fn(),
  })),
}));

const utils = {
  createDMP: jest.fn(), deleteDMP: jest.fn(), DMPExists: jest.fn(),
  tombstoneDMP: jest.fn(), updateDMP: jest.fn(), getDMPVersions: jest.fn(),
  getDMPs: jest.fn(), planToDMPCommonStandard: jest.fn(),
  EnvironmentEnum: { TEST: 'TEST' },
  toErrorMessage: jest.fn((error) => String(error)),
  isNullOrUndefined: (value) => value === null || value === undefined,
};
jest.unstable_mockModule('@dmptool/utils', () => utils);

const index = { updateIndexItem: jest.fn(), removeIndexItem: jest.fn() };
jest.unstable_mockModule('../indexDMPService.js', () => index);
const projectService = { getProjectAndCheckAuthorization: jest.fn() };
jest.unstable_mockModule('../projectService.js', () => projectService);
const datacite = {
  planToDataCiteMetadata: jest.fn((input) => input),
  buildDataCiteXML: jest.fn(() => '<resource />'),
};
jest.unstable_mockModule('../dataciteXMLService.js', () => datacite);

const { Plan, PlanVisibility } = await import('../../models/Plan.js');
const { Project } = await import('../../models/Project.js');
const { MemberRole } = await import('../../models/MemberRole.js');
const { PlanMember, ProjectMember } = await import('../../models/Member.js');
const { Affiliation } = await import('../../models/Affiliation.js');
const { ProjectCollaborator } = await import('../../models/Collaborator.js');
const { User } = await import('../../models/User.js');
const { PlanFunding, ProjectFunding } = await import('../../models/Funding.js');
const { AlternateIdentifier } = await import('../../models/AlternateIdentifier.js');
const { AcceptedWork } = await import('../../models/RelatedWork.js');
const {
  getPlanOwnerAffiliation, getPlanAndCheckAuthorization, updateMemberRoles,
  ensureDefaultPlanContact, buildDataCiteXMLForPlan, handleAsyncUpdates,
  handleAsyncDeletes, saveMaDMPVersion, getPlanVersions, getPlanVersionSnapshot,
  mapDMPToolDMPToSnapshot, getPlanSectionsAndQuestions,
} = await import('../planService.js');

const context: any = {
  token: { affiliationId: 'https://ror.org/current' },
  logger: { debug: jest.fn(), error: jest.fn(), fatal: jest.fn() },
};
const plan = new Plan({
  id: 10, projectId: 20, dmpId: 'https://doi.org/10.1/demo',
  title: 'Plan', languageId: 'en', createdById: 4,
});
const project = new Project({ id: 20, title: 'Project', abstractText: 'Abstract' });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(ProjectCollaborator, 'findOwnerByProjectId').mockResolvedValue(null);
  jest.spyOn(User, 'findById').mockResolvedValue(null);
  jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(null);
  jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(null);
  jest.spyOn(PlanMember, 'findPrimaryContact').mockResolvedValue(null);
  jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([]);
  jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([]);
  jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(AcceptedWork, 'findByPlanId').mockResolvedValue([]);
  utils.DMPExists.mockResolvedValue(false as never);
  utils.planToDMPCommonStandard.mockResolvedValue({ dmp: {} } as never);
  utils.createDMP.mockResolvedValue(true as never);
  utils.updateDMP.mockResolvedValue(true as never);
  utils.getDMPVersions.mockResolvedValue([] as never);
  utils.getDMPs.mockResolvedValue([] as never);
});

describe('planService', () => {
  it('uses a project owner affiliation before falling back to the plan creator', async () => {
    const affiliation = { id: 1, uri: 'https://ror.org/owner' } as any;
    jest.spyOn(ProjectCollaborator, 'findOwnerByProjectId').mockResolvedValue({ userId: 2 } as any);
    jest.spyOn(User, 'findById').mockResolvedValue({ affiliationId: affiliation.uri } as any);
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(affiliation);
    await expect(getPlanOwnerAffiliation('ref', context, plan)).resolves.toBe(affiliation);

    jest.spyOn(ProjectCollaborator, 'findOwnerByProjectId').mockResolvedValue(null);
    await expect(getPlanOwnerAffiliation('ref', context, plan)).resolves.toBe(affiliation);
  });

  it('loads and authorizes a plan and rejects an unknown plan', async () => {
    jest.spyOn(Plan, 'findById').mockResolvedValue(plan);
    projectService.getProjectAndCheckAuthorization.mockResolvedValue(project as never);
    await expect(getPlanAndCheckAuthorization('ref', context, plan.id)).resolves.toEqual({ plan, project });
    jest.spyOn(Plan, 'findById').mockResolvedValue(null);
    await expect(getPlanAndCheckAuthorization('ref', context, 999)).rejects.toThrow('not found');
  });

  it('reconciles member roles and reports unsuccessful changes', async () => {
    jest.spyOn(MemberRole, 'reconcileAssociationIds').mockReturnValue({ idsToBeRemoved: [1], idsToBeSaved: [2] });
    const removed = { label: 'old', removeFromPlanMember: jest.fn().mockResolvedValue(false as never) };
    const added = { label: 'new', addToPlanMember: jest.fn().mockResolvedValue(false as never) };
    jest.spyOn(MemberRole, 'findById').mockResolvedValueOnce(removed as any).mockResolvedValueOnce(added as any);
    await expect(updateMemberRoles('ref', context, 9, [1], [2])).resolves.toEqual({
      updatedRoleIds: [1], errors: ['unable to remove roles: old', 'unable to assign roles: new'],
    });
  });

  it('creates a default plan contact from the project contact', async () => {
    const member = { id: 3 };
    const role = { id: 4, addToPlanMember: jest.fn() };
    jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(member as any);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([role] as any);
    jest.spyOn(PlanMember.prototype, 'create').mockImplementation(async function () {
      this.id = 5; return this;
    });
    await expect(ensureDefaultPlanContact(context, plan, project)).resolves.toBe(true);
    expect(role.addToPlanMember).toHaveBeenCalledWith(context, 5);
  });

  it('builds DataCite metadata, including member affiliations and funding', async () => {
    jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([{ id: 1, affiliationId: 'ror', isPrimaryContact: true }] as any);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([{ uri: 'role' }] as any);
    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([{ projectFundingId: 2 }] as any);
    jest.spyOn(ProjectFunding, 'findById').mockResolvedValue({ affiliationId: 'ror', grantId: 'grant' } as any);
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue({ name: 'Org', uri: 'ror' } as any);
    jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([{ alternateIdentifier: 'id' }] as any);
    await expect(buildDataCiteXMLForPlan(context, plan, project)).resolves.toBe('<resource />');
  });

  it('starts asynchronous updates and deletions without awaiting their work', async () => {
    index.updateIndexItem.mockResolvedValue(undefined as never);
    index.removeIndexItem.mockResolvedValue(undefined as never);
    await handleAsyncUpdates('ref', context, plan, project);
    await handleAsyncDeletes('ref', context, plan);
    expect(index.updateIndexItem).toHaveBeenCalled();
    expect(index.removeIndexItem).toHaveBeenCalled();
  });

  it('creates, updates, and rejects invalid maDMP versions', async () => {
    await expect(saveMaDMPVersion('ref', context, 10, plan.dmpId)).resolves.toBe(true);
    utils.DMPExists.mockResolvedValue(true as never);
    await expect(saveMaDMPVersion('ref', context, 10, plan.dmpId)).resolves.toBe(true);
    await expect(saveMaDMPVersion('ref', context, undefined as any, plan.dmpId)).resolves.toBe(false);
  });

  it('returns historical versions and handles Dynamo failures', async () => {
    utils.getDMPVersions.mockResolvedValue([{ dmpId: plan.dmpId, modified: 'old' }, { dmpId: plan.dmpId, modified: 'latest' }] as never);
    utils.getDMPs.mockResolvedValue([{ dmp: { modified: 'latest' } }] as never);
    await expect(getPlanVersions('ref', context, plan.dmpId)).resolves.toEqual([expect.objectContaining({ modified: 'old' })]);
    utils.getDMPVersions.mockRejectedValue(new Error('Dynamo unavailable') as never);
    await expect(getPlanVersions('ref', context, plan.dmpId)).resolves.toEqual([]);
  });

  it('maps version snapshots and returns null for absent snapshots', async () => {
    const snapshot: any = {
      dmp: { title: 'Old', dmp_id: { identifier: plan.dmpId }, privacy: 'public',
        contact: { name: 'Jane Doe' },
        contributor: [{ name: 'Jane Doe', contact_mbox: 'jane@example.org',
          contributor_id: [{ type: 'orcid', identifier: '0000-0000-0000-0000' }],
          affiliation: [{ name: 'Owner', affiliation_id: { identifier: 'ror' } }],
          role: ['role'] }],
        narrative: { template: { id: 1, title: 'T', version: 1, section: [{
          question: [{ text: 'Question', answer: { id: 8, json: { value: 'answer' } } }],
        }] } },
        project: [{ title: 'P', funding: [{ name: 'Funder', funder_id: { identifier: 'funder' },
          funding_status: 'granted', grant_id: { identifier: 'grant' } }] }],
        funding_opportunity: [{ funder_id: { identifier: 'funder' },
          opportunity_identifier: { identifier: 'opportunity' } }],
        funding_project: [{ funder_id: { identifier: 'funder' },
          project_identifier: { identifier: 'project' } }],
        version: [{ version: 'historic', access_url: 'url' }],
        related_identifier: [{ identifier: 'doi' }] },
    };
    jest.spyOn(MemberRole, 'all').mockResolvedValue([{ id: 1, label: 'Role', uri: 'role' }] as any);
    jest.spyOn(ProjectMember, 'findByProjectAndEmail').mockResolvedValue({ isPrimaryContact: true } as any);
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue({ id: 2, name: 'Owner', uri: 'ror' } as any);
    jest.spyOn(AcceptedWork, 'findByPlanId').mockResolvedValue([{ id: 3, title: 'Work', work: { doi: 'doi' } }] as any);
    utils.getDMPs.mockResolvedValue([snapshot] as never);
    jest.spyOn(Plan, 'findByDMPId').mockResolvedValue(plan);
    await expect(getPlanVersionSnapshot('ref', context, plan.dmpId, 'version')).resolves.toEqual(expect.objectContaining({ title: 'Old', visibility: PlanVisibility.PUBLIC }));
    utils.getDMPs.mockResolvedValue([] as never);
    await expect(getPlanVersionSnapshot('ref', context, plan.dmpId, 'version')).resolves.toBeNull();
    await expect(mapDMPToolDMPToSnapshot(snapshot, 'latest', context, plan.id, project.id)).resolves.toEqual(expect.objectContaining({ title: 'Old' }));
  });

  it('returns no sections for plans without an id', async () => {
    const plan = new Plan({});
    await expect(getPlanSectionsAndQuestions('ref', context, plan)).resolves.toEqual([]);
  });
});
