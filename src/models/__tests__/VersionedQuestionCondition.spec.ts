import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { QuestionConditionActionType, QuestionConditionCondition } from "../QuestionCondition";
import { getRandomEnumValue } from "../../__tests__/helpers";
import { VersionedQuestionCondition } from "../VersionedQuestionCondition";
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

describe('QuestionCondition', () => {
  let versionedQuestionCondition;

  const versionedQuestionConditionData = {
    versionedQuestionId: casual.integer(1, 9999),
    questionConditionId: casual.integer(1, 999),
    action: getRandomEnumValue(QuestionConditionActionType),
    conditionType: getRandomEnumValue(QuestionConditionCondition),
    conditionMatch: casual.words(3),
    target: casual.word,
  }
  beforeEach(() => {
    versionedQuestionCondition = new VersionedQuestionCondition(versionedQuestionConditionData);
  });

  it('should initialize options as expected', () => {
    expect(versionedQuestionCondition.versionedQuestionId).toEqual(versionedQuestionConditionData.versionedQuestionId);
    expect(versionedQuestionCondition.questionConditionId).toEqual(versionedQuestionConditionData.questionConditionId);
    expect(versionedQuestionCondition.action).toEqual(versionedQuestionConditionData.action);
    expect(versionedQuestionCondition.conditionType).toEqual(versionedQuestionConditionData.conditionType);
    expect(versionedQuestionCondition.conditionMatch).toEqual(versionedQuestionConditionData.conditionMatch);
    expect(versionedQuestionCondition.target).toEqual(versionedQuestionConditionData.target);
  });

  it('isValid returns true when the record is valid', async () => {
    expect(await versionedQuestionCondition.isValid()).toBe(true);
  });

  it('isValid returns false if the versioneQuestionId is null', async () => {
    versionedQuestionCondition.versionedQuestionId = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['versionedQuestionId'].includes('Versioned Question')).toBe(true);
  });

  it('isValid returns false if the questionConditionId is null', async () => {
    versionedQuestionCondition.questionConditionId = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['questionConditionId'].includes('Question Condition')).toBe(true);
  });

  it('isValid returns false if the action is null', async () => {
    versionedQuestionCondition.action = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['action'].includes('Action')).toBe(true);
  });

  it('isValid returns false if the conditionType is null', async () => {
    versionedQuestionCondition.conditionType = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['conditionType'].includes('Condition Type')).toBe(true);
  });

  it('isValid returns false if the target is null', async () => {
    versionedQuestionCondition.target = null;
    expect(await versionedQuestionCondition.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionCondition.errors).length).toBe(1);
    expect(versionedQuestionCondition.errors['target'].includes('Target')).toBe(true);
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
      questionId: casual.integer(1, 999),
      action: getRandomEnumValue(QuestionConditionActionType),
      condition: getRandomEnumValue(QuestionConditionCondition),
      conditionMatch: casual.words(5),
      target: casual.integer(1, 9999).toString(),
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
      versionedQuestionId: casual.integer(1, 999),
      questionConditionId: casual.integer(1, 99),
      action: getRandomEnumValue(QuestionConditionActionType),
      condition: getRandomEnumValue(QuestionConditionCondition),
      conditionMatch: casual.words(3),
      target: casual.word,
    })
  });

  it('returns the VersionedQuestionCondition with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (versionedQuestionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await versionedQuestionCondition.create(context);
    expect(result).toBeInstanceOf(VersionedQuestionCondition);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the newly added VersionedQuestionCondition', async () => {
    const localValidator = jest.fn();
    (versionedQuestionCondition.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindBy = jest.fn();
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

describe('findByVersionedQuestionId', () => {
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
      versionedQuestionId: casual.integer(1, 999),
      questionConditionId: casual.integer(1, 99),
      action: getRandomEnumValue(QuestionConditionActionType),
      condition: getRandomEnumValue(QuestionConditionCondition),
      conditionMatch: casual.words(3),
      target: casual.word,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedQuestionCondition.query = originalQuery;
  });

  it('should call query with correct params and return the default when findByVersionedQuestionId called', async () => {
    localQuery.mockResolvedValueOnce([versionedQuestionCondition]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionCondition.findByVersionedQuestionId('testing', context, id);
    const expectedSql = 'SELECT * FROM versionedQuestionConditions WHERE versionedQuestionId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing');
    expect(result[0]).toBeInstanceOf(VersionedQuestionCondition);
  });
});
