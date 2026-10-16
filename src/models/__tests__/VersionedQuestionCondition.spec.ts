import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

//Dynamic imports AFTER all mocks are registered
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { VersionedQuestionCondition } = await import('../VersionedQuestionCondition.js');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('QuestionCondition', () => {
  let versionedQuestionCondition;

  const versionedQuestionConditionData = {
    versionedQuestionConditionGroupId: casual.integer(1, 9999),
    conditionType: "EQUAL",
    conditionMatch: casual.words(3),
  }
  beforeEach(() => {
    versionedQuestionCondition = new VersionedQuestionCondition(versionedQuestionConditionData);
  });

  it('should initialize options as expected', () => {
    expect(versionedQuestionCondition.versionedQuestionConditionGroupId).toEqual(versionedQuestionConditionData.versionedQuestionConditionGroupId);
    expect(versionedQuestionCondition.conditionType).toEqual(versionedQuestionConditionData.conditionType);
    expect(versionedQuestionCondition.conditionMatch).toEqual(versionedQuestionConditionData.conditionMatch);
  });

  it('isValid returns true when the record is valid', async () => {
    expect(await versionedQuestionCondition.isValid()).toBe(true);
  });

  it('isValid returns false if the versionedQuestionConditionGroupId is null', async () => {
    versionedQuestionCondition.versionedQuestionConditionGroupId = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['versionedQuestionConditionGroupId'].includes('Versioned Question Condition Group')).toBe(true);
  });

  it('isValid returns false if the conditionType is null', async () => {
    versionedQuestionCondition.conditionType = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['conditionType'].includes('Condition Type')).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = VersionedQuestionCondition.query;

  let localQuery;
  let context;
  let versionedQuestionCondition;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedQuestionCondition.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedQuestionCondition = new VersionedQuestionCondition({
      id: casual.integer(1, 9),
      versionedQuestionConditionGroupId: casual.integer(1, 999),
      conditionType: "EQUAL",
      conditionMatch: casual.words(5),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedQuestionCondition.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([versionedQuestionCondition]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionCondition.findById('testing', context, id);
    const expectedSql = 'SELECT * FROM versionedQuestionConditions WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing');
    expect(result).toEqual(versionedQuestionCondition);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionCondition.findById('testing', context, id);
    expect(result).toEqual(null);
  });
});

describe('create', () => {
  let insertQuery;
  let versionedQuestionCondition;

  beforeEach(() => {
    insertQuery = jest.fn();
    (VersionedQuestionCondition.insert as jest.Mock) = insertQuery;

    versionedQuestionCondition = new VersionedQuestionCondition({
      versionedQuestionConditionGroupId: casual.integer(1, 999),
      conditionType: "EQUAL",
      conditionMatch: casual.words(3),
    })
  });

  it('returns the VersionedQuestionCondition with errors if it is not valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (versionedQuestionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await versionedQuestionCondition.create(context);
    expect(result).toBeInstanceOf(VersionedQuestionCondition);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the newly added VersionedQuestionCondition', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (versionedQuestionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindBy = jest.fn<() => Promise<InstanceType<typeof VersionedQuestionCondition> | null>>();
    (VersionedQuestionCondition.findById as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValue(versionedQuestionCondition);

    const result = await versionedQuestionCondition.create(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(VersionedQuestionCondition);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});

describe('findByVersionedQuestionConditionGroupId', () => {
  const originalQuery = VersionedQuestionCondition.query;

  let localQuery;
  let context;
  let versionedQuestionCondition;

  beforeEach(async () => {
    // jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedQuestionCondition.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedQuestionCondition = new VersionedQuestionCondition({
      versionedQuestionConditionGroupId: casual.integer(1, 999),
      conditionType: "EQUAL",
      conditionMatch: casual.words(3),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedQuestionCondition.query = originalQuery;
  });

  it('should call query with correct params and return the default when findByVersionedQuestionConditionGroupId called', async () => {
    localQuery.mockResolvedValueOnce([versionedQuestionCondition]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionCondition.findByVersionedQuestionConditionGroupId('testing', context, id);
    const expectedSql = 'SELECT * FROM versionedQuestionConditions WHERE versionedQuestionConditionGroupId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing');
    expect(result[0]).toBeInstanceOf(VersionedQuestionCondition);
  });
});