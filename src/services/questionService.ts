import { MyContext } from "../context.js";
import { Template } from "../models/Template.js";
import { hasPermissionOnTemplate } from "./templateService.js";
import { Question } from "../models/Question.js";
import { Tag } from "../models/Tag.js";
import { VersionedQuestion } from "../models/VersionedQuestion.js";
import { NotFoundError } from "../utils/graphQLErrors.js";
import { QuestionCondition } from "../models/QuestionCondition.js";
import { QuestionConditionGroup } from "../models/QuestionConditionGroup.js";
import { VersionedQuestionCondition } from "../models/VersionedQuestionCondition.js";
import { VersionedQuestionConditionGroup } from "../models/VersionedQuestionConditionGroups.js";
import { prepareObjectForLogs } from "../logger.js";
import { reorderDisplayOrder } from "../utils/helpers.js";

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

// Creates a new Version/Snapshot of the specified QuestionConditionGroup (as a point in
// time snapshot), and versions each QuestionCondition that belongs to it.
//    - creates a new VersionedQuestionConditionGroup
export const generateQuestionConditionGroupVersion = async (
  context: MyContext,
  group: QuestionConditionGroup,
  versionedQuestionId: number,
): Promise<boolean> => {
  // If the group has no id then it has not yet been saved so throw an error
  if (!group.id) {
    throw new Error('Cannot publish unsaved QuestionConditionGroup');
  }

  // Intialize the new Version
  const versionedGroup = new VersionedQuestionConditionGroup({
    versionedQuestionId,
    triggerQuestionId: group.triggerQuestionId,
  });

  const savedGroup = await versionedGroup.create(context);
  if (!savedGroup || savedGroup.hasErrors()) {
    const msg = `Unable to generate a new version for questionConditionGroup: ${group.id}`;
    context.logger.error(prepareObjectForLogs(savedGroup?.errors), msg);
    throw new Error(msg);
  }

  const conditions = await QuestionCondition.findByGroupId('generateQuestionConditionGroupVersion', context, group.id);
  for (const condition of conditions) {
    const conditionInstance = new QuestionCondition({
      ...condition
    });

    const passed = await generateQuestionConditionVersion(context, conditionInstance, savedGroup.id);
    if (!passed) {
      return false;
    }
  }

  return true;
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
    displayLogicAction: question.displayLogicAction,
    displayLogicMatchType: question.displayLogicMatchType,
    createdById: question.createdById,
    created: question.created,
    modifiedById: question.modifiedById,
    modified: question.modified,
  });

  try {
    const saved = await versionedQuestion.create(context);

    if (saved && !saved.hasErrors()) {
      // Get tags associated with the question so we can add them to the versionedQuestionTags table
      const addTagErrors = [];
      if (Array.isArray(question.tags) && question.tags.length > 0) {
        for (const item of question.tags) {
          const tag = await Tag.findById('generateQuestionVersion', context, item.id);
          if (!tag) {
            addTagErrors.push(`Tag ${item.id} not found`);
            continue;
          }
          const wasAdded = await tag.addToVersionedQuestionTags(context, saved.id);
          if (!wasAdded) {
            addTagErrors.push(tag.name);
          }
        }
      }
      if (addTagErrors.length > 0) {
        saved.addError('tags', `Saved but we were unable to assign tags: ${addTagErrors.join(', ')}`);
      }

      // Version any QuestionConditionGroups (and their QuestionConditions) as well
      const groups = await QuestionConditionGroup.findByQuestionId('generateQuestionVersion', context, saved.questionId);
      let allConditionsWereVersioned = true;

      if (groups.length > 0) {
        for (const group of groups) {
          const groupInstance = new QuestionConditionGroup({
            ...group
          });

          // generateQuestionConditionGroupVersion internally versions the group's QuestionConditions
          const passed = await generateQuestionConditionGroupVersion(context, groupInstance, saved.id);
          if (!passed) {
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
  versionedQuestionConditionGroupId: number,
): Promise<boolean> => {
  // If the condition has no id then it has not yet been saved so throw an error
  if (!questionCondition.id) {
    throw new Error('Cannot publish unsaved QuestionCondition');
  }

  // Intialize the new Version
  const versionedQuestionCondition = new VersionedQuestionCondition({
    versionedQuestionConditionGroupId,
    conditionType: questionCondition.conditionType,
    conditionMatch: questionCondition.conditionMatch,
  });

  const created = await versionedQuestionCondition.create(context);
  if (created && !created.hasErrors()) {
    return true;
  }

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
  return reorderedQuestions;
}

/**
 * Extracts the option values from a question's JSON data.
 * @param question The question to extract option values from.
 * @returns A set of the extracted option values.
 */
export const extractTriggerQuestionOptionValues = (question: Question): Set<string> => {
  try {
    const parsed = JSON.parse(question.json);
    const optionCandidates = [parsed?.options, parsed?.attributes?.options];

    const values = optionCandidates
      .filter((entry) => Array.isArray(entry))
      .flatMap((entry) => entry as Record<string, unknown>[])
      .map((option) => {
        if (typeof option?.value === 'string') {
          return option.value;
        }
        if (typeof option?.label === 'string') {
          return option.label;
        }
        return undefined;
      })
      .filter((value): value is string => Boolean(value));

    return new Set(values);
  } catch {
    return new Set();
  }
};



// Returns true if the provided question supports selectable options by exposing an options array in its JSON data; otherwise false.
export const questionSupportsSelectableOptions = (question: Question): boolean => {
  try {
    const parsed = JSON.parse(question.json);
    const rootOptions = parsed?.options;
    const attributeOptions = parsed?.attributes?.options;
    return Array.isArray(rootOptions) || Array.isArray(attributeOptions);
  } catch {
    return false;
  }
};