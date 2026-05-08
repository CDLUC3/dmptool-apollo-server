import casual from 'casual';
import { AlternateIdentifier } from '../AlternateIdentifier';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from "../../logger";

describe('AlternateIdentifier', () => {
  it('constructor should initialize as expected', () => {
    const planId = casual.integer(1, 9);
    const alternateIdentifier = casual.url;
    const createdById = casual.integer(1, 999);

    const id = new AlternateIdentifier({ planId, alternateIdentifier, createdById });

    expect(id.planId).toEqual(planId);
    expect(id.alternateIdentifier).toEqual(alternateIdentifier);
    expect(id.createdById).toEqual(createdById);
  });

  it('isValid returns true when the planId and alternateIdentifier are present', async () => {
    const planId = casual.integer(1, 9);
    const alternateIdentifier = casual.url;
    const createdById = casual.integer(1, 999);

    const id = new AlternateIdentifier({ planId, alternateIdentifier, createdById });
    expect(await id.isValid()).toBe(true);
  });

  it('isValid returns false when the planId is NOT present', async () => {
    const alternateIdentifier = casual.url;
    const createdById = casual.integer(1, 999);

    const id = new AlternateIdentifier({ alternateIdentifier, createdById });
    expect(await id.isValid()).toBe(false);
    expect(Object.keys(id.errors).length).toBe(1);
    expect(id.errors['planId']).toBeTruthy();
  });

  it('isValid returns false when the alternateIdentifier is NOT present', async () => {
    const planId = casual.integer(1, 9);
    const createdById = casual.integer(1, 999);

    const id = new AlternateIdentifier({ planId, createdById });
    expect(await id.isValid()).toBe(false);
    expect(Object.keys(id.errors).length).toBe(1);
    expect(id.errors['alternateIdentifier']).toBeTruthy();
  });
});

describe('queries', () => {
  const originalQuery = AlternateIdentifier.query;
  let mockQuery;
  let context;
  let mockIdentifier;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    (AlternateIdentifier.insert as jest.Mock) = mockQuery;

    context = await buildMockContextWithToken(logger);

    mockIdentifier = {
      id: casual.integer(1, 99),
      planId: casual.integer(1, 999),
      alternateIdentifier: casual.url
    };
  });

  afterEach(() => {
    AlternateIdentifier.query = originalQuery;
  });

  it('findById performs the expected query', async () => {
    const identifierId = casual.integer(1, 999);
    const querySpy = jest.spyOn(AlternateIdentifier, 'query').mockResolvedValueOnce([mockIdentifier]);
    await AlternateIdentifier.findById('Testing', context, identifierId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM alternateIdentifiers WHERE id = ?';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [identifierId.toString()], 'Testing')
  });

  it('findByAlternateIdentifier performs the expected query', async () => {
    const identifier = casual.url;
    const querySpy = jest.spyOn(AlternateIdentifier, 'query').mockResolvedValueOnce([mockIdentifier]);
    await AlternateIdentifier.findByAlternateIdentifier('Testing', context, identifier);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM alternateIdentifiers WHERE alternateIdentifier = ?';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [identifier], 'Testing')
  });

  it('findByPlanId performs the expected query', async () => {
    const planId = casual.integer(1, 999);
    const querySpy = jest.spyOn(AlternateIdentifier, 'query').mockResolvedValueOnce([mockIdentifier]);
    await AlternateIdentifier.findByPlanId('Testing', context, planId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'SELECT * FROM alternateIdentifiers WHERE planId = ?';
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString()], 'Testing')
  })
});

describe('create', () => {
  let context;
  const originalInsert = AlternateIdentifier.insert;
  let insertQuery;
  let alternateIdentifier;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    insertQuery = jest.fn();
    (AlternateIdentifier.insert as jest.Mock) = insertQuery;

    alternateIdentifier = new AlternateIdentifier({
      planId: casual.integer(1, 999),
      alternateIdentifier: casual.url,
    });
  });

  afterEach(() => {
    AlternateIdentifier.insert = originalInsert;
  });

  it('returns the AlternateIdentifier without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (alternateIdentifier.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const mockFindBy = jest.fn();
    (AlternateIdentifier.findByAlternateIdentifier as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(undefined);

    const result = await alternateIdentifier.create(context);
    expect(result).toBeInstanceOf(AlternateIdentifier);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the AlternateIdentifier with errors if it is invalid', async () => {
    alternateIdentifier.planId = undefined;
    const response = await alternateIdentifier.create(context);
    expect(response.errors['planId']).toBe('Plan can\'t be blank');
  });

  it('returns the AlternateIdentifier with an error if the identifier already exists', async () => {
    const mockFindBy = jest.fn();
    (AlternateIdentifier.findByAlternateIdentifier as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(alternateIdentifier);

    const result = await alternateIdentifier.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added AlternateIdentifier', async () => {
    const mockFindBy = jest.fn();
    (AlternateIdentifier.findByAlternateIdentifier as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (AlternateIdentifier.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(alternateIdentifier);

    const result = await alternateIdentifier.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(AlternateIdentifier);
  });
});

describe('delete', () => {
  let context;
  let alternateIdentifier;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    alternateIdentifier = new AlternateIdentifier({
      id: casual.integer(1, 99),
      planId: casual.integer(1, 99),
      alternateIdentifier: `${casual.url}/test1`,
    });
  });

  it('returns null if the AlternateIdentifier has no id', async () => {
    alternateIdentifier.id = null;
    expect(await alternateIdentifier.delete(context)).toBe(null);
  });

  it('returns the AlternateIdentifier if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (AlternateIdentifier.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(alternateIdentifier);

    const result = await alternateIdentifier.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(AlternateIdentifier);
  });
});
