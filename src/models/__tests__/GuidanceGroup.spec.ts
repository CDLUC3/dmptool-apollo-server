import casual from "casual";
import { GuidanceGroup } from "../GuidanceGroup";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock('../../context.ts');

describe('GuidanceGroup', () => {
  let guidanceGroup;
  const guidanceGroupData = {
    affiliationId: 'https://ror.org/123456',
    name: 'Test Guidance Group',
    description: 'This is a test guidance group',
    bestPractice: false,
    optionalSubset: false,
  }

  beforeEach(() => {
    guidanceGroup = new GuidanceGroup(guidanceGroupData);
  });

  it('should initialize options as expected', () => {
    expect(guidanceGroup.id).toBeFalsy();
    expect(guidanceGroup.affiliationId).toEqual(guidanceGroupData.affiliationId);
    expect(guidanceGroup.name).toEqual(guidanceGroupData.name);
    expect(guidanceGroup.description).toEqual(guidanceGroupData.description);
    expect(guidanceGroup.bestPractice).toEqual(guidanceGroupData.bestPractice);
    expect(guidanceGroup.optionalSubset).toEqual(guidanceGroupData.optionalSubset);
    expect(guidanceGroup.isDirty).toBe(false);
    expect(guidanceGroup.created).toBeTruthy();
    expect(guidanceGroup.modified).toBeTruthy();
    expect(guidanceGroup.errors).toEqual({});
  });

  it('should return true when calling isValid with required fields', async () => {
    expect(await guidanceGroup.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a name field', async () => {
    guidanceGroup.name = null;
    expect(await guidanceGroup.isValid()).toBe(false);
    expect(Object.keys(guidanceGroup.errors).length).toBe(1);
    expect(guidanceGroup.errors['name']).toBeTruthy();
  });

  it('should return false when calling isValid without an affiliationId field', async () => {
    guidanceGroup.affiliationId = null;
    expect(await guidanceGroup.isValid()).toBe(false);
    expect(Object.keys(guidanceGroup.errors).length).toBe(1);
    expect(guidanceGroup.errors['affiliationId']).toBeTruthy();
  });

  it('should default optionalSubset to false when not provided', () => {
    const newGuidanceGroup = new GuidanceGroup({
      affiliationId: 'https://ror.org/123456',
      name: 'Test Group',
      bestPractice: true,
    });
    expect(newGuidanceGroup.optionalSubset).toBe(false);
  });

  it('should set optionalSubset to true when provided', () => {
    const newGuidanceGroup = new GuidanceGroup({
      affiliationId: 'https://ror.org/123456',
      name: 'Test Group',
      bestPractice: true,
      optionalSubset: true,
    });
    expect(newGuidanceGroup.optionalSubset).toBe(true);
  });
});

describe('GuidanceGroup.findByAffiliationId', () => {
  const originalQuery = GuidanceGroup.query;

  let localQuery;
  let context;
  let guidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (GuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    guidanceGroup = new GuidanceGroup({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      affiliationId: 'https://ror.org/123456',
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    GuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return the guidance groups', async () => {
    localQuery.mockResolvedValueOnce([guidanceGroup]);
    const result = await GuidanceGroup.findByAffiliationId('GuidanceGroup query', context, guidanceGroup.affiliationId);
    const expectedSql = 'SELECT * FROM guidanceGroups WHERE affiliationId = ? ORDER BY name ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [guidanceGroup.affiliationId], 'GuidanceGroup query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(guidanceGroup.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await GuidanceGroup.findByAffiliationId('GuidanceGroup query', context, 'https://ror.org/nonexistent');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('GuidanceGroup.findById', () => {
  const originalQuery = GuidanceGroup.query;

  let localQuery;
  let context;
  let guidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (GuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    guidanceGroup = new GuidanceGroup({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      affiliationId: 'https://ror.org/123456',
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    GuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return the guidance group', async () => {
    localQuery.mockResolvedValueOnce([guidanceGroup]);
    const result = await GuidanceGroup.findById('GuidanceGroup query', context, guidanceGroup.id);
    const expectedSql = 'SELECT * FROM guidanceGroups WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [guidanceGroup.id.toString()], 'GuidanceGroup query');
    expect(result.id).toEqual(guidanceGroup.id);
  });

  it('should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await GuidanceGroup.findById('GuidanceGroup query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});
