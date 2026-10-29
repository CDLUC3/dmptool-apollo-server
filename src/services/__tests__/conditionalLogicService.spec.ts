import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import type { MyContext } from "../../context.js";

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { VersionedQuestionConditionGroup } = await import("../../models/VersionedQuestionConditionGroups.js");
const { findConditionalLogicForPlan } = await import("../conditionalLogicService.js");

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

  it('queries for the matching section ids and groups results by versionedQuestionId', async () => {
    const sectionIds = [casual.integer(1, 999), casual.integer(1000, 1999)];
    const localQuery = jest.fn<(...args: unknown[]) => Promise<unknown>>();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;

    const firstQuestionId = casual.integer(1, 999);
    const secondQuestionId = casual.integer(1000, 1999);

    const results = [
      {
        versionedQuestionId: firstQuestionId,
        triggerQuestionId: 101,
        conditionType: 'SHOW',
        conditionMatch: 'not_empty'
      },
      {
        versionedQuestionId: firstQuestionId,
        triggerQuestionId: 102,
        conditionType: 'SHOW',
        conditionMatch: 'equals'
      },
      {
        versionedQuestionId: secondQuestionId,
        triggerQuestionId: 201,
        conditionType: 'HIDE',
        conditionMatch: 'empty'
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
    expect(result.get(firstQuestionId)).toEqual([results[0], results[1]]);
    expect(result.get(secondQuestionId)).toEqual([results[2]]);
  });
});
