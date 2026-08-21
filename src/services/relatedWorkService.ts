import {
  AcceptedWork,
  RelatedWork,
  RelationType,
  Work,
  WorkVersion
} from "../models/RelatedWork";
import { MyContext } from "../context";
import { AddRelatedWorkManualInput } from "../types";
import { Plan } from "../models/Plan";
import { isNullOrUndefined } from "@dmptool/utils";
import { NotFoundError } from "../utils/graphQLErrors";

/**
 * Adds a related work that was manually added by the user through the UI or was
 * added via the addEntirePlan/replaceEntirePlan mutations
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 * @param input the Related Work input
 * @returns the Accepted Work
 */
export const addAcceptedWork = async (
  reference: string,
  context: MyContext,
  plan: Plan,
  input: AddRelatedWorkManualInput
): Promise<AcceptedWork> => {
  const acceptedWork: AcceptedWork = new AcceptedWork(input);

  // Fetch or create work
  let work: Work = await Work.findByDoi(reference, context, input.doi);
  if (!work) {
    work = new Work({ doi: input.doi });
    work = await work.create(context);
  }
  if (!work || work.hasErrors()) {
    acceptedWork.addError('general', 'Unable to create or find work');
  }

  // Fetch or create work version
  const osHash: string = input.hash ? input.hash.toString() : "";
  let workVersion = await WorkVersion.findByDoiAndHash(
    reference,
    context,
    input.doi,
    Buffer.from(osHash, 'hex')
  );
  if (!workVersion) {
    workVersion = new WorkVersion({
      ...input,
      workId: work.id,
      hash: Buffer.from(osHash, 'hex')
    });
    workVersion = await workVersion.create(context, work.doi);
  }
  if (isNullOrUndefined(workVersion) || workVersion.hasErrors()) {
    acceptedWork.addError('general', 'Unable to create or find a version of the work');
  }

  // Create related work
  if (!acceptedWork.hasErrors()) {
    let relatedWork = new RelatedWork({
      planId: plan.id,
      workVersionId: workVersion.id,
      status: 'ACCEPTED',
      score: 1.0,
      scoreMax: 1.0,
      sourceType: 'USER_ADDED',
    });
    relatedWork = await relatedWork.create(context);
    if (relatedWork && !relatedWork.hasErrors()) {
      return await AcceptedWork.findByPlanIdAndDoi(reference, context, plan.id, input.doi);
    }
    acceptedWork.addError('general', 'Unable to create related work');
  }

  return acceptedWork;
}

/**
 * Update the type of work or type of relation for the AcceptedWork
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 * @param input the related work
 * @returns the updated Accepted work
 */
export const UpdateAcceptedWork = async (
  reference: string,
  context: MyContext,
  plan: Plan,
  input: AddRelatedWorkManualInput
): Promise<AcceptedWork> => {
  const acceptedWork: AcceptedWork = await AcceptedWork.findByPlanIdAndDoi(
    reference,
    context,
    plan.id,
    input.doi
  );
  if (!acceptedWork && acceptedWork.workVersionId) {
    throw NotFoundError('Unable to find related work');
  }

  if (acceptedWork.workType !== input.workType) {
    const workVersion: WorkVersion = await WorkVersion.findById(
      reference,
      context,
      acceptedWork.workVersionId
    );
    if (workVersion) {
      const newWorkVersion = new WorkVersion({
        ...workVersion,
        workType: input.workType,
      });
      // Instead of updating, we create a new version of the work with the correct type
      const created: WorkVersion = await newWorkVersion.create(context, acceptedWork.doi);
      if (!created || created.hasErrors()) {
        acceptedWork.addError('workType', 'Unable to update work type for work');
      }

      acceptedWork.workVersionId = workVersion.id;

      // Now get the RelatedWork and if the relationship type changed, update it
      const relatedWork: RelatedWork = await RelatedWork.findByPlanAndWorkVersionId(
        reference,
        context,
        plan.id,
        workVersion.id
      );
      if (relatedWork && relatedWork.relationType !== input.relationType) {
        relatedWork.relationType = RelationType[input.relationType as keyof typeof RelationType];
        const updated: RelatedWork = await relatedWork.update(context);
        if (!updated || updated.hasErrors()) {
          acceptedWork.addError('workType', 'Unable to update relation type for work');
        }
      } else {
        acceptedWork.addError('workType', 'Unable to update related work');
      }

    } else {
      acceptedWork.addError('general', 'Unable to update version of work');
    }
  }

  return acceptedWork;
}

/**
 * Remove the Related work associated with the AcceptedWork
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 * @param doi the DOI
 * @returns the AcceptedWork that was deleted
 */
export const removeAcceptedWork = async (
  reference: string,
  context: MyContext,
  plan: Plan,
  doi: string
): Promise<AcceptedWork> => {
  const acceptedWork: AcceptedWork = await AcceptedWork.findByPlanIdAndDoi(
    reference,
    context,
    plan.id,
    doi
  );
  if (!acceptedWork && acceptedWork.workVersionId) {
    throw NotFoundError('Unable to find related work');
  }

  const relatedWork: RelatedWork = await RelatedWork.findById(
    reference,
    context,
    acceptedWork.relatedWorkId
  );
  if (!relatedWork) {
    throw NotFoundError('Unable to find relevant version of related work');
  }

  const deleted: RelatedWork = await relatedWork.delete(context);
  if (!deleted || deleted.hasErrors()) {
    acceptedWork.addError('general', 'Unable to delete related work');
  }

  return acceptedWork;
}
