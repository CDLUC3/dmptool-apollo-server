import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context.js";

import { QuestionCondition } from "../QuestionCondition.js";
import { logger } from "../../logger.js";

jest.mock('../../context.js')

describe('QuestionCondition', () => {
  let questionCondition;

  const questionConditionData = {
    conditionType: "EQUAL",
    conditionMatch: "Apples",
    groupId: 1
  };
  beforeEach(() => {
    questionCondition = new QuestionCondition(questionConditionData);
  });

  it('should initialize options as expected', () => {
    expect(questionCondition.conditionType).toEqual("EQUAL");
    expect(questionCondition.conditionMatch).toEqual(questionConditionData.conditionMatch);
    expect(questionCondition.groupId).toEqual(questionConditionData.groupId);
  });

  it('should return true when calling isValid with a name field', async () => {
    expect(await questionCondition.isValid()).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = QuestionCondition.query;

  let localQuery;
  let context;
  let questionCondition;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (QuestionCondition.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    questionCondition = new QuestionCondition({
      conditionType: "EQUAL",
      conditionMatch: casual.words(5),
      groupId: casual.integer(1, 9999),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    QuestionCondition.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([questionCondition]);
    const id = casual.integer(1, 999);
    const result = await QuestionCondition.findById('testing', context, id);
    const expectedSql = 'SELECT * FROM questionConditions WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing');
    expect(result).toEqual(questionCondition);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = casual.integer(1, 999);
    const result = await QuestionCondition.findById('testing', context, id);
    expect(result).toEqual(null);
  });

  it('findByGroupId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([questionCondition]);
    const groupId = casual.integer(1, 999);
    const result = await QuestionCondition.findByGroupId('testing', context, groupId);
    const expectedSql = 'SELECT * FROM questionConditions WHERE groupId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [groupId.toString()], 'testing');
    expect(result).toEqual([questionCondition]);
  });

  it('findByGroupId should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const groupId = casual.integer(1, 999);
    const result = await QuestionCondition.findByGroupId('testing', context, groupId);
    expect(result).toEqual([]);
  });
});

describe('create', () => {
  const originalInsert = QuestionCondition.insert;
  let insertQuery;
  let findByIdQuery;
  let context
  let questionCondition;

  beforeEach(async () => {
    // jest.resetAllMocks();

    insertQuery = jest.fn();
    (QuestionCondition.insert as jest.Mock) = insertQuery;
    findByIdQuery = jest.fn();
    (QuestionCondition.findById as jest.Mock) = findByIdQuery;

    context = await buildMockContextWithToken(logger);

    questionCondition = new QuestionCondition({
      conditionType: "EQUAL",
      conditionMatch: casual.words(5),
      groupId: casual.integer(1, 9999),
    });
  });

  afterEach(() => {
    // jest.resetAllMocks();
    QuestionCondition.insert = originalInsert;
  });

  it('returns the QuestionCondition without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (questionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);
    findByIdQuery.mockResolvedValueOnce(questionCondition);

    const result = await questionCondition.create(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionCondition);
  });

  it('returns the QuestionCondition with an error if questionId is undefined', async () => {
    questionCondition.groupId = undefined;
    const response = await questionCondition.create(context);
    expect(response.errors['groupId']).toBe('Group Id can\'t be blank');
  });

  it('returns the QuestionCondition with an error if conditionType is undefined', async () => {
    questionCondition.conditionType = undefined;
    const response = await questionCondition.create(context);
    expect(response.errors['conditionType']).toBe('Condition Type can\'t be blank');
  });

  it('returns the newly added QuestionCondition', async () => {
    const localValidator = jest.fn();
    (questionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn();
    (QuestionCondition.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionCondition);

    const result = await questionCondition.create(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionCondition);
  });
});

describe('update', () => {
  let updateQuery;
  let findByIdQuery;
  let context;
  let questionCondition;

  beforeEach(async () => {
    updateQuery = jest.fn();
    (QuestionCondition.update as jest.Mock) = updateQuery;
    findByIdQuery = jest.fn();
    (QuestionCondition.findById as jest.Mock) = findByIdQuery;

    context = await buildMockContextWithToken(logger);

    questionCondition = new QuestionCondition({
      id: casual.integer(1, 9),
      conditionType: "EQUAL",
      conditionMatch: casual.words(5),
      groupId: casual.integer(1, 9999),
    });
  });

  it('returns the QuestionCondition with errors if it is not valid', async () => {
    questionCondition.groupId = null;

    const result = await questionCondition.update(context);
    expect(result.errors['groupId']).toEqual('Group Id can\'t be blank');
    expect(updateQuery).toHaveBeenCalledTimes(0);
    expect(findByIdQuery).toHaveBeenCalledTimes(0);
  });

  it('returns an error if the QuestionCondition has no id', async () => {
    const localValidator = jest.fn();
    (questionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    questionCondition.id = null;
    const result = await questionCondition.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated QuestionCondition', async () => {
    updateQuery.mockResolvedValueOnce(questionCondition);
    findByIdQuery.mockResolvedValueOnce(questionCondition);

    const mockFindById = jest.fn();
    (QuestionCondition.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionCondition);

    const result = await questionCondition.update(context);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionCondition);
  });
});

describe('delete', () => {
  let questionCondition;
  let context;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);

    questionCondition = new QuestionCondition({
      id: casual.integer(1, 9),
      conditionType: "EQUAL",
      conditionMatch: casual.words(5),
      groupId: casual.integer(1, 9999),
    });
  });

  it('returns null if the QuestionCondition has no id', async () => {
    questionCondition.id = null;
    expect(await questionCondition.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (QuestionCondition.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await questionCondition.delete(context)).toBe(null);
  });

  it('returns the QuestionCondition if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (QuestionCondition.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(questionCondition);

    const mockFindById = jest.fn();
    (QuestionCondition.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(questionCondition);

    const result = await questionCondition.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(QuestionCondition);
  });
});
