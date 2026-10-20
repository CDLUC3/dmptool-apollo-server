import { DisplayLogic, DisplayLogicAnswer, findHiddenQuestionIds } from "@dmptool/utils";
import {MyContext} from "../context.js";
import { Answer } from "../models/Answer.js";
import { Plan } from "../models/Plan.js";
import { VersionedQuestion } from "../models/VersionedQuestion.js";
import {
  VersionedQuestionConditionGroup
} from "../models/VersionedQuestionConditionGroups.js";
import { VersionedQuestionConditionCondition } from "../types.js";

export interface VersionedQuestionConditionalLogicCondition {
  conditionType: VersionedQuestionConditionCondition;
  conditionMatch: string | null;
}

// One trigger question box from the Display Logic UI. The question's displayLogicMatchType (ANY/ALL)
// applies to all of its conditions, both within each group and across groups (see @dmptool/utils)
export interface VersionedQuestionConditionalLogicGroup {
  id: number;
  // The versionedQuestionId of the trigger question within the same versionedTemplate. Null if the trigger
  // question is not part of that versionedTemplate (it is then treated as unanswered)
  triggerVersionedQuestionId: number | null;
  conditions: VersionedQuestionConditionalLogicCondition[];
}

interface ConditionalLogicRow {
  groupId: number;
  versionedQuestionId: number;
  triggerVersionedQuestionId: number | null;
  conditionType: VersionedQuestionConditionCondition | null;
  conditionMatch: string | null;
}

// Group the conditions by their condition group, and the groups by versionedQuestionId
function groupConditionalLogicRows(rows: ConditionalLogicRow[]): Map<number, VersionedQuestionConditionalLogicGroup[]> {
  const logicMap = new Map<number, VersionedQuestionConditionalLogicGroup[]>();
  const groupsById = new Map<number, VersionedQuestionConditionalLogicGroup>();
  for (const row of rows ?? []) {
    let group = groupsById.get(row.groupId);
    if (!group) {
      group = {
        id: row.groupId,
        triggerVersionedQuestionId: row.triggerVersionedQuestionId,
        conditions: [],
      };
      groupsById.set(row.groupId, group);

      if (logicMap.has(row.versionedQuestionId)) {
        logicMap.get(row.versionedQuestionId)?.push(group);
      } else {
        logicMap.set(row.versionedQuestionId, [group]);
      }
    }
    // A group without any conditions is returned with an empty conditions array
    if (row.conditionType) {
      group.conditions.push({ conditionType: row.conditionType, conditionMatch: row.conditionMatch });
    }
  }
  return logicMap;
}

/**
 * Find all the conditional logic for all the questions for the specified versioned section ids.
 *
 * The versionedQuestionConditionGroups table stores the trigger question's original questions.id, so
 * we map it to the trigger's versionedQuestionId within the same versionedTemplate. This lets callers
 * match the trigger to the versioned questions in the plan. Only trigger questions within that
 * versionedTemplate are used; any other trigger is returned as null.
 *
 * @param reference The reference for the query
 * @param context The Apollo context
 * @param versionedSectionIds The versioned section ids to find the conditional logic for
 * @returns A map of versionedQuestionId to its condition groups
 */
export async function findConditionalLogicForPlan(
  reference: string,
  context: MyContext,
  versionedSectionIds: number[]
): Promise<Map<number, VersionedQuestionConditionalLogicGroup[]>> {
  if (!versionedSectionIds || versionedSectionIds.length === 0) return new Map();

  const placeholder = versionedSectionIds.map(() => '?').join(',');
  const sql = `
    SELECT vqcg.id AS groupId, vqcg.versionedQuestionId, tvq.id AS triggerVersionedQuestionId,
      vqc.conditionType, vqc.conditionMatch
    FROM versionedQuestionConditionGroups vqcg
      JOIN versionedQuestions vq ON vqcg.versionedQuestionId = vq.id
        LEFT JOIN versionedQuestions tvq ON tvq.questionId = vqcg.triggerQuestionId
          AND tvq.versionedTemplateId = vq.versionedTemplateId
        LEFT JOIN versionedQuestionConditions vqc ON vqcg.id = vqc.versionedQuestionConditionGroupId
    WHERE vq.versionedSectionId IN (${placeholder})
    ORDER BY vqcg.id, vqc.id`;

  const vals = versionedSectionIds.map(id => id.toString());
  const results: ConditionalLogicRow[] = await VersionedQuestionConditionGroup.query(context, sql, vals, reference);

  return groupConditionalLogicRows(results);
}

/**
 * Determine which versioned questions are hidden by their display logic, based on the plan's saved
 * answers. The rules are applied by findHiddenQuestionIds in @dmptool/utils, so every service treats
 * the display logic the same way.
 *
 * @param questions The plan's versioned questions
 * @param sectionDisplayOrder The displayOrder of each versionedSectionId
 * @param conditionalLogic The condition groups for each versionedQuestionId (see findConditionalLogicForPlan)
 * @param answersByQuestionId The plan's saved answers for each versionedQuestionId
 * @returns The ids of the versioned questions that should be hidden
 */
