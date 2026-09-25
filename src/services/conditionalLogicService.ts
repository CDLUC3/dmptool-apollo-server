import {MyContext} from "../context.js";
import {
  VersionedQuestionConditionGroup
} from "../models/VersionedQuestionConditionGroups.js";

export interface VersionedQuestionConditionalLogic {
  versionedQuestionId: number;
  triggerQuestionId: number;
  conditionType: string;
  conditionMatch: string;
}

/**
 * Find all the conditional logic for all the questions for the specified versioned section ids
 *
 * @param reference The reference for the query
 * @param context The Apollo context
 * @param versionedSectionIds The versioned section ids to find the conditional logic for
 * @returns An array of VersionedQuestionConditionGroup objects
 */
export async function findConditionalLogicForPlan(
  reference: string,
  context: MyContext,
  versionedSectionIds: number[]
): Promise<Map<number, VersionedQuestionConditionalLogic[]>> {
  if (!versionedSectionIds || versionedSectionIds.length === 0) return new Map();

  const placeholder = versionedSectionIds.map(() => '?').join(',');
  const sql = `
    SELECT vgcg.versionedQuestionId, vgcg.triggerQuestionId,
      vqc.conditionType, vqc.conditionMatch
    FROM versionedQuestionConditionGroups vgcg
      JOIN versionedQuestions vq ON vgcg.versionedQuestionId = vq.id
        JOIN versionedQuestionConditions vqc ON vgcg.id = vqc.versionedQuestionConditionGroupId
    WHERE vq.versionedSectionId IN (${placeholder})`;

  const vals = versionedSectionIds.map(id => id.toString());
  const results: VersionedQuestionConditionalLogic[] = await VersionedQuestionConditionGroup.query(context, sql, vals, reference);

  const logicMap = new Map<number, VersionedQuestionConditionalLogic[]>();
  // Group the results by versionedQuestionId
  for (const result of results) {
    if (logicMap.has(result.versionedQuestionId)) {
      logicMap.get(result.versionedQuestionId)?.push(result);
    } else {
      logicMap.set(result.versionedQuestionId, [result]);
    }
  }
  return logicMap;
}
