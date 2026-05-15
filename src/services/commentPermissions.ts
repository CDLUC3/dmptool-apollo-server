import { ProjectCollaborator } from "../models/Collaborator";

// Can delete a comment if comment creator or Primary-level collaborator
export function canDeleteComment({
  commentCreatedById,
  userId,
  primaryCollaborator
}: {
  commentCreatedById?: number,
  userId: number,
  primaryCollaborator?: ProjectCollaborator | null
}): boolean {
  const isOwnComment = commentCreatedById === userId;
  const isPrimaryCollaborator = primaryCollaborator?.userId === userId;
  return isOwnComment || isPrimaryCollaborator;
}