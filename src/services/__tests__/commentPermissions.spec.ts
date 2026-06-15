import { canDeleteComment } from '../commentPermissions';
import {
  ProjectCollaborator,
  ProjectCollaboratorAccessLevel,
} from '../../models/Collaborator';

describe('canDeleteComment', () => {
  it('returns true when the user is the comment creator', () => {
    const result = canDeleteComment({
      commentCreatedById: 10,
      userId: 10,
      primaryCollaborator: null,
    });

    expect(result).toBe(true);
  });

  it('returns true when the user is the PRIMARY collaborator', () => {
    const primaryCollaborator = new ProjectCollaborator({
      projectId: 1,
      email: 'primary@example.com',
      userId: 20,
      accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
    });

    const result = canDeleteComment({
      commentCreatedById: 10,
      userId: 20,
      primaryCollaborator,
    });

    expect(result).toBe(true);
  });

  it('returns false when the user is neither creator nor PRIMARY collaborator', () => {
    const primaryCollaborator = new ProjectCollaborator({
      projectId: 1,
      email: 'primary@example.com',
      userId: 30,
      accessLevel: ProjectCollaboratorAccessLevel.PRIMARY,
    });

    const result = canDeleteComment({
      commentCreatedById: 10,
      userId: 20,
      primaryCollaborator,
    });

    expect(result).toBe(false);
  });

  it('returns false when there is no primary collaborator and user is not creator', () => {
    const result = canDeleteComment({
      commentCreatedById: 10,
      userId: 20,
      primaryCollaborator: null,
    });

    expect(result).toBe(false);
  });
});
