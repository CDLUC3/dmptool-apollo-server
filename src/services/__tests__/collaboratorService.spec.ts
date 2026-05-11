import { GraphQLError } from 'graphql';
import { MyContext } from '../../context';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { validateProjectCollaboratorAccessChange, demoteExistingPrimaryCollaborator } from '../collaboratorService';
import { ProjectCollaborator, ProjectCollaboratorAccessLevel } from '../../models/Collaborator';
import { isSuperAdmin } from '../authService';
import { logger } from '../../logger';
import casual from 'casual';

jest.mock('../../models/Collaborator', () => ({
  ProjectCollaborator: {
    findByProjectId: jest.fn(),
    findByUserIdAndProjectId: jest.fn(),
  },
  ProjectCollaboratorAccessLevel: {
    PRIMARY: 'PRIMARY',
    OWN: 'OWN',
    EDIT: 'EDIT',
    COMMENT: 'COMMENT',
  },
}));

jest.mock('../authService');

describe('collaboratorService', () => {
  let context: MyContext;
  const projectId = casual.integer(1, 1000);

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProjectCollaboratorAccessChange', () => {

    describe('when demoting the PRIMARY', () => {
      it('should throw a GraphQLError with LAST_PRIMARY_COLLABORATOR code', async () => {
        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.PRIMARY,
            ProjectCollaboratorAccessLevel.OWN,
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.PRIMARY,
            ProjectCollaboratorAccessLevel.OWN,
          )
        ).rejects.toMatchObject({
          extensions: { code: 'LAST_PRIMARY_COLLABORATOR' }
        });
      });
    });

    describe('when assigning PRIMARY as a SuperAdmin', () => {
      it('should resolve without throwing', async () => {
        (isSuperAdmin as jest.Mock).mockReturnValue(true);

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('when assigning PRIMARY as an existing PRIMARY collaborator', () => {
      it('should resolve without throwing', async () => {
        (isSuperAdmin as jest.Mock).mockReturnValue(false);

        (ProjectCollaborator.findByUserIdAndProjectId as jest.Mock).mockResolvedValue({
          accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
        });

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('when assigning PRIMARY as a non-PRIMARY, non-SuperAdmin', () => {
      it('should throw a GraphQLError with FORBIDDEN code', async () => {
        (isSuperAdmin as jest.Mock).mockReturnValue(false);

        (ProjectCollaborator.findByUserIdAndProjectId as jest.Mock).mockResolvedValue({
          accessLevel: ProjectCollaboratorAccessLevel.OWN,
        });

        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.PRIMARY,
          )
        ).rejects.toMatchObject({
          extensions: { code: 'FORBIDDEN' }
        });
      });
    });

    describe('when making a non-PRIMARY access change', () => {
      it('should resolve without throwing', async () => {
        await expect(
          validateProjectCollaboratorAccessChange(
            context,
            projectId,
            ProjectCollaboratorAccessLevel.OWN,
            ProjectCollaboratorAccessLevel.EDIT,
          )
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('demoteExistingPrimaryCollaborator', () => {
    const excludeCollaboratorId = casual.integer(1, 1000);

    describe('when an existing PRIMARY collaborator is found', () => {
      it('should demote them to OWN and call update', async () => {
        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        const mockPrimary = {
          id: casual.integer(1, 1000),
          accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
          update: mockUpdate,
        };

        (ProjectCollaborator.findByProjectId as jest.Mock).mockResolvedValue([mockPrimary]);

        await demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId);

        expect(mockPrimary.accessLevel).toBe(ProjectCollaboratorAccessLevel.OWN);
        expect(mockUpdate).toHaveBeenCalledWith(context);
      });
    });

    describe('when no PRIMARY collaborator exists', () => {
      it('should resolve without calling update', async () => {
        const mockUpdate = jest.fn();
        (ProjectCollaborator.findByProjectId as jest.Mock).mockResolvedValue([
          { id: excludeCollaboratorId, accessLevel: ProjectCollaboratorAccessLevel.OWN, update: mockUpdate }
        ]);

        await expect(
          demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId)
        ).resolves.toBeUndefined();

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe('when the only PRIMARY is the excluded collaborator', () => {
      it('should not demote them', async () => {
        const mockUpdate = jest.fn();
        (ProjectCollaborator.findByProjectId as jest.Mock).mockResolvedValue([
          { id: excludeCollaboratorId, accessLevel: ProjectCollaboratorAccessLevel.PRIMARY, update: mockUpdate }
        ]);

        await demoteExistingPrimaryCollaborator(context, projectId, excludeCollaboratorId);

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });
});