import { MyContext } from "../context";
import { Template } from "../models/Template";
import { hasPermissionOnTemplate } from "./templateService";
import { Question } from "../models/Question";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { NotFoundError } from "../utils/graphQLErrors";
import { QuestionCondition } from "../models/QuestionCondition";
import { VersionedQuestionCondition } from "../models/VersionedQuestionCondition";
import { prepareObjectForLogs } from "../logger";
import { reorderDisplayOrder } from "../utils/helpers";

// Determine whether the specified user has permission to access the Section
export const hasPermissionOnQuestion = async (context: MyContext, templateId: number): Promise<boolean> => {
  if (!context || !context.token) return false;

  // Find associated template info
  const template = await Template.findById('question resolver.hasPermission', context, templateId);

  if (!template) {
    throw NotFoundError();
  }

  // Offload permission checks to the Template
  return await hasPermissionOnTemplate(context, template);
}

// Creates a new Version/Snapshot the specified Question (as a point in time snapshot)
//    - creates a new VersionedQuestion
export const generateQuestionVersion = async (
  context: MyContext,
  question: Question,
  versionedTemplateId: number,
  versionedSectionId: number,
): Promise<boolean> => {

  // If the section has no id then it has not yet been saved so throw an error
  if (!question.id) {
    throw new Error('Cannot publish unsaved Question');
  }

  // Intialize the new Version
  const versionedQuestion = new VersionedQuestion({
    versionedTemplateId,
    versionedSectionId,
    questionId: question.id,
    json: question.json,
    questionText: question.questionText,
    requirementText: question.requirementText,
    guidanceText: question.guidanceText,
    sampleText: question.sampleText,
    useSampleTextAsDefault: question.useSampleTextAsDefault,
    displayOrder: question.displayOrder,
    required: question.required,
    createdById: question.createdById,
    created: question.created,
    modifiedById: question.modifiedById,
    modified: question.modified,
  });

  try {
    const saved = await versionedQuestion.create(context);

    if (saved && !saved.hasErrors()) {
      // Version any QuestionConditions as well
      const questionConditions = await QuestionCondition.findByQuestionId('generateQuestionVersion', context, saved.questionId);
      let allConditionsWereVersioned = true;

      if (questionConditions.length > 0) {
        for (const condition of questionConditions) {
          const questionConditionInstance = new QuestionCondition({
            ...condition
          });

          const passed = await generateQuestionConditionVersion(context, questionConditionInstance, saved.id);
          if (!passed) {
            // If one of the conditions failed to version
            allConditionsWereVersioned = false;
          }
        }
      }

      // Only proceed if all the conditions were able to version properly
      if (allConditionsWereVersioned) {
        // Reset the dirty flag
        question.isDirty = false;
        const updated = await question.update(context, true);

        if (updated && !updated.hasErrors()) return true;

        // There were errors on the object so report them
        const msg = `Unable to set isDirty flag on question: ${question.id}`;
        context.logger.error(prepareObjectForLogs(updated.errors), msg);
        throw new Error(msg);
      }
    } else {
      // There were errors on the object so report them
      const msg = `Unable to create new version for question: ${question.id}`;
      context.logger.error(prepareObjectForLogs(saved.errors), msg);
      throw new Error(msg);
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Unable to generate a new version for question: ${question.id}`);
    throw err
  }

  return false;
}

// Make a copy of the specified Question (excluding any related QuestionConditions)
export const cloneQuestion = (
  clonedById: number,
  templateId: number,
  sectionId: number,
  question: Question | VersionedQuestion
): Question => {
  // If the incoming is a VersionedQuestion, then use the questionId (the question it was based off of)
  const sourceId = Object.keys(question).includes('questionId') ? question['questionId'] : question.id;
  const questionCopy = new Question({
    templateId,
    sectionId,
    sourceQuestionId: sourceId,
    json: question.json,
    questionText: question.questionText,
    requirementText: question.requirementText,
    guidanceText: question.guidanceText,
    sampleText: question.sampleText,
    useSampleTextAsDefault: question.useSampleTextAsDefault,
    displayOrder: question.displayOrder,
    required: false,
    isDirty: true,
    createdById: question.createdById,
    created: question.created,
    modifiedById: question.modifiedById,
    modified: question.modified,
  });

  questionCopy.createdById = clonedById;
  return questionCopy;
}

// Creates a new Version/Snapshot the specified QuestionCondition (as a point in time snapshot)
//    - creates a new VersionedQuestionCondition
export const generateQuestionConditionVersion = async (
  context: MyContext,
  questionCondition: QuestionCondition,
  versionedQuestionId: number,
): Promise<boolean> => {
  // If the section has no id then it has not yet been saved so throw an error
  if (!questionCondition.id) {
    throw new Error('Cannot publish unsaved QuestionCondition');
  }

  // Intialize the new Version
  const versionedQuestionCondition = new VersionedQuestionCondition({
    versionedQuestionId,
    questionConditionId: questionCondition.id,
    action: questionCondition.action,
    conditionType: questionCondition.conditionType,
    conditionMatch: questionCondition.conditionMatch,
    target: questionCondition.target,
  });

  const created = await versionedQuestionCondition.create(context);
  if (created && !created.hasErrors()) {
    return true;
  }

  // There were errors on the object so report them
  const msg = `Unable to generate a new version for questionCondition: ${questionCondition.id}`;
  context.logger.error(prepareObjectForLogs(created.errors), msg);
  throw new Error(msg);
}

// Update the display order of the specified Section
export const updateDisplayOrders = async (
  context: MyContext,
  sectionId: number,
  questionId: number,
  newDisplayOrder: number
): Promise<Question[] | []> => {
  // Load all of the questions that belong to the section
  const questions = await Question.findBySectionId('questionService.updateDisplayOrders', context, sectionId);
  if (!questions) {
    throw NotFoundError();
  }

  // Retain the original display orders
  const originals = questions ? questions.map(section => ({ ...section })) : [];
  // reorder the questions
  const reorderedQuestions = reorderDisplayOrder(questionId, newDisplayOrder, questions);

  // Save the reordered questions
  for (const reorderedQuestion of reorderedQuestions) {
    const oldDisplayOrder = originals.find((s) => s.id === reorderedQuestion.id)?.displayOrder;

    // If the display order is the same as the original display order, then skip it
    if (reorderedQuestion.displayOrder === oldDisplayOrder) {
      continue;

    } else {
      const toUpdate = new Question({ ...reorderedQuestion });
      const updatedSection = await toUpdate.update(context);
      if (updatedSection && updatedSection.hasErrors()) {
        // If one of them fais, throw an error
        const msg = `Unable to update the display order for section: ${reorderedQuestion.id}`;
        context.logger.error(prepareObjectForLogs(updatedSection.errors), msg);
        throw new Error(msg);
      }
    }
  }
  return  reorderedQuestions;
}
