import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { Question } from "../Question";
import {
  CURRENT_SCHEMA_VERSION,
  DefaultResearchOutputTableQuestion,
  DefaultTextAreaQuestion
} from "@dmptool/types";
import { removeNullAndUndefinedFromJSON } from "../../utils/helpers";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Question', () => {
  let question;

  const questionData = {
    templateId: casual.integer(1, 9),
    sectionId: casual.integer(1, 9),
    json: DefaultTextAreaQuestion,
    questionText: casual.sentences(5),
    requirementText: casual.sentences(3),
    guidanceText: casual.sentences(10),
    sampleText: casual.sentences(10),
    useSampleTextAsDefault: true,
    displayOrder: casual.integer(1, 20),
  }
  beforeEach(() => {
    question = new Question(questionData);
  });

  it('should initialize options as expected', () => {
    expect(question.json).toEqual(JSON.stringify(questionData.json));
    expect(question.questionText).toEqual(questionData.questionText);
    expect(question.requirementText).toEqual(questionData.requirementText);
    expect(question.guidanceText).toEqual(questionData.guidanceText);
    expect(question.sampleText).toEqual(questionData.sampleText);
    expect(question.useSampleTextAsDefault).toEqual(questionData.useSampleTextAsDefault);
    expect(question.displayOrder).toEqual(questionData.displayOrder);
    expect(question.required).toEqual(false);
  });

  it('should call removeNullAndUndefinedFromJSON and set json as a string', () => {
    const parsedJSON = removeNullAndUndefinedFromJSON(JSON.stringify(questionData.json));
    expect(parsedJSON).toEqual(JSON.stringify(questionData.json));
    expect(question.json).toEqual(parsedJSON);
    expect(typeof question.json).toBe('string');
  });

  it('should add an error if removeNullAndUndefinedFromJSON fails', () => {
    const invalidJSON = '{"type":"textArea","meta":{"asRichText":true,"schemaVersion":"invalidVersion"';
    const q = new Question({ ...questionData, json: invalidJSON });
    expect(q.errors['json']).toBeTruthy();
    expect(q.errors['json'].includes('Invalid JSON format')).toBe(true);
  });

  it('should not be valid if the JSON is missing', async () => {
    question.json = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json']).toEqual('Question type JSON can\'t be blank');
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if the JSON is for an unknown question type', async () => {
    question.json = `{"type":"unknownType","meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json'].includes('Unknown question type')).toBe(true);
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if Zod parse fails', async () => {
    question.json = `{"type":"textArea","attributes":{"asRichText":"abc"}}`;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json'].includes('asRichText')).toBe(true);
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if the questionText is missing', async () => {
    question.questionText = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['questionText']).toBeTruthy();
    expect(question.errors['questionText']).toEqual('Question text can\'t be blank');
    question.questionText = questionData.questionText; // Reset to valid questionText
  });

  it('should not be valid if the displayOrder is missing', async () => {
    question.displayOrder = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['displayOrder']).toBeTruthy();
    expect(question.errors['displayOrder']).toEqual('Order number can\'t be blank');
    question.displayOrder = questionData.displayOrder; // Reset to valid displayOrder
  });

  it('should not be valid if the templateId is missing', async () => {
    question.templateId = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['templateId']).toBeTruthy();
    expect(question.errors['templateId']).toEqual('Template can\'t be blank');
    question.templateId = questionData.templateId; // Reset to valid templateId
  });

  it('should not be valid if the sectionId is missing', async () => {
    question.sectionId = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['sectionId']).toBeTruthy();
    expect(question.errors['sectionId']).toEqual('Section can\'t be blank');
    question.sectionId = questionData.sectionId; // Reset to valid sectionId
  });

  it('should return true when calling isValid', async () => {
    expect(await question.isValid()).toBe(true);
  });
});

describe('ResearchOutputTable Question', () => {
  let question;

  const questionData = {
    templateId: casual.integer(1, 9),
    sectionId: casual.integer(1, 9),
    json: JSON.stringify(DefaultResearchOutputTableQuestion),
    questionText: casual.sentences(5),
    requirementText: casual.sentences(3),
    guidanceText: casual.sentences(10),
    sampleText: casual.sentences(10),
    useSampleTextAsDefault: true,
    displayOrder: casual.integer(1, 20),
  }
  beforeEach(() => {
    question = new Question(questionData);
  });

  it('should initialize options as expected', () => {
    expect(question.json).toEqual(questionData.json);
    expect(question.questionText).toEqual(questionData.questionText);
    expect(question.requirementText).toEqual(questionData.requirementText);
    expect(question.guidanceText).toEqual(questionData.guidanceText);
    expect(question.sampleText).toEqual(questionData.sampleText);
    expect(question.useSampleTextAsDefault).toEqual(questionData.useSampleTextAsDefault);
    expect(question.displayOrder).toEqual(questionData.displayOrder);
    expect(question.required).toEqual(false);
  });

  it('should call removeNullAndUndefinedFromJSON and set json as a string', () => {
    const parsedJSON = removeNullAndUndefinedFromJSON(questionData.json);
    expect(parsedJSON).toEqual(questionData.json);
    expect(question.json).toEqual(parsedJSON);
    expect(typeof question.json).toBe('string');
  });

  it('should add an error if removeNullAndUndefinedFromJSON fails', () => {
    const invalidJSON = '{"type":"textArea","meta":{"asRichText":true,"schemaVersion":"invalidVersion"';
    const q = new Question({ ...questionData, json: invalidJSON });
    expect(q.errors['json']).toBeTruthy();
    expect(q.errors['json'].includes('Invalid JSON format')).toBe(true);
  });

  it('should not be valid if the JSON is missing', async () => {
    question.json = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json']).toEqual('Question type JSON can\'t be blank');
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if the JSON is for an unknown question type', async () => {
    question.json = `{"type":"unknownType","meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json'].includes('Unknown question type')).toBe(true);
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if Zod parse fails', async () => {
    question.json = `{"type":"textArea","attributes":{"asRichText":"abc"}}`;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['json']).toBeTruthy();
    expect(question.errors['json'].includes('asRichText')).toBe(true);
    question.json = questionData.json; // Reset to valid JSON
  });

  it('should not be valid if the questionText is missing', async () => {
    question.questionText = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['questionText']).toBeTruthy();
    expect(question.errors['questionText']).toEqual('Question text can\'t be blank');
    question.questionText = questionData.questionText; // Reset to valid questionText
  });

  it('should not be valid if the displayOrder is missing', async () => {
    question.displayOrder = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['displayOrder']).toBeTruthy();
    expect(question.errors['displayOrder']).toEqual('Order number can\'t be blank');
    question.displayOrder = questionData.displayOrder; // Reset to valid displayOrder
  });

  it('should not be valid if the templateId is missing', async () => {
    question.templateId = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['templateId']).toBeTruthy();
    expect(question.errors['templateId']).toEqual('Template can\'t be blank');
    question.templateId = questionData.templateId; // Reset to valid templateId
  });

  it('should not be valid if the sectionId is missing', async () => {
    question.sectionId = null;
    expect(await question.isValid()).toBe(false);
    expect(question.errors['sectionId']).toBeTruthy();
    expect(question.errors['sectionId']).toEqual('Section can\'t be blank');
    question.sectionId = questionData.sectionId; // Reset to valid sectionId
  });

  it('should return true when calling isValid', async () => {
    expect(await question.isValid()).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = Question.query;

  let localQuery;
  let context;
  let question;

  beforeEach(async () => {
    // jest.resetAllMocks();

    localQuery = jest.fn();
    (Question.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    question = new Question({
      templateId: casual.integer(1, 999),
      sectionId: casual.integer(1, 999),
      id: casual.integer(1, 9),
      questionText: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      json: DefaultTextAreaQuestion,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Question.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([question]);
    const questionId = casual.integer(1, 999);
    const result = await Question.findById('testing', context, questionId);
    const expectedSql = 'SELECT * FROM questions WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [questionId.toString()], 'testing')
    expect(result).toEqual(question);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const questionId = casual.integer(1, 999);
    const result = await Question.findById('testing', context, questionId);
    expect(result).toEqual(null);
  });

  it('findBySectionId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([question]);
    const questionId = casual.integer(1, 999);
    const result = await Question.findBySectionId('testing', context, questionId);
    const expectedSql = 'SELECT * FROM questions WHERE sectionId = ? ORDER BY displayOrder ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [questionId.toString()], 'testing')
    expect(result).toEqual([question]);
  });

  it('findBySectionId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const questionId = casual.integer(1, 999);
    const result = await Question.findBySectionId('testing', context, questionId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let question;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Question.update as jest.Mock) = updateQuery;

    question = new Question({
      templateId: casual.integer(1, 999),
      sectionId: casual.integer(1, 999),
      id: casual.integer(1, 9),
      questionText: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      json: DefaultTextAreaQuestion,
    })
  });

  it('returns the Question with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (question.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await question.update(context);
    expect(result instanceof Question).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Template has no id', async () => {
    const localValidator = jest.fn();
    (question.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    question.id = null;
    const result = await question.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated Template', async () => {
    const localValidator = jest.fn();
    (question.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(question);

    const mockFindById = jest.fn();
    (Question.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(question);

    const result = await question.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Question);
  });
});

describe('create', () => {
  const originalInsert = Question.insert;
  let insertQuery;
  let question;

  beforeEach(() => {
    // jest.resetAllMocks();

    insertQuery = jest.fn();
    (Question.insert as jest.Mock) = insertQuery;

    question = new Question({
      templateId: casual.integer(1, 999),
      sectionId: casual.integer(1, 999),
      id: casual.integer(1, 9),
      questionType: {
        type: 'number',
        attributes: {},
        meta: {
          schemaVersion: CURRENT_SCHEMA_VERSION
        }
      },
      questionText: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      json: DefaultTextAreaQuestion,
    })
  });

  afterEach(() => {
    // jest.resetAllMocks();
    Question.insert = originalInsert;
  });

  it('returns the Question without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (question.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await question.create(context);
    expect(result instanceof Question).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the Question with an error if templateId is undefined', async () => {
    question.templateId = undefined;
    const response = await question.create(context);
    expect(response.errors['templateId']).toBe('Template can\'t be blank');
  });

  it('returns the Question with an error if sectionId is undefined', async () => {
    question.sectionId = undefined;
    const response = await question.create(context);
    expect(response.errors['sectionId']).toBe('Section can\'t be blank');
  });

  it('returns the Question with an error if questionText is undefined', async () => {
    question.questionText = undefined;
    const response = await question.create(context);
    expect(response.errors['questionText']).toBe('Question text can\'t be blank');
  });

  it('returns the newly added Question', async () => {
    const mockFindById = jest.fn();
    (Question.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(question);

    const result = await question.create(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Question);
  });
});

describe('delete', () => {
  let question;

  beforeEach(() => {
    question = new Question({
      templateId: casual.integer(1, 999),
      sectionId: casual.integer(1, 999),
      id: casual.integer(1, 9),
      questionText: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      json: DefaultTextAreaQuestion,
    })
  })

  it('returns null if the Question has no id', async () => {
    question.id = null;
    expect(await question.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Question.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await question.delete(context)).toBe(null);
  });

  it('returns the Question if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Question.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(question);

    const mockFindById = jest.fn();
    (Question.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(question);

    const result = await question.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Question);
  });
});
