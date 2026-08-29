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
const { QuestionConditionGroup } = await import('../QuestionConditionGroup.js');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('QuestionConditionGroup', () => {
  let questionConditionGroup;

  const questionConditionGroupData = {
    questionId: casual.integer(1, 9),
    triggerQuestionId: casual.integer(1, 9),
  }

  beforeEach(() => {
    questionConditionGroup = new QuestionConditionGroup(questionConditionGroupData);
  });

  it('should initialize options as expected', () => {
    expect(questionConditionGroup.questionId).toEqual(questionConditionGroupData.questionId);
    expect(questionConditionGroup.triggerQuestionId).toEqual(questionConditionGroupData.triggerQuestionId);
  });

  it('should not be valid if the questionId is missing', async () => {
    questionConditionGroup.questionId = null;
    expect(await questionConditionGroup.isValid()).toBe(false);
    expect(questionConditionGroup.errors['questionId']).toBeTruthy();
    expect(questionConditionGroup.errors['questionId']).toEqual('Question Id can\'t be blank');
    questionConditionGroup.questionId = questionConditionGroupData.questionId; // Reset to valid questionId
  });

  it('should not be valid if the triggerQuestionId is missing', async () => {
    questionConditionGroup.triggerQuestionId = null;
    expect(await questionConditionGroup.isValid()).toBe(false);
    expect(questionConditionGroup.errors['triggerQuestionId']).toBeTruthy();
    expect(questionConditionGroup.errors['triggerQuestionId']).toEqual('Trigger Question Id can\'t be blank');
    questionConditionGroup.triggerQuestionId = questionConditionGroupData.triggerQuestionId; // Reset to valid triggerQuestionId
  });

  it('should return true when calling isValid', async () => {
    expect(await questionConditionGroup.isValid()).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = QuestionConditionGroup.query;

  let localQuery;
  let context;
  let questionConditionGroup;

  beforeEach(async () => {
    localQuery = jest.fn();
    (QuestionConditionGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    questionConditionGroup = new QuestionConditionGroup({
      id: casual.integer(1, 9),
      questionId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    QuestionConditionGroup.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([questionConditionGroup]);
    const questionConditionGroupId = casual.integer(1, 999);
    const result = await QuestionConditionGroup.findById('testing', context, questionConditionGroupId);
    const expectedSql = 'SELECT * FROM questionConditionGroups WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [questionConditionGroupId.toString()], 'testing');
    expect(result).toEqual(questionConditionGroup);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const questionConditionGroupId = casual.integer(1, 999);
    const result = await QuestionConditionGroup.findById('testing', context, questionConditionGroupId);
    expect(result).toEqual(null);
  });

  it('findByQuestionId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([questionConditionGroup]);
    const questionId = casual.integer(1, 999);
    const result = await QuestionConditionGroup.findByQuestionId('testing', context, questionId);
    const expectedSql = 'SELECT * FROM questionConditionGroups WHERE questionId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [questionId.toString()], 'testing');
    expect(result).toEqual([questionConditionGroup]);
  });

  it('findByQuestionId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const questionId = casual.integer(1, 999);
    const result = await QuestionConditionGroup.findByQuestionId('testing', context, questionId);
    expect(result).toEqual([]);
  });
});

describe('create', () => {
  const originalInsert = QuestionConditionGroup.insert;
  let insertQuery;
  let questionConditionGroup;

  beforeEach(() => {
    insertQuery = jest.fn();
    (QuestionConditionGroup.insert as jest.Mock) = insertQuery;

    questionConditionGroup = new QuestionConditionGroup({
      id: casual.integer(1, 9),
      questionId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    })
  });

  afterEach(() => {
    QuestionConditionGroup.insert = originalInsert;
  });

  it('should return the QuestionConditionGroup without calling insert if it is not valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (questionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await questionConditionGroup.create(context);
    expect(result instanceof QuestionConditionGroup).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(0);
  });

  it('should return the QuestionConditionGroup with an error if questionId is undefined', async () => {
    questionConditionGroup.questionId = undefined;
    const response = await questionConditionGroup.create(context);
    expect(response.errors['questionId']).toBe('Question Id can\'t be blank');
  });

  it('should return the QuestionConditionGroup with an error if triggerQuestionId is undefined', async () => {
    questionConditionGroup.triggerQuestionId = undefined;
    const response = await questionConditionGroup.create(context);
    expect(response.errors['triggerQuestionId']).toBe('Trigger Question Id can\'t be blank');
  });

  it('should return the newly added QuestionConditionGroup', async () => {
    const mockFindById = jest.fn<() => Promise<InstanceType<typeof QuestionConditionGroup>>>();
    (QuestionConditionGroup.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionConditionGroup);

    const result = await questionConditionGroup.create(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionConditionGroup);
  });
});

describe('update', () => {
  let updateQuery;
  let questionConditionGroup;

  beforeEach(() => {
    updateQuery = jest.fn();
    (QuestionConditionGroup.update as jest.Mock) = updateQuery;

    questionConditionGroup = new QuestionConditionGroup({
      id: casual.integer(1, 9),
      questionId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    })
  });

  it('should return the QuestionConditionGroup with errors if it is not valid', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (questionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await questionConditionGroup.update(context);
    expect(result instanceof QuestionConditionGroup).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(0);
  });

  it('should return an error if the QuestionConditionGroup has no id', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (questionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    questionConditionGroup.id = null;
    const result = await questionConditionGroup.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('should return the updated QuestionConditionGroup', async () => {
    const localValidator = jest.fn<() => Promise<boolean>>();
    (questionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(questionConditionGroup);

    const mockFindById = jest.fn<() => Promise<InstanceType<typeof QuestionConditionGroup>>>();
    (QuestionConditionGroup.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionConditionGroup);

    const result = await questionConditionGroup.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionConditionGroup);
  });
});

describe('delete', () => {
  let questionConditionGroup;

  beforeEach(() => {
    questionConditionGroup = new QuestionConditionGroup({
      id: casual.integer(1, 9),
      questionId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    })
  })

  it('should return null if the QuestionConditionGroup has no id', async () => {
    questionConditionGroup.id = null;
    expect(await questionConditionGroup.delete(context)).toBe(null);
  });

  it('should return null if it was not able to delete the record', async () => {
    const mockFindById = jest.fn<() => Promise<InstanceType<typeof QuestionConditionGroup>>>();
    (QuestionConditionGroup.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionConditionGroup);

    const deleteQuery = jest.fn<() => Promise<Boolean>>();
    (QuestionConditionGroup.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(null);

    expect(await questionConditionGroup.delete(context)).toBe(null);
  });

  it('should return the QuestionConditionGroup if it was able to delete the record', async () => {
    const mockFindById = jest.fn<() => Promise<InstanceType<typeof QuestionConditionGroup>>>();
    (QuestionConditionGroup.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionConditionGroup);

    const deleteQuery = jest.fn<() => Promise<Boolean>>();
    (QuestionConditionGroup.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(questionConditionGroup);

    const result = await questionConditionGroup.delete(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(deleteQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionConditionGroup);
  });
}); 
