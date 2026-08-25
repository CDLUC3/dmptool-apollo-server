import { GraphQLError } from 'graphql';
import { logger } from '../../logger';
import { Project } from '../../models/Project';
import { Plan } from '../../models/Plan';
import { Affiliation } from '../../models/Affiliation';
import { MemberRole } from '../../models/MemberRole';
import { PlanMember, ProjectMember } from '../../models/Member';
import {
  PlanFunding,
  ProjectFunding,
} from '../../models/Funding';
import { AlternateIdentifier } from '../../models/AlternateIdentifier';
import { ResearchDomain } from '../../models/ResearchDomain';
import { VersionedTemplate } from '../../models/VersionedTemplate';
import { buildMockContextWithToken } from '../../__mocks__/context';
import {
  BAD_REQUEST_ERROR_CODE,
  INTERNAL_SERVER_ERROR_CODE,
} from '../../utils/graphQLErrors';
import {
  addEntirePlan,
  processFundingAssociations,
  processMemberAssociations,
  removeEntirePlan,
  replaceEntirePlan,
} from '../entirePlanService';
import {
  ensureDefaultProjectContact,
  setCurrentUserAsProjectOwner,
} from '../projectService';
import { ensureDefaultPlanContact } from '../planService';

jest.mock('../projectService', () => ({
  ensureDefaultProjectContact: jest.fn().mockResolvedValue(true),
  setCurrentUserAsProjectOwner: jest.fn().mockResolvedValue(true),
}));

jest.mock('../planService', () => ({
  ensureDefaultPlanContact: jest.fn().mockResolvedValue(true),
  updateMemberRoles: jest.fn().mockResolvedValue({ updatedRoleIds: [], errors: [] }),
}));


jest.mock('../openSearchService', () => ({
  openSearchFindWorkByIdentifier: jest.fn().mockResolvedValue([]),
}));

