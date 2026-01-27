import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { Answer } from "../Answer";
import { logger } from "../../logger";
import { CURRENT_SCHEMA_VERSION, DefaultResearchOutputTableAnswer } from "@dmptool/types";
import { Question } from "../Question";
import { removeNullAndUndefinedFromJSON } from "../../utils/helpers";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Answer', () => {
  let answer;

  const answerData = {
    planId: casual.integer(1, 9999),
    versionedQuestionId: casual.integer(1, 9999),
    versionedSectionId: casual.integer(1, 9999),
    json: "{\"type\":\"textArea\",\"answer\":\"California\",\"meta\":{\"schemaVersion\":\"${CURRENT_SCHEMA_VERSION}\"}}"
  }
  beforeEach(() => {
    answer = new Answer(answerData);
  });

  it('should initialize options as expected', () => {
    expect(answer.planId).toEqual(answerData.planId);
    expect(answer.versionedSectionId).toEqual(answerData.versionedSectionId);
    expect(answer.versionedQuestionId).toEqual(answerData.versionedQuestionId);
    expect(answer.json).toEqual(answerData.json);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await answer.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the versionedSectionId field is missing', async () => {
    answer.versionedSectionId = null;
    expect(await answer.isValid()).toBe(false);
    expect(Object.keys(answer.errors).length).toBe(1);
    expect(answer.errors['versionedSectionId']).toBeTruthy();
  });

  it('should return false when calling isValid if the versionedQuestionId field is missing', async () => {
    answer.versionedQuestionId = null;
    expect(await answer.isValid()).toBe(false);
    expect(Object.keys(answer.errors).length).toBe(1);
    expect(answer.errors['versionedQuestionId']).toBeTruthy();
  });

  it('should return false when calling isValid if the planId field is missing', async () => {
    answer.planId = null;
    expect(await answer.isValid()).toBe(false);
    expect(Object.keys(answer.errors).length).toBe(1);
    expect(answer.errors['planId']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = Answer.query;

  let localQuery;
  let context;
  let answer;

  beforeEach(async () => {
    localQuery = jest.fn();
    (Answer.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    answer = new Answer({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      versionedQuestionId: casual.integer(1, 9999),
      versionedSectionId: casual.integer(1, 9999),
      json: `{"type":"textArea","answer":"${casual.sentences(3)}","meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Answer.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([answer]);
    const answerId = casual.integer(1, 999);
    const result = await Answer.findById('testing', context, answerId);
    const expectedSql = 'SELECT * FROM answers WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [answerId.toString()], 'testing')
    expect(result).toEqual(answer);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const answerId = casual.integer(1, 999);
    const result = await Answer.findById('testing', context, answerId);
    expect(result).toEqual(null);
  });

  it('findByPlanIdAndVersionedQuestionId should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([answer]);
    const planId = casual.integer(1, 9999);
    const versionedQuestionId = casual.integer(1, 9999);
    const result = await Answer.findByPlanIdAndVersionedQuestionId('testing', context, planId, versionedQuestionId);
    const expectedSql = 'SELECT * FROM answers WHERE planId = ? AND versionedQuestionId = ?';
    const expectedVals = [planId.toString(), versionedQuestionId.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, expectedVals, 'testing')
    expect(result).toEqual(answer);
  });

  it('findByPlanIdAndVersionedQuestionId should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const versionedQuestionId = casual.integer(1, 9999);
    const result = await Answer.findByPlanIdAndVersionedQuestionId('testing', context, planId, versionedQuestionId);
    expect(result).toEqual(null);
  });

  it('findByPlanIdAndVersionedSectionId should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([answer]);
    const planId = casual.integer(1, 9999);
    const versionedSectionId = casual.integer(1, 9999);
    const result = await Answer.findByPlanIdAndVersionedSectionId('testing', context, planId, versionedSectionId);
    const expectedSql = 'SELECT * FROM answers WHERE planId = ? AND versionedSectionId = ?';
    const vals = [planId.toString(), versionedSectionId.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, vals, 'testing')
    expect(result).toEqual([answer]);
  });

  it('findFilledAnswersByQuestionIds should call query with correct params and return the objects', async () => {
    const planId = casual.integer(1, 9999);
    // Mock the localQuery to return an array of answers, these are the same answer repeated, but the mock simply
    // returns what is written here if it's called. So mocking additional different answers doesn't add additional value to the test.
    localQuery.mockResolvedValueOnce([answer, answer, answer]);
    const questionIds = [ casual.integer(1, 9999), casual.integer(1, 9999), casual.integer(1, 9999)];
    const result = await Answer.findFilledAnswersByQuestionIds('testing', context, planId, questionIds);
    const expectedSql = 'SELECT * FROM answers WHERE planId = ? AND versionedQuestionId IN (?, ?, ?) AND json IS NOT NULL AND json != \'\'';
    const vals = questionIds.map(String)
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [String(planId), ...vals], 'testing')
    expect(result).toEqual([answer, answer, answer]);
  });

  it('findByPlanIdAndVersionedSectionId should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const versionedSectionId = casual.integer(1, 9999);
    const result = await Answer.findByPlanIdAndVersionedSectionId('testing', context, planId, versionedSectionId);
    expect(result).toEqual([]);
  });

  it('findByPlanId should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([answer]);
    const planId = casual.integer(1, 9999);
    const result = await Answer.findByPlanId('testing', context, planId);
    const expectedSql = 'SELECT * FROM answers WHERE planId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString()], 'testing')
    expect(result).toEqual([answer]);
  });

  it('findByPlanId should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const result = await Answer.findByPlanId('testing', context, planId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let answer;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Answer.update as jest.Mock) = updateQuery;

    answer = new Answer({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      versionedQuestionId: casual.integer(1, 9999),
      versionedSectionId: casual.integer(1, 9999),
      json: "{\"type\":\"textArea\",\"answer\":\"California\",\"meta\":{\"schemaVersion\":\"${CURRENT_SCHEMA_VERSION}\"}}"
    })
  });

  it('returns the Answer with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (answer.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await answer.update(context);
    expect(result instanceof Answer).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Answer has no id', async () => {
    const localValidator = jest.fn();
    (answer.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    answer.id = null;
    const result = await answer.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated Answer', async () => {
    const localValidator = jest.fn();
    (answer.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(answer);

    const mockFindById = jest.fn();
    (Answer.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answer);

    const result = await answer.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Answer);
  });
});

describe('create', () => {
  const originalInsert = Answer.insert;
  let insertQuery;
  let answer;

  beforeEach(() => {
    insertQuery = jest.fn();
    (Answer.insert as jest.Mock) = insertQuery;

    answer = new Answer({
      planId: casual.integer(1, 9999),
      versionedQuestionId: casual.integer(1, 9999),
      versionedSectionId: casual.integer(1, 9999),
      json: "{\"type\":\"textArea\",\"answer\":\"California\",\"meta\":{\"schemaVersion\":\"${CURRENT_SCHEMA_VERSION}\"}}"
    });
  });

  afterEach(() => {
    Answer.insert = originalInsert;
  });

  it('returns the Answer without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (answer.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await answer.create(context);
    expect(result instanceof Answer).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the Answer with errors if it is invalid', async () => {
    answer.planId = undefined;
    const response = await answer.create(context);
    expect(response.errors['planId']).toBe('Plan can\'t be blank');
  });

  it('returns the Answer with an error if the object already exists', async () => {
    const mockFindByPlanIdAndVersionedQuestionId = jest.fn();
    (Answer.findByPlanIdAndVersionedQuestionId as jest.Mock) = mockFindByPlanIdAndVersionedQuestionId;
    mockFindByPlanIdAndVersionedQuestionId.mockResolvedValueOnce(answer);

    const result = await answer.create(context);
    expect(mockFindByPlanIdAndVersionedQuestionId).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added Answer', async () => {
    const mockFindByPlanIdAndVersionedQuestionId = jest.fn();
    (Answer.findByPlanIdAndVersionedQuestionId as jest.Mock) = mockFindByPlanIdAndVersionedQuestionId;
    mockFindByPlanIdAndVersionedQuestionId.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (Answer.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answer);

    const result = await answer.create(context);
    expect(mockFindByPlanIdAndVersionedQuestionId).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Answer);
  });
});

describe('delete', () => {
  let answer;

  beforeEach(() => {
    answer = new Answer({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      versionedQuestionId: casual.integer(1, 9999),
      versionedSectionId: casual.integer(1, 9999),
      json: "{\"type\":\"textArea\",\"answer\":\"California\",\"meta\":{\"schemaVersion\":\"${CURRENT_SCHEMA_VERSION}\"}}"
    });
  })

  it('returns null if the Answer has no id', async () => {
    answer.id = null;
    expect(await answer.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Answer.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await answer.delete(context)).toBe(null);
  });

  it('returns the Answer if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Answer.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(answer);

    const mockFindById = jest.fn();
    (Answer.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answer);

    const result = await answer.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Answer);
  });
});

describe('ResearchOutputTable Answer', () => {
  let answer;

  const json = DefaultResearchOutputTableAnswer;
  const answerData = {
    planId: casual.integer(1, 9),
    versionedSectionId: casual.integer(1, 9),
    versionedQuestionId: casual.integer(1, 9),
    json: JSON.stringify(json)
  }
  beforeEach(() => {
    answer = new Answer(answerData);
  });

  it('should initialize options as expected', () => {
    expect(answer.json).toEqual(answerData.json);
  });

  it('should call removeNullAndUndefinedFromJSON and set json as a string', () => {
    const parsedJSON = removeNullAndUndefinedFromJSON(answerData.json);
    expect(parsedJSON).toEqual(answerData.json);
    expect(answer.json).toEqual(parsedJSON);
    expect(typeof answer.json).toBe('string');
  });

  it('should add an error if removeNullAndUndefinedFromJSON fails', () => {
    const invalidJSON = '{"type":"textArea","meta":{"asRichText":true,"schemaVersion":"invalidVersion"';
    const q = new Question({ ...answerData, json: invalidJSON });
    expect(q.errors['json']).toBeTruthy();
    expect(q.errors['json'].includes('Invalid JSON format')).toBe(true);
  });

  it('should not be valid if the JSON is missing', async () => {
    answer.json = null;
    expect(await answer.isValid()).toBe(false);
    expect(answer.errors['json']).toBeTruthy();
    expect(answer.errors['json']).toEqual('Answer JSON can\'t be blank');
    answer.json = answerData.json; // Reset to valid JSON
  });

  it('should not be valid if the JSON is for an unknown question type', async () => {
    answer.json = `{"type":"unknownType","meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`;
    expect(await answer.isValid()).toBe(false);
    expect(answer.errors['json']).toBeTruthy();
    expect(answer.errors['json'].includes('Unknown answer type')).toBe(true);
    answer.json = answerData.json; // Reset to valid JSON
  });

  it('should not be valid if Zod parse fails', async () => {
    answer.json = `{"type":"textArea","answer":["foo","bar"]}`;
    expect(await answer.isValid()).toBe(false);
    expect(answer.errors['json']).toBeTruthy();
    expect(answer.errors['json'].includes('answer')).toBe(true);
    answer.json = answerData.json; // Reset to valid JSON
  });

  it('should return true when calling isValid', async () => {
    expect(await answer.isValid()).toBe(true);
  });
});
