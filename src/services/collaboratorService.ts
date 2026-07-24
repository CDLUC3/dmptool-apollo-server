import { GraphQLError } from 'graphql';
import { MyContext } from '../context';
import {
  ProjectCollaborator,
  ProjectCollaboratorAccessLevel,
} from '../models/Collaborator';
import { isSuperAdmin } from './authService';

// Validate that an access level change is allowed:
//   - the last PRIMARY cannot be demoted
//   - only a SuperAdmin or current PRIMARY can assign PRIMARY access
export const validateProjectCollaboratorAccessChange = async (
  context: MyContext,
  projectId: number,
  currentAccessLevel: ProjectCollaboratorAccessLevel,
  newAccessLevel: ProjectCollaboratorAccessLevel,
): Promise<void> => {
  const reference = 'collaboratorService.validateProjectCollaboratorAccessChange';

  // Prevent demoting the only PRIMARY
  if (
    currentAccessLevel === ProjectCollaboratorAccessLevel.PRIMARY &&
    newAccessLevel !== ProjectCollaboratorAccessLevel.PRIMARY
  ) {
    throw new GraphQLError(
      'Cannot demote the Primary Owner. Please assign another Primary Owner first.',
      { extensions: { code: 'LAST_PRIMARY_COLLABORATOR' } }
    );
  }

  // Prevent assigning PRIMARY unless caller is a SuperAdmin or current PRIMARY
  if (newAccessLevel === ProjectCollaboratorAccessLevel.PRIMARY) {
    if (!isSuperAdmin(context.token)) {
      const callerCollaborator = await ProjectCollaborator.findByUserIdAndProjectId(
        reference, context, context.token?.id, projectId
      );
      if (callerCollaborator?.accessLevel !== ProjectCollaboratorAccessLevel.PRIMARY) {
        throw new GraphQLError(
          'Only a Primary Owner or Super Admin can assign Primary Owner access.',
          { extensions: { code: 'FORBIDDEN' } }
        );
      }
    }
  }
};

// Demote the existing PRIMARY collaborator on a project to OWN,
// excluding the collaborator that is being promoted (by id).
export const demoteExistingPrimaryCollaborator = async (
  context: MyContext,
  projectId: number,
  excludeCollaboratorId?: number,
): Promise<void> => {
  const reference = 'collaboratorService.demoteExistingPrimaryCollaborator';
  const collaborators = await ProjectCollaborator.findByProjectId(reference, context, projectId);
  const existingPrimary = collaborators.find(
    (c) => c.accessLevel === ProjectCollaboratorAccessLevel.PRIMARY &&
      c.id !== excludeCollaboratorId
  );
  if (existingPrimary) {
    existingPrimary.accessLevel = ProjectCollaboratorAccessLevel.OWN;
    await existingPrimary.update(context);
  }
};