describe('entirePlanService', () => {
  let context;
  let project: Project;
  let plan: Plan;

  const makeRole = (id: number, label = `Role ${id}`) => {
    return {
      id,
      label,
      addToProjectMember: jest.fn().mockResolvedValue(true),
      addToPlanMember: jest.fn().mockResolvedValue(true),
      removeFromProjectMember: jest.fn().mockResolvedValue(true),
    } as unknown as MemberRole;
  };

  const setupAssociationDefaults = () => {
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue({
      uri: 'https://ror.example.org/abc',
    } as Affiliation);

    jest.spyOn(PlanMember, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(ProjectMember, 'findById').mockResolvedValue(null);
    jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([]);
    jest
      .spyOn(ProjectMember, 'findByProjectAndNameOrORCIDOrEmail')
      .mockResolvedValue(null);
    jest.spyOn(PlanMember, 'findByProjectMemberId').mockResolvedValue([]);

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findById').mockResolvedValue(null);
    jest
      .spyOn(ProjectFunding, 'findByProjectAndAffiliation')
      .mockResolvedValue(null);
    jest.spyOn(PlanFunding, 'findByProjectFundingId').mockResolvedValue([]);

    const defaultRole = new MemberRole({
      id: 999,
      label: 'Default Role',
      url: 'http://example.com/role/default' }
    );
    jest.spyOn(MemberRole, 'defaultRole').mockResolvedValue(defaultRole);
    jest.spyOn(MemberRole, 'findByURL').mockResolvedValue(null);
    jest.spyOn(MemberRole, 'findByProjectMemberId').mockResolvedValue([]);
    jest.spyOn(MemberRole, 'findByPlanMemberId').mockResolvedValue([]);

    jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: [],
      idsToBeSaved: [],
    });

    jest
      .spyOn(ProjectMember.prototype, 'create')
      .mockImplementation(async function createProjectMember() {
        this.id = this.id ?? 11;
        return this;
      });
    jest
      .spyOn(ProjectMember.prototype, 'update')
      .mockImplementation(async function updateProjectMember() {
        return this;
      });
    jest
      .spyOn(ProjectMember.prototype, 'delete')
      .mockImplementation(async function deleteProjectMember() {
        return this;
      });
    jest
      .spyOn(PlanMember.prototype, 'create')
      .mockImplementation(async function createPlanMember() {
        this.id = this.id ?? 21;
        return this;
      });
    jest
      .spyOn(PlanMember.prototype, 'delete')
      .mockImplementation(async function deletePlanMember() {
        return this;
      });

    jest
      .spyOn(ProjectFunding.prototype, 'create')
      .mockImplementation(async function createProjectFunding() {
        this.id = this.id ?? 31;
        return this;
      });
    jest
      .spyOn(ProjectFunding.prototype, 'update')
      .mockImplementation(async function updateProjectFunding() {
        return this;
      });
    jest
      .spyOn(ProjectFunding.prototype, 'delete')
      .mockImplementation(async function deleteProjectFunding() {
        return this;
      });
    jest
      .spyOn(PlanFunding.prototype, 'create')
      .mockImplementation(async function createPlanFunding() {
        this.id = this.id ?? 41;
        return this;
      });
    jest
      .spyOn(PlanFunding.prototype, 'delete')
      .mockImplementation(async function deletePlanFunding() {
        return this;
      });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    context = await buildMockContextWithToken(logger);
    project = new Project({ id: 1001, title: 'Project', abstractText: 'A' });
    plan = new Plan({ id: 2002, projectId: project.id, title: 'Plan title' });
  });

  describe('processMemberAssociations', () => {
    it('adds new members and associated roles', async () => {
      setupAssociationDefaults();
      const roleOne = makeRole(1, 'One');
      const roleTwo = makeRole(2, 'Two');

      jest.spyOn(roleOne,'addToProjectMember').mockResolvedValue(true);
      jest.spyOn(roleOne,'addToPlanMember').mockResolvedValue(true);
      jest.spyOn(roleTwo,'addToProjectMember').mockResolvedValue(true);
      jest.spyOn(roleTwo,'addToPlanMember').mockResolvedValue(true);
      jest.spyOn(ProjectMember, 'findPrimaryContact').mockResolvedValue(null);
      jest
        .spyOn(MemberRole, 'findByURL')
        .mockResolvedValueOnce(roleOne)
        .mockResolvedValueOnce(roleTwo);

      const errors = await processMemberAssociations(
        'test-ref',
        context,
        project,
        plan,
        [{
          affiliation: 'https://ror.example.org/abc',
          givenName: 'Taylor',
          surname: 'Smith',
          orcid: '0000-0000-0000-0000',
          email: 'taylor@example.org',
          memberRoles: ['http://example.com/role/1', 'http://example.com/role/2'],
        }],
      );

      expect(errors).toBeUndefined();
      expect(ProjectMember.prototype.create).toHaveBeenCalledTimes(1);
      expect(PlanMember.prototype.create).toHaveBeenCalledTimes(1);
      expect(roleOne.addToProjectMember).toHaveBeenCalledTimes(1);
      expect(roleOne.addToPlanMember).toHaveBeenCalledTimes(1);
      expect(roleTwo.addToProjectMember).toHaveBeenCalledTimes(1);
      expect(roleTwo.addToPlanMember).toHaveBeenCalledTimes(1);
    });

    it('returns an error when deleting plan members fails', async () => {
      setupAssociationDefaults();
      const currentProjectMember = new ProjectMember({
        id: 777,
        projectId: project.id,
      });
      const currentPlanMember = new PlanMember({
        id: 888,
        planId: plan.id,
        projectMemberId: currentProjectMember.id,
        memberRoleIds: [1],
      });
      jest
        .spyOn(PlanMember, 'findByPlanId')
        .mockResolvedValue([currentPlanMember]);
      jest
        .spyOn(ProjectMember, 'findByProjectId')
        .mockResolvedValue([currentProjectMember]);
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [currentProjectMember.id],
        idsToBeSaved: [],
      });
      jest
        .spyOn(PlanMember.prototype, 'delete')
        .mockImplementation(async function failedDelete() {
          this.addError('general', 'Unable to delete');
          return this;
        });

      const errors = await processMemberAssociations(
        'test-ref',
        context,
        project,
        plan,
        [],
      );

      expect(errors).toContain('Unable to delete plan member');
      expect(ProjectMember.prototype.delete).toHaveBeenCalledTimes(0);
    });

    it('returns all update-related errors for non-shared members', async () => {
      setupAssociationDefaults();
      const legacyRole = makeRole(99, 'Legacy');
      legacyRole.removeFromProjectMember = jest.fn().mockResolvedValue(false);
      const newRole = makeRole(5, 'NewRole');
      newRole.addToProjectMember = jest.fn().mockResolvedValue(false);
      newRole.addToPlanMember = jest.fn().mockResolvedValue(false);

      const currentProjectMember = new ProjectMember({
        id: 321,
        projectId: project.id,
        affiliationId: 'https://ror.example.org/old',
        givenName: 'Old',
        surName: 'Member',
        email: 'old@example.org',
        memberRoles: [legacyRole],
      });
      const currentPlanMember = new PlanMember({
        id: 654,
        planId: plan.id,
        projectMemberId: currentProjectMember.id,
        memberRoleIds: [99],
      });

      jest
        .spyOn(PlanMember, 'findByPlanId')
        .mockResolvedValue([currentPlanMember]);
      jest
        .spyOn(ProjectMember, 'findByProjectId')
        .mockResolvedValue([currentProjectMember]);
      jest
        .spyOn(ProjectMember, 'findById')
        .mockResolvedValue(currentProjectMember);
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [],
        idsToBeSaved: [currentProjectMember.id],
      });
      jest.spyOn(MemberRole, 'findByURL').mockResolvedValue(newRole);
      jest
        .spyOn(ProjectMember.prototype, 'update')
        .mockImplementation(async function failedUpdate() {
          this.addError('general', 'Unable to update');
          return this;
        });

      const errors = await processMemberAssociations(
        'test-ref',
        context,
        project,
        plan,
        [{
          projectMemberId: currentProjectMember.id,
          affiliation: 'https://ror.example.org/new',
          givenName: 'New',
          surname: 'Member',
          orcid: '0000-0000-0000-0000',
          email: 'new@example.org',
          memberRoles: ['http://example.com/role/5'],
        }],
      );

      const expectedErr = [
        'Unable to add role NewRole to project member Member New',
        'Unable to update project member Member New'
      ].join(', ');
      expect(errors).toEqual(expectedErr);
    });
  });

  describe('processFundingAssociations', () => {
    it('adds project and plan funding records', async () => {
      setupAssociationDefaults();

      const errors = await processFundingAssociations(
        'test-ref',
        context,
        project,
        plan,
        [{
          funder: 'https://ror.example.org/abc',
          status: 'GRANTED',
          funderOpportunityNumber: 'OPP-1',
          funderProjectNumber: 'PROJ-2',
          grantId: 'GRANT-3',
        }],
      );

      expect(errors).toBeUndefined();
      expect(ProjectFunding.prototype.create).toHaveBeenCalledTimes(1);
      expect(PlanFunding.prototype.create).toHaveBeenCalledTimes(1);
    });

    it('returns errors when removing funding fails', async () => {
      setupAssociationDefaults();
      const currentProjectFunding = new ProjectFunding({
        id: 444,
        projectId: project.id,
        affiliationId: 'https://ror.example.org/remove',
      });
      const currentPlanFunding = new PlanFunding({
        id: 555,
        planId: plan.id,
        projectFundingId: currentProjectFunding.id,
      });
      jest
        .spyOn(PlanFunding, 'findByPlanId')
        .mockResolvedValue([currentPlanFunding]);
      jest
        .spyOn(ProjectFunding, 'findByProjectId')
        .mockResolvedValue([currentProjectFunding]);
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [currentProjectFunding.id],
        idsToBeSaved: [],
      });
      jest
        .spyOn(PlanFunding.prototype, 'delete')
        .mockImplementation(async function failedPlanDelete() {
          this.addError('general', 'Unable to delete plan funding');
          return this;
        });
      jest
        .spyOn(ProjectFunding.prototype, 'delete')
        .mockImplementation(async function failedProjectDelete() {
          this.addError('general', 'Unable to delete project funding');
          return this;
        });

      const errors = await processFundingAssociations(
        'test-ref',
        context,
        project,
        plan,
        [],
      );

      expect(errors).toContain('Unable to delete plan funding');
      expect(errors).toContain('Unable to delete project funding');
    });

    it('returns an error when updating funding fails', async () => {
      setupAssociationDefaults();
      const currentProjectFunding = new ProjectFunding({
        id: 989,
        projectId: project.id,
        affiliationId: 'https://ror.example.org/current',
      });
      const currentPlanFunding = new PlanFunding({
        id: 990,
        planId: plan.id,
        projectFundingId: currentProjectFunding.id,
      });
      jest
        .spyOn(PlanFunding, 'findByPlanId')
        .mockResolvedValue([currentPlanFunding]);
      jest
        .spyOn(ProjectFunding, 'findByProjectId')
        .mockResolvedValue([currentProjectFunding]);
      jest
        .spyOn(ProjectFunding, 'findById')
        .mockResolvedValue(currentProjectFunding);
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [],
        idsToBeSaved: [currentProjectFunding.id],
      });
      jest
        .spyOn(ProjectFunding.prototype, 'update')
        .mockImplementation(async function failedUpdate() {
          this.addError('general', 'Unable to update funding');
          return this;
        });

      const errors = await processFundingAssociations(
        'test-ref',
        context,
        project,
        plan,
        [{
          projectFundingId: currentProjectFunding.id,
          funder: 'http://example.com/funder/1',
          status: 'PLANNED',
          funderOpportunityNumber: 'OPP-X',
          funderProjectNumber: 'PROJ-Y',
          grantId: 'GRANT-Z',
        }],
      );

      expect(errors).toEqual('Unable to update project funding for: http://example.com/funder/1');
    });
  });

  describe('addEntirePlan', () => {
    const baseInput = {
      title: 'My Entire Plan',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      languageId: 'en-US',
      versionedTemplateId: 99,
      project: {
        title: '  Existing Project  ',
        abstractText: '  project abstract  ',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        researchDomainUrl: 'https://ror.example.org/domain/202',
        isTestProject: true,
      },
    };

    const setupAddEntirePlanDefaults = () => {
      setupAssociationDefaults();

      const existingProject = new Project({
        id: 101,
        title: 'Existing Project',
        abstractText: 'existing',
      });
      jest.spyOn(Project, 'findByOwnerAndTitle').mockResolvedValue(existingProject);
      jest
        .spyOn(ResearchDomain, 'findByURI')
        .mockResolvedValue({ id: 202 } as ResearchDomain);
      jest
        .spyOn(Project.prototype, 'update')
        .mockImplementation(async function projectUpdate() {
          return this;
        });
      jest
        .spyOn(VersionedTemplate, 'findVersionedTemplateById')
        .mockResolvedValue(new VersionedTemplate({ id: 303, name: 'VT-1' }));
      jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
      jest
        .spyOn(Plan.prototype, 'create')
        .mockImplementation(async function planCreate() {
          this.id = 404;
          this.dmpId = 'doi.org/10.1234/example';
          return this;
        });

      return { existingProject };
    };

    it('creates a full plan', async () => {
      const { existingProject } = setupAddEntirePlanDefaults();

      const response = await addEntirePlan('test-ref', context, baseInput as never, plan);

      expect(response.id).toBe(404);
      expect(response.errors).toEqual({});
      expect(Project.findByOwnerAndTitle).toHaveBeenCalledWith(
        'test-ref',
        context,
        baseInput.project.title,
        context.token.id,
      );
      expect(ResearchDomain.findByURI).toHaveBeenCalledWith(
        'test-ref',
        context,
        baseInput.project.researchDomainUrl,
      );
      expect(existingProject.title).toBe('Existing Project');
      expect(existingProject.abstractText).toBe('project abstract');
      expect(existingProject.startDate).toBe(baseInput.project.startDate);
      expect(existingProject.endDate).toBe(baseInput.project.endDate);
      expect(existingProject.researchDomainId).toBe(202);
      expect(existingProject.isTestProject).toBe(true);
      expect(Project.prototype.update).toHaveBeenCalledTimes(1);
      expect(setCurrentUserAsProjectOwner).toHaveBeenCalledWith(
        context,
        existingProject.id,
      );
      expect(ensureDefaultProjectContact).toHaveBeenCalledWith(
        context,
        existingProject,
      );
      expect(ensureDefaultPlanContact).toHaveBeenCalledWith(
        context,
        response,
        existingProject,
      );
    });

    it('creates a full plan with the default template and a new project', async () => {
      setupAssociationDefaults();
      const researchDomainSpy = jest.spyOn(ResearchDomain, 'findByURI');
      jest.spyOn(Project, 'findByOwnerAndTitle').mockResolvedValue(null);
      jest
        .spyOn(Project.prototype, 'create')
        .mockImplementation(async function projectCreate() {
          this.id = 505;
          return this;
        });
      jest
        .spyOn(VersionedTemplate, 'defaultTemplate')
        .mockResolvedValue(new VersionedTemplate({ id: 606, name: 'Default VT' }));
      jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
      jest
        .spyOn(Plan.prototype, 'create')
        .mockImplementation(async function planCreate() {
          this.id = 707;
          this.dmpId = 'doi.org/10.1234/default';
          return this;
        });

      const response = await addEntirePlan('test-ref', context, {
        ...baseInput,
        versionedTemplateId: undefined,
        project: {
          title: '  New Project  ',
          abstractText: '  new abstract  ',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          researchDomainUrl: undefined,
          isTestProject: false,
        },
      } as never, plan);

      expect(VersionedTemplate.defaultTemplate).toHaveBeenCalledTimes(1);
      expect(Project.prototype.create).toHaveBeenCalledTimes(1);
      expect(response.id).toBe(707);
      expect(response.projectId).toBe(505);
      expect(researchDomainSpy).not.toHaveBeenCalled();
      expect(setCurrentUserAsProjectOwner).toHaveBeenCalledWith(context, 505);
      expect(ensureDefaultProjectContact).toHaveBeenCalledWith(
        context,
        expect.objectContaining({ id: 505, title: 'New Project' }),
      );
      expect(ensureDefaultPlanContact).toHaveBeenCalledWith(
        context,
        response,
        expect.objectContaining({ id: 505, title: 'New Project' }),
      );
    });

    it('throws a bad request error when the specified template cannot be found', async () => {
      jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockResolvedValue(null);

      await expect(addEntirePlan('test-ref', context, baseInput as never, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
        message: 'Unable to find the specified versioned template!',
      });
    });

    it('throws an internal server error when a default template cannot be found', async () => {
      jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(null);

      await expect(
        addEntirePlan('test-ref', context, {
          ...baseInput,
          templateId: undefined,
        } as never, plan)
      ).rejects.toMatchObject({
        extensions: { code: INTERNAL_SERVER_ERROR_CODE },
      });
    });

    it('throws an internal server error when the versioned template has no id', async () => {
      jest
        .spyOn(VersionedTemplate, 'findActiveByTemplateId')
        .mockResolvedValue(new VersionedTemplate({ name: 'Broken VT' }));

      await expect(addEntirePlan('test-ref', context, baseInput as never, plan)).rejects.toMatchObject({
        extensions: { code: INTERNAL_SERVER_ERROR_CODE },
      });
    });

    it('throws an internal server error when the project cannot be initialized', async () => {
      jest
        .spyOn(VersionedTemplate, 'findActiveByTemplateId')
        .mockResolvedValue(new VersionedTemplate({ id: 303, name: 'VT-1' }));

      await expect(
        addEntirePlan('test-ref', context, {
          ...baseInput,
          project: {
            ...baseInput.project,
            title: '',
          },
        } as never, plan)
      ).rejects.toMatchObject({
        extensions: { code: INTERNAL_SERVER_ERROR_CODE },
      });
    });

    it('throws a bad request error when the project save fails', async () => {
      setupAddEntirePlanDefaults();
      jest
        .spyOn(Project.prototype, 'update')
        .mockImplementation(async function failedProjectUpdate() {
          this.addError('general', 'Unable to update project');
          return this;
        });

      await expect(addEntirePlan('test-ref', context, baseInput as never, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('throws a bad request error when the plan save fails', async () => {
      setupAddEntirePlanDefaults();
      jest
        .spyOn(Plan.prototype, 'create')
        .mockImplementation(async function failedPlanCreate() {
          this.addError('general', 'Unable to create plan');
          return this;
        });

      await expect(addEntirePlan('test-ref', context, baseInput as never, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('surfaces alternate identifier processing errors as a bad request', async () => {
      setupAddEntirePlanDefaults();
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [],
        idsToBeSaved: ['ark:/12345/abc'],
      });
      jest
        .spyOn(AlternateIdentifier.prototype, 'create')
        .mockImplementation(async function failedCreate() {
          this.addError('general', 'Unable to create alternate identifier');
          return this;
        });

      await expect(
        addEntirePlan('test-ref', context, {
          ...baseInput,
          alternateIdentifiers: ['ark:/12345/abc'],
        } as never, plan)
      ).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('throws internal server error for unexpected failures', async () => {
      setupAddEntirePlanDefaults();
      jest
        .spyOn(Project, 'findByOwnerAndTitle')
        .mockRejectedValue(new Error('database unavailable'));

      let err: unknown;
      try {
        await addEntirePlan('test-ref', context, baseInput as never, plan);
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(GraphQLError);
      expect((err as GraphQLError).extensions?.code).toBe('INTERNAL_SERVER');
    });
  });

  describe('replaceEntirePlan', () => {
    const baseInput = {
      title: 'Replacement Plan',
      languageId: 'en-US',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      project: {
        title: 'Replacement Project',
        abstractText: 'Updated abstract',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        researchDomainUrl: 'https://ror.example.org/domain/202',
        isTestProject: true,
      },
      alternateIdentifiers: [],
      members: [],
      funding: [],
    };

    const setupReplaceDefaults = () => {
      setupAssociationDefaults();
      jest
        .spyOn(ResearchDomain, 'findByURI')
        .mockResolvedValue({ id: 202 } as ResearchDomain);
      jest
        .spyOn(Project.prototype, 'update')
        .mockImplementation(async function projectUpdate() {
          return this;
        });
      jest
        .spyOn(Plan.prototype, 'update')
        .mockImplementation(async function planUpdate() {
          return this;
        });
      jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
    };

    it('replaces the project and plan successfully', async () => {
      setupReplaceDefaults();
      plan.versionedTemplateId = 303;

      const response = await replaceEntirePlan('test-ref', context, project, plan, baseInput as never);

      expect(response).toBe(plan);
      expect(project.title).toBe('Replacement Project');
      expect(project.abstractText).toBe('Updated abstract');
      expect(project.researchDomainId).toBe(202);
      expect(plan.title).toBe('Replacement Plan');
      expect(ResearchDomain.findByURI).toHaveBeenCalledWith(
        'test-ref',
        context,
        baseInput.project.researchDomainUrl,
      );
    });

    it('throws a bad request error when the project update fails', async () => {
      setupReplaceDefaults();
      jest.spyOn(Project.prototype, 'update').mockResolvedValue(null);

      await expect(
        replaceEntirePlan('test-ref', context, project, plan, baseInput as never)
      ).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('throws a bad request error when the plan update fails', async () => {
      setupReplaceDefaults();
      jest.spyOn(Plan.prototype, 'update').mockResolvedValue(null);

      await expect(
        replaceEntirePlan('test-ref', context, project, plan, baseInput as never)
      ).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });
  });

  describe('removeEntirePlan', () => {
    beforeEach(() => {
      jest.spyOn(Plan.prototype, 'update').mockImplementation(async function updatePlan() {
        return this;
      });
      jest.spyOn(Plan.prototype, 'delete').mockResolvedValue(true as never);
      jest.spyOn(Project.prototype, 'delete').mockResolvedValue(true as never);
      jest.spyOn(Plan, 'findByProjectId').mockResolvedValue([]);
    });

    it('archives a published plan instead of deleting it', async () => {
      plan.registered = '2026-03-01';

      const response = await removeEntirePlan('test-ref', context, project, plan);

      expect(Plan.prototype.update).toHaveBeenCalledTimes(1);
      expect(Plan.prototype.delete).not.toHaveBeenCalled();
      expect(response.title).toContain('OBSOLETE:');
    });

    it('deletes an unpublished plan and its orphaned project', async () => {
      const response = await removeEntirePlan('test-ref', context, project, plan);

      expect(Plan.prototype.delete).toHaveBeenCalledTimes(1);
      expect(Project.prototype.delete).toHaveBeenCalledTimes(1);
      expect(response).toBe(plan);
    });

    it('does not delete the project when other plans still exist', async () => {
      jest.spyOn(Plan, 'findByProjectId').mockResolvedValue([new Plan({ id: 999, projectId: project.id })]);

      await removeEntirePlan('test-ref', context, project, plan);

      expect(Plan.prototype.delete).toHaveBeenCalledTimes(1);
      expect(Project.prototype.delete).not.toHaveBeenCalled();
    });

    it('throws a bad request error when archiving a published plan fails', async () => {
      plan.registeredById = context.token.id;
      jest.spyOn(Plan.prototype, 'update').mockResolvedValue(false as never);

      await expect(removeEntirePlan('test-ref', context, project, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('throws a bad request error when deleting the plan fails', async () => {
      jest.spyOn(Plan.prototype, 'delete').mockResolvedValue(false as never);

      await expect(removeEntirePlan('test-ref', context, project, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });

    it('throws a bad request error when deleting the orphaned project fails', async () => {
      jest.spyOn(Project.prototype, 'delete').mockResolvedValue(false as never);

      await expect(removeEntirePlan('test-ref', context, project, plan)).rejects.toMatchObject({
        extensions: { code: BAD_REQUEST_ERROR_CODE },
      });
    });
  });
});
