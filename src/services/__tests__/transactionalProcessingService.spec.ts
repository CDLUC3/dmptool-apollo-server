import { GraphQLError } from 'graphql';
import { logger } from '../../logger';
import { MySqlModel } from '../../models/MySqlModel';
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
  addEntirePlan,
  processFundingAssociations,
  processMemberAssociations,
} from '../transactionalProcessingService';

jest.mock('../projectService', () => ({
  ensureDefaultProjectContact: jest.fn().mockResolvedValue(true),
  setCurrentUserAsProjectOwner: jest.fn().mockResolvedValue(true),
}));

jest.mock('../planService', () => ({
  ensureDefaultPlanContact: jest.fn().mockResolvedValue(true),
}));

describe('transactionalProcessingService', () => {
  let context;
  let transactionClient;
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
    jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([]);
    jest
      .spyOn(ProjectMember, 'findByProjectAndNameOrORCIDOrEmail')
      .mockResolvedValue(null);
    jest.spyOn(PlanMember, 'findByProjectMemberId').mockResolvedValue([]);

    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
    jest
      .spyOn(ProjectFunding, 'findByProjectAndAffiliation')
      .mockResolvedValue(null);
    jest.spyOn(PlanFunding, 'findByProjectFundingId').mockResolvedValue([]);

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
    transactionClient = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    project = new Project({ id: 1001, title: 'Project', abstractText: 'A' });
    plan = new Plan({ id: 2002, projectId: project.id, title: 'Plan title' });
  });

  describe('processMemberAssociations', () => {
    it('adds new members and associated roles', async () => {
      setupAssociationDefaults();
      const roleOne = makeRole(1, 'One');
      const roleTwo = makeRole(2, 'Two');
      jest
        .spyOn(MemberRole, 'findById')
        .mockResolvedValueOnce(roleOne)
        .mockResolvedValueOnce(roleTwo);

      const errors = await processMemberAssociations(
        'test-ref',
        context,
        transactionClient,
        project,
        plan,
        [{
          projectId: project.id,
          affiliationId: 'https://ror.example.org/abc',
          givenName: 'Taylor',
          surName: 'Smith',
          orcid: '0000-0000-0000-0000',
          email: 'taylor@example.org',
          memberRoleIds: [1, 2],
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
        transactionClient,
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
        .spyOn(ProjectMember, 'findByProjectAndNameOrORCIDOrEmail')
        .mockResolvedValue(currentProjectMember);
      jest.spyOn(Plan, 'reconcileAssociationIds').mockReturnValue({
        idsToBeRemoved: [],
        idsToBeSaved: [currentProjectMember.id],
      });
      jest.spyOn(MemberRole, 'findById').mockResolvedValue(newRole);
      jest
        .spyOn(ProjectMember.prototype, 'update')
        .mockImplementation(async function failedUpdate() {
          this.addError('general', 'Unable to update');
          return this;
        });

      const errors = await processMemberAssociations(
        'test-ref',
        context,
        transactionClient,
        project,
        plan,
        [{
          projectMemberId: currentProjectMember.id,
          affiliationId: 'https://ror.example.org/new',
          givenName: 'New',
          surName: 'Member',
          orcid: '0000-0000-0000-0000',
          email: 'new@example.org',
          memberRoleIds: [5],
        }],
      );

      expect(errors).toContain('Unable to add role NewRole to project member');
      expect(errors).toContain('Unable to add role NewRole to plan member');
      expect(errors).toContain('Unable to update project member');
      expect(errors).toContain('Unable to remove role Legacy from project member');
    });
  });

  describe('processFundingAssociations', () => {
    it('adds project and plan funding records', async () => {
      setupAssociationDefaults();

      const errors = await processFundingAssociations(
        'test-ref',
        context,
        transactionClient,
        project,
        plan,
        [{
          projectId: project.id,
          affiliationId: 'https://ror.example.org/abc',
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
        transactionClient,
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
        .spyOn(ProjectFunding, 'findByProjectAndAffiliation')
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
        transactionClient,
        project,
        plan,
        [{
          projectFundingId: currentProjectFunding.id,
          status: 'PLANNED',
          funderOpportunityNumber: 'OPP-X',
          funderProjectNumber: 'PROJ-Y',
          grantId: 'GRANT-Z',
        }],
      );

      expect(errors).toContain('Unable to update project funding');
    });
  });

  describe('addEntirePlan', () => {
    const baseInput = {
      title: 'My Entire Plan',
      templateId: 99,
      project: {
        id: 101,
        title: '  Existing Project  ',
        abstractText: '  project abstract  ',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        researchDomainId: 202,
        isTestProject: true,
      },
      alternateIdentifiers: [],
      members: [],
      funding: [],
    };

    const setupAddEntirePlanDefaults = () => {
      setupAssociationDefaults();
      jest.spyOn(MySqlModel, 'initializeTransaction').mockResolvedValue(
        transactionClient
      );

      const existingProject = new Project({
        id: 101,
        title: 'Existing Project',
        abstractText: 'existing',
      });
      jest.spyOn(Project, 'findById').mockResolvedValue(existingProject);
      jest
        .spyOn(ResearchDomain, 'findById')
        .mockResolvedValue({ id: 202 } as ResearchDomain);
      jest
        .spyOn(Project.prototype, 'update')
        .mockImplementation(async function projectUpdate() {
          return this;
        });
      jest
        .spyOn(VersionedTemplate, 'findActiveByTemplateId')
        .mockResolvedValue(new VersionedTemplate({ id: 303, name: 'VT-1' }));
      jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
      jest
        .spyOn(Plan.prototype, 'create')
        .mockImplementation(async function planCreate() {
          this.id = 404;
          this.dmpId = 'doi.org/10.1234/example';
          return this;
        });
    };

    it('creates a full plan and commits the transaction', async () => {
      setupAddEntirePlanDefaults();

      const response = await addEntirePlan('test-ref', context, baseInput as never);

      expect(response.id).toBe(404);
      expect(response.errors).toEqual({});
      expect(transactionClient.commit).toHaveBeenCalledTimes(1);
      expect(transactionClient.rollback).toHaveBeenCalledTimes(0);
    });

    it('rolls back and returns plan errors for bad request failures', async () => {
      setupAddEntirePlanDefaults();
      jest
        .spyOn(Plan.prototype, 'create')
        .mockImplementation(async function failedPlanCreate() {
          return this;
        });

      const response = await addEntirePlan('test-ref', context, baseInput as never);

      expect(transactionClient.rollback).toHaveBeenCalledTimes(1);
      expect(response.errors.general).toBe(
        'Unable to create the plan from the maDMP JSON.'
      );
    });

    it('rolls back and throws internal server error for unexpected failures', async () => {
      setupAddEntirePlanDefaults();
      jest
        .spyOn(Project, 'findById')
        .mockRejectedValue(new Error('database unavailable'));

      let err: unknown;
      try {
        await addEntirePlan('test-ref', context, baseInput as never);
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(GraphQLError);
      expect((err as GraphQLError).extensions?.code).toBe('INTERNAL_SERVER');
      expect(transactionClient.rollback).toHaveBeenCalledTimes(1);
    });
  });
});