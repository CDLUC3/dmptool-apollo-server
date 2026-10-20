import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import type { MyContext } from "../../context.js";

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { VersionedQuestionConditionGroup } = await import("../../models/VersionedQuestionConditionGroups.js");
const { Answer } = await import("../../models/Answer.js");
const {
  findConditionalLogicForPlan,
  findHiddenVersionedQuestionIds,
  findHiddenVersionedQuestionIdsForPlan
} = await import("../conditionalLogicService.js");

let context: MyContext;

beforeEach(async () => {
  jest.resetAllMocks();
  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('findConditionalLogicForPlan', () => {
  const originalQuery = VersionedQuestionConditionGroup.query;

  afterEach(() => {
    VersionedQuestionConditionGroup.query = originalQuery;
  });

  it('returns an empty map when no section ids are provided', async () => {
    const result = await findConditionalLogicForPlan('testing', context, undefined as never);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('queries for the matching section ids and groups conditions by group and versionedQuestionId', async () => {
    const sectionIds = [casual.integer(1, 999), casual.integer(1000, 1999)];
    const localQuery = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;

    const firstQuestionId = casual.integer(1, 999);
    const secondQuestionId = casual.integer(1000, 1999);

    const results = [
      {
        groupId: 1,
        versionedQuestionId: firstQuestionId,
        triggerVersionedQuestionId: 101,
        conditionType: 'EQUAL',
        conditionMatch: 'yes'
      },
      {
        groupId: 1,
        versionedQuestionId: firstQuestionId,
        triggerVersionedQuestionId: 101,
        conditionType: 'EQUAL',
        conditionMatch: 'maybe'
      },
      {
        groupId: 2,
        versionedQuestionId: firstQuestionId,
        triggerVersionedQuestionId: 102,
        conditionType: 'INCLUDES',
        conditionMatch: 'Oregon'
      },
      {
        groupId: 3,
        versionedQuestionId: secondQuestionId,
        triggerVersionedQuestionId: 201,
        conditionType: 'DOES_NOT_EQUAL',
        conditionMatch: 'no'
      }
    ];

    localQuery.mockResolvedValueOnce(results);

    const result = await findConditionalLogicForPlan('testing', context, sectionIds);

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(
      context,
      expect.stringContaining('WHERE vq.versionedSectionId IN (?,?)'),
      sectionIds.map(String),
      'testing'
    );

    expect(result).toBeInstanceOf(Map);
    expect(result.get(firstQuestionId)).toEqual([
      {
        id: 1,
        triggerVersionedQuestionId: 101,
        conditions: [
          { conditionType: 'EQUAL', conditionMatch: 'yes' },
          { conditionType: 'EQUAL', conditionMatch: 'maybe' }
        ]
      },
      {
        id: 2,
        triggerVersionedQuestionId: 102,
        conditions: [{ conditionType: 'INCLUDES', conditionMatch: 'Oregon' }]
      }
    ]);
    expect(result.get(secondQuestionId)).toEqual([
      {
        id: 3,
        triggerVersionedQuestionId: 201,
        conditions: [{ conditionType: 'DOES_NOT_EQUAL', conditionMatch: 'no' }]
      }
    ]);
  });

  it('maps the trigger question to its versionedQuestionId within the same versionedTemplate', async () => {
    const localQuery = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;
    localQuery.mockResolvedValueOnce([]);

    await findConditionalLogicForPlan('testing', context, [1]);

    const sql = localQuery.mock.calls[0][1] as string;
    expect(sql).toContain('LEFT JOIN versionedQuestions tvq ON tvq.questionId = vqcg.triggerQuestionId');
    expect(sql).toContain('AND tvq.versionedTemplateId = vq.versionedTemplateId');
  });

  it('keeps groups whose trigger question is not in the versioned template, or that have no conditions', async () => {
    const localQuery = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;
    localQuery.mockResolvedValueOnce([
      { groupId: 1, versionedQuestionId: 10, triggerVersionedQuestionId: null, conditionType: 'EQUAL', conditionMatch: 'yes' },
      { groupId: 2, versionedQuestionId: 10, triggerVersionedQuestionId: 101, conditionType: null, conditionMatch: null },
    ]);

    const result = await findConditionalLogicForPlan('testing', context, [1]);

    expect(result.get(10)).toEqual([
      { id: 1, triggerVersionedQuestionId: null, conditions: [{ conditionType: 'EQUAL', conditionMatch: 'yes' }] },
      { id: 2, triggerVersionedQuestionId: 101, conditions: [] },
    ]);
  });
});

describe('findHiddenVersionedQuestionIds', () => {
  const sections = new Map([[1, 1]]);
  const question = (id: number, displayOrder: number, displayLogicAction = null, displayLogicMatchType = null, versionedSectionId = 1) => ({
    id,
    versionedSectionId,
    displayOrder,
    displayLogicAction,
    displayLogicMatchType,
  });
  const group = (id: number, triggerVersionedQuestionId: number | null, conditionMatch: string) => ({
    id,
    triggerVersionedQuestionId,
    conditions: [{ conditionType: 'EQUAL' as const, conditionMatch }],
  });
  const answer = (value: string) => ({ json: JSON.stringify({ type: 'radioButtons', answer: value }) });

  it('hides a question when its HIDE_QUESTION logic matches the saved answer', () => {
    const questions = [question(1, 1), question(2, 2, 'HIDE_QUESTION', 'ANY')];
    const logic = new Map([[2, [group(1, 1, 'yes')]]]);

    expect(findHiddenVersionedQuestionIds(questions, sections, logic, new Map([[1, answer('yes')]]))).toEqual(new Set([2]));
    expect(findHiddenVersionedQuestionIds(questions, sections, logic, new Map([[1, answer('no')]]))).toEqual(new Set());
  });

  it('does not apply the logic when the trigger question is unanswered', () => {
    const questions = [question(1, 1), question(2, 2, 'SHOW_QUESTION', 'ALL')];
    const logic = new Map([[2, [group(1, 1, 'yes')]]]);

    expect(findHiddenVersionedQuestionIds(questions, sections, logic, new Map())).toEqual(new Set());
  });

  it('treats a trigger question that is not in the versioned template as unanswered', () => {
    const questions = [question(2, 2, 'SHOW_QUESTION', 'ALL')];
    const logic = new Map([[2, [group(1, null, 'yes')]]]);

    expect(findHiddenVersionedQuestionIds(questions, sections, logic, new Map())).toEqual(new Set());
  });

  it('evaluates questions in display order so a hidden trigger question is treated as unanswered', () => {
    // Question 2 is hidden when question 1 is 'yes'. Question 3 is hidden when question 2 is 'a', but
    // because question 2 is hidden its answer is ignored. The questions are passed out of order
    const questions = [
      question(3, 3, 'HIDE_QUESTION', 'ANY'),
      question(2, 2, 'HIDE_QUESTION', 'ANY'),
      question(1, 1),
    ];
    const logic = new Map([
      [2, [group(1, 1, 'yes')]],
      [3, [group(2, 2, 'a')]],
    ]);
    const answers = new Map([[1, answer('yes')], [2, answer('a')]]);

    expect(findHiddenVersionedQuestionIds(questions, sections, logic, answers)).toEqual(new Set([2]));
  });

  it('evaluates earlier sections first, using the section displayOrder rather than the versionedSectionId', () => {
    // Section 50 is displayed before section 10. Question 1 (section 50) hides question 2 (section 50),
    // whose answer would otherwise hide question 3 (section 10)
    const sectionOrder = new Map([[50, 1], [10, 2]]);
    const questions = [
      question(3, 1, 'HIDE_QUESTION', 'ANY', 10),
      question(2, 2, 'HIDE_QUESTION', 'ANY', 50),
      question(1, 1, null, null, 50),
    ];
    const logic = new Map([
      [2, [group(1, 1, 'yes')]],
      [3, [group(2, 2, 'a')]],
    ]);
    const answers = new Map([[1, answer('yes')], [2, answer('a')]]);

    expect(findHiddenVersionedQuestionIds(questions, sectionOrder, logic, answers)).toEqual(new Set([2]));
  });
});

describe('findHiddenVersionedQuestionIdsForPlan', () => {
  const originalQuery = VersionedQuestionConditionGroup.query;
  const originalFindAnswers = Answer.findFilledAnswersByQuestionIds;
  let localQuery: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
  let localFindAnswers: jest.Mock<(...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    localQuery = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;
    localFindAnswers = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (Answer.findFilledAnswersByQuestionIds as jest.Mock) = localFindAnswers;
  });

  afterEach(() => {
    VersionedQuestionConditionGroup.query = originalQuery;
    Answer.findFilledAnswersByQuestionIds = originalFindAnswers;
  });

  const row = (overrides: Record<string, unknown>) => ({
    groupId: 1,
    versionedQuestionId: 20,
    triggerVersionedQuestionId: 10,
    conditionType: 'EQUAL',
    conditionMatch: 'yes',
    versionedSectionId: 5,
    displayOrder: 2,
    sectionDisplayOrder: 1,
    displayLogicAction: 'HIDE_QUESTION',
    displayLogicMatchType: 'ANY',
    ...overrides,
  });

  it('returns an empty array without querying when the plan has no versionedTemplateId', async () => {
    const result = await findHiddenVersionedQuestionIdsForPlan('testing', context, { id: 1, versionedTemplateId: null });

    expect(result).toEqual([]);
    expect(localQuery).not.toHaveBeenCalled();
  });

  it('does not load any answers when the template has no display logic', async () => {
    localQuery.mockResolvedValueOnce([]);

    const result = await findHiddenVersionedQuestionIdsForPlan('testing', context, { id: 1, versionedTemplateId: 7 });

    expect(result).toEqual([]);
    expect(localQuery).toHaveBeenLastCalledWith(
      context,
      expect.stringContaining('WHERE vq.versionedTemplateId = ?'),
      ['7'],
      'testing'
    );
    expect(localFindAnswers).not.toHaveBeenCalled();
  });

  it('loads only the trigger question answers and returns the hidden question ids', async () => {
    localQuery.mockResolvedValueOnce([
      row({ groupId: 1, versionedQuestionId: 20, triggerVersionedQuestionId: 10, conditionMatch: 'yes' }),
      row({ groupId: 2, versionedQuestionId: 30, triggerVersionedQuestionId: 11, conditionMatch: 'yes', displayOrder: 3 }),
    ]);
    localFindAnswers.mockResolvedValueOnce([
      { versionedQuestionId: 10, json: JSON.stringify({ type: 'radioButtons', answer: 'yes' }) },
      { versionedQuestionId: 11, json: JSON.stringify({ type: 'radioButtons', answer: 'no' }) },
    ]);

    const result = await findHiddenVersionedQuestionIdsForPlan('testing', context, { id: 1, versionedTemplateId: 7 });

    expect(localFindAnswers).toHaveBeenCalledWith('testing', context, 1, [10, 11]);
    expect(result).toEqual([20]);
  });
});
