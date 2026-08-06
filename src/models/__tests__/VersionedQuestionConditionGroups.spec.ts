import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { VersionedQuestionConditionGroup } from "../VersionedQuestionConditionGroups";
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

describe('VersionedQuestionConditionGroup', () => {
  let versionedQuestionConditionGroup;

  const versionedQuestionConditionGroupData = {
    versionedQuestionId: casual.integer(1, 9999),
    questionConditionGroupId: casual.integer(1, 999),
    triggerQuestionId: casual.integer(1, 999),
  };

  beforeEach(() => {
    versionedQuestionConditionGroup = new VersionedQuestionConditionGroup(versionedQuestionConditionGroupData);
  });

  it('should initialize options as expected', () => {
    expect(versionedQuestionConditionGroup.versionedQuestionId).toEqual(versionedQuestionConditionGroupData.versionedQuestionId);
    expect(versionedQuestionConditionGroup.questionConditionGroupId).toEqual(versionedQuestionConditionGroupData.questionConditionGroupId);
    expect(versionedQuestionConditionGroup.triggerQuestionId).toEqual(versionedQuestionConditionGroupData.triggerQuestionId);
  });

  it('isValid returns true when the record is valid', async () => {
    expect(await versionedQuestionConditionGroup.isValid()).toBe(true);
  });

  it('isValid returns false if the versionedQuestionId is null', async () => {
    versionedQuestionConditionGroup.versionedQuestionId = null;
    expect(await versionedQuestionConditionGroup.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionConditionGroup.errors).length).toBe(1);
    expect(versionedQuestionConditionGroup.errors['versionedQuestionId'].includes('Versioned Question Id')).toBe(true);
  });

  it('isValid returns false if the questionConditionGroupId is null', async () => {
    versionedQuestionConditionGroup.questionConditionGroupId = null;
    expect(await versionedQuestionConditionGroup.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionConditionGroup.errors).length).toBe(1);
    expect(versionedQuestionConditionGroup.errors['questionConditionGroupId'].includes('Question Condition Group Id')).toBe(true);
  });

  it('isValid returns false if the triggerQuestionId is null', async () => {
    versionedQuestionConditionGroup.triggerQuestionId = null;
    expect(await versionedQuestionConditionGroup.isValid()).toBe(false);
    expect(Object.keys(versionedQuestionConditionGroup.errors).length).toBe(1);
    expect(versionedQuestionConditionGroup.errors['triggerQuestionId'].includes('Trigger Question Id')).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = VersionedQuestionConditionGroup.query;

  let localQuery;
  let context;
  let versionedQuestionConditionGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedQuestionConditionGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedQuestionConditionGroup = new VersionedQuestionConditionGroup({
      id: casual.integer(1, 9),
      versionedQuestionId: casual.integer(1, 999),
      questionConditionGroupId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedQuestionConditionGroup.query = originalQuery;
  });

  it('findById should call query with correct params and return the result', async () => {
    localQuery.mockResolvedValueOnce([versionedQuestionConditionGroup]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionConditionGroup.findById('testing', context, id);
    const expectedSql = 'SELECT * FROM versionedQuestionConditionGroups WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing');
    expect(result).toEqual(versionedQuestionConditionGroup);
  });

  it('findById should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = casual.integer(1, 999);
    const result = await VersionedQuestionConditionGroup.findById('testing', context, id);
    expect(result).toEqual(null);
  });

  it('findByVersionedQuestionId should call query with correct params and return the results', async () => {
    localQuery.mockResolvedValueOnce([versionedQuestionConditionGroup]);
    const versionedQuestionId = casual.integer(1, 999);
    const result = await VersionedQuestionConditionGroup.findByVersionedQuestionId('testing', context, versionedQuestionId);
    const expectedSql = 'SELECT * FROM versionedQuestionConditionGroups WHERE versionedQuestionId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [versionedQuestionId.toString()], 'testing');
    expect(result[0]).toBeInstanceOf(VersionedQuestionConditionGroup);
  });

  it('findByVersionedQuestionId should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const versionedQuestionId = casual.integer(1, 999);
    const result = await VersionedQuestionConditionGroup.findByVersionedQuestionId('testing', context, versionedQuestionId);
    expect(result).toEqual([]);
  });
});

describe('create', () => {
  let insertQuery;
  let versionedQuestionConditionGroup;

  beforeEach(() => {
    insertQuery = jest.fn();
    (VersionedQuestionConditionGroup.insert as jest.Mock) = insertQuery;

    versionedQuestionConditionGroup = new VersionedQuestionConditionGroup({
      versionedQuestionId: casual.integer(1, 999),
      questionConditionGroupId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    });
  });

  it('should return the VersionedQuestionConditionGroup with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (versionedQuestionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await versionedQuestionConditionGroup.create(context);
    expect(result).toBeInstanceOf(VersionedQuestionConditionGroup);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('should return the newly created VersionedQuestionConditionGroup', async () => {
    const localValidator = jest.fn();
    (versionedQuestionConditionGroup.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindBy = jest.fn();
    (VersionedQuestionConditionGroup.findById as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValue(versionedQuestionConditionGroup);

    const result = await versionedQuestionConditionGroup.create(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(VersionedQuestionConditionGroup);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});
