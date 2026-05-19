import { ProjectCollaborator } from "../models/Collaborator";

// Can delete a comment if comment creator, plan creator, or OWN-level collaborator
export function canDeleteComment({
  commentCreatedById,
  planCreatedById,
  userId,
  collaborators
}: {
  commentCreatedById?: number,
  planCreatedById?: number,
  userId: number,
  collaborators: ProjectCollaborator[]
}): boolean {
  const isCommentCreator = commentCreatedById === userId;
  const isPlanCreator = planCreatedById === userId;
  const isOwnCollaborator = collaborators.some(
    c => c.userId === userId && c.accessLevel === "OWN"
  );
  return isCommentCreator || isPlanCreator || isOwnCollaborator;
}