export function findHiddenVersionedQuestionIds(
  questions: Pick<VersionedQuestion, 'id' | 'versionedSectionId' | 'displayOrder' | 'displayLogicAction' | 'displayLogicMatchType'>[],
  sectionDisplayOrder: Map<number, number>,
  conditionalLogic: Map<number, VersionedQuestionConditionalLogicGroup[]>,
  answersByQuestionId: Map<number, Pick<Answer, 'json'>>
): Set<number> {
  // Trigger questions always come before the questions that depend on them (in an earlier section, or
  // earlier in the same section), so the questions are evaluated in display order (a hidden trigger
  // question is treated as unanswered)
  const sectionOrder = (q: Pick<VersionedQuestion, 'versionedSectionId'>): number => sectionDisplayOrder.get(q.versionedSectionId) ?? 0;
  const orderedQuestionIds: number[] = [...questions]
    .sort((a, b): number => sectionOrder(a) - sectionOrder(b) || a.displayOrder - b.displayOrder)
    .map((q): number => q.id);

  const logicByQuestionId = new Map<number, DisplayLogic>();
  for (const q of questions) {
    const groups = conditionalLogic.get(q.id);
    if (groups?.length > 0) {
      logicByQuestionId.set(q.id, {
        action: q.displayLogicAction,
        matchType: q.displayLogicMatchType,
        groups: groups.map((g) => ({ triggerQuestionId: g.triggerVersionedQuestionId, conditions: g.conditions })),
      });
    }
  }

  const answers = new Map<number, DisplayLogicAnswer>(
    [...answersByQuestionId].map(([id, answer]): [number, DisplayLogicAnswer] => [id, answer.json])
  );
  return findHiddenQuestionIds(orderedQuestionIds, logicByQuestionId, answers);
}

interface PlanConditionalLogicRow extends ConditionalLogicRow {
  versionedSectionId: number;
  displayOrder: number;
  sectionDisplayOrder: number;
  displayLogicAction: VersionedQuestion['displayLogicAction'];
  displayLogicMatchType: VersionedQuestion['displayLogicMatchType'];
}

/**
 * A lightweight way to determine which of a plan's versioned questions are hidden by their display
 * logic (e.g. after an answer is saved), without loading the rest of the plan. Only the questions
 * that have display logic and the saved answers to their trigger questions are loaded.
 *
 * @param reference The reference for the query
 * @param context The Apollo context
 * @param plan The plan
 * @returns The ids of the versioned questions that should be hidden
 */
export async function findHiddenVersionedQuestionIdsForPlan(
  reference: string,
  context: MyContext,
  plan: Pick<Plan, 'id' | 'versionedTemplateId'>
): Promise<number[]> {
  if (!plan?.id || !plan.versionedTemplateId) return [];

  const sql = `
    SELECT vqcg.id AS groupId, vq.id AS versionedQuestionId, tvq.id AS triggerVersionedQuestionId,
      vqc.conditionType, vqc.conditionMatch, vq.versionedSectionId, vq.displayOrder,
      vs.displayOrder AS sectionDisplayOrder, vq.displayLogicAction, vq.displayLogicMatchType
    FROM versionedQuestionConditionGroups vqcg
      JOIN versionedQuestions vq ON vqcg.versionedQuestionId = vq.id
        JOIN versionedSections vs ON vq.versionedSectionId = vs.id
        LEFT JOIN versionedQuestions tvq ON tvq.questionId = vqcg.triggerQuestionId
          AND tvq.versionedTemplateId = vq.versionedTemplateId
        LEFT JOIN versionedQuestionConditions vqc ON vqcg.id = vqc.versionedQuestionConditionGroupId
    WHERE vq.versionedTemplateId = ?
    ORDER BY vqcg.id, vqc.id`;
  const rows: PlanConditionalLogicRow[] = await VersionedQuestionConditionGroup.query(
    context, sql, [plan.versionedTemplateId.toString()], reference
  );
  // The template has no display logic
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const questionsById = new Map<number, PlanConditionalLogicRow>();
  const sectionDisplayOrder = new Map<number, number>();
  const triggerIds = new Set<number>();
  for (const row of rows) {
    questionsById.set(row.versionedQuestionId, row);
    sectionDisplayOrder.set(row.versionedSectionId, row.sectionDisplayOrder);
    if (row.triggerVersionedQuestionId != null) triggerIds.add(row.triggerVersionedQuestionId);
  }
  const questions = [...questionsById.values()].map((row) => ({
    id: row.versionedQuestionId,
    versionedSectionId: row.versionedSectionId,
    displayOrder: row.displayOrder,
    displayLogicAction: row.displayLogicAction,
    displayLogicMatchType: row.displayLogicMatchType,
  }));

  const answers: Answer[] = await Answer.findFilledAnswersByQuestionIds(reference, context, plan.id, [...triggerIds]);
  const answersByQuestionId = new Map<number, Answer>(answers.map((a: Answer): [number, Answer] => [a.versionedQuestionId, a]));

  const hidden = findHiddenVersionedQuestionIds(
    questions, sectionDisplayOrder, groupConditionalLogicRows(rows), answersByQuestionId
  );
  return [...hidden];
}
