import casual from "casual";
import { VersionedGuidance } from "../VersionedGuidance";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();
  context = await buildMockContextWithToken(logger);
});

describe('VersionedGuidance', () => {
  let versionedGuidance;
  const versionedGuidanceData = {
    versionedGuidanceGroupId: casual.integer(1, 100),
    guidanceId: casual.integer(1, 100),
    guidanceText: 'This is versioned guidance text',
    tagId: casual.integer(1, 50),
  }

  beforeEach(() => {
    versionedGuidance = new VersionedGuidance(versionedGuidanceData);
  });

  it('should initialize options as expected', () => {
    expect(versionedGuidance.id).toBeFalsy();
    expect(versionedGuidance.versionedGuidanceGroupId).toEqual(versionedGuidanceData.versionedGuidanceGroupId);
    expect(versionedGuidance.guidanceId).toEqual(versionedGuidanceData.guidanceId);
    expect(versionedGuidance.guidanceText).toEqual(versionedGuidanceData.guidanceText);
    expect(versionedGuidance.tagId).toEqual(versionedGuidanceData.tagId);
    expect(versionedGuidance.created).toBeTruthy();
    expect(versionedGuidance.modified).toBeTruthy();
    expect(versionedGuidance.errors).toEqual({});
  });

  it('should return true when calling isValid with required fields', async () => {
    expect(await versionedGuidance.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a versionedGuidanceGroupId', async () => {
    versionedGuidance.versionedGuidanceGroupId = null;
    expect(await versionedGuidance.isValid()).toBe(false);
    expect(Object.keys(versionedGuidance.errors).length).toBe(1);
    expect(versionedGuidance.errors['versionedGuidanceGroupId']).toBeTruthy();
  });

  it('should return false when calling isValid without a tagId', async () => {
    versionedGuidance.tagId = null;
    expect(await versionedGuidance.isValid()).toBe(false);
    expect(Object.keys(versionedGuidance.errors).length).toBe(1);
    expect(versionedGuidance.errors['tagId']).toBeTruthy();
  });
});

describe('VersionedGuidance.findById', () => {
  const originalQuery = VersionedGuidance.query;

  let localQuery;
  let versionedGuidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidance = new VersionedGuidance({
      id: casual.integer(1, 9),
      versionedGuidanceGroupId: casual.integer(1, 100),
      guidanceId: casual.integer(1, 100),
      guidanceText: casual.sentence,
      tagId: casual.integer(1, 50),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidance.query = originalQuery;
  });

  it('should call query with correct params and return the versioned guidance', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidance]);
    const result = await VersionedGuidance.findById('VersionedGuidance query', context, versionedGuidance.id);
    const expectedSql = 'SELECT * FROM versionedGuidance WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidance.id.toString()], 'VersionedGuidance query');
    expect(result.id).toEqual(versionedGuidance.id);
  });

  it('should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidance.findById('VersionedGuidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});

describe('VersionedGuidance.findByGuidanceId', () => {
  const originalQuery = VersionedGuidance.query;

  let localQuery;
  let versionedGuidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidance = new VersionedGuidance({
      id: casual.integer(1, 9),
      versionedGuidanceGroupId: casual.integer(1, 100),
      guidanceId: casual.integer(1, 100),
      guidanceText: casual.sentence,
      tagId: casual.integer(1, 50),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidance.query = originalQuery;
  });

  it('should call query with correct params and return versioned guidance items', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidance]);
    const result = await VersionedGuidance.findByGuidanceId('VersionedGuidance query', context, versionedGuidance.guidanceId);
    const expectedSql = 'SELECT * FROM versionedGuidance WHERE guidanceId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidance.guidanceId.toString()], 'VersionedGuidance query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidance.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidance.findByGuidanceId('VersionedGuidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidance.findByVersionedGuidanceGroupId', () => {
  const originalQuery = VersionedGuidance.query;

  let localQuery;
  let versionedGuidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidance = new VersionedGuidance({
      id: casual.integer(1, 9),
      versionedGuidanceGroupId: casual.integer(1, 100),
      guidanceId: casual.integer(1, 100),
      guidanceText: casual.sentence,
      tagId: casual.integer(1, 50),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidance.query = originalQuery;
  });

  it('should call query with correct params and return versioned guidance items', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidance]);
    const result = await VersionedGuidance.findByVersionedGuidanceGroupId('VersionedGuidance query', context, versionedGuidance.versionedGuidanceGroupId);
    const expectedSql = 'SELECT * FROM versionedGuidance WHERE versionedGuidanceGroupId = ? ORDER BY tagId ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidance.versionedGuidanceGroupId.toString()], 'VersionedGuidance query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidance.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidance.findByVersionedGuidanceGroupId('VersionedGuidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidance.findBestPracticeByTagIds', () => {
  const originalQuery = VersionedGuidance.query;

  let localQuery;
  let versionedGuidance;
  const tagIds = [casual.integer(1, 50), casual.integer(51, 100)];

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidance = new VersionedGuidance({
      id: casual.integer(1, 9),
      versionedGuidanceGroupId: casual.integer(1, 100),
      guidanceId: casual.integer(1, 100),
      guidanceText: casual.sentence,
      tagId: tagIds[0],
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidance.query = originalQuery;
  });

  it('should call query with correct params and return best practice guidance for tags', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidance]);
    const result = await VersionedGuidance.findBestPracticeByTagIds('VersionedGuidance query', context, tagIds);
    const placeholders = tagIds.map(() => '?').join(', ');
    const expectedSql = `
      SELECT DISTINCT vg.*
      FROM versionedGuidance vg
      INNER JOIN versionedGuidanceGroups vgg ON vg.versionedGuidanceGroupId = vgg.id
      WHERE vg.tagId IN (${placeholders}) AND vgg.bestPractice = 1 AND vgg.active = 1
      ORDER BY vg.id ASC
    `;
    expect(localQuery).toHaveBeenCalledTimes(1);
    // Normalize whitespace and compare SQL to avoid fragile failures due to indentation
    const calledArgs = localQuery.mock.calls[0];
    const calledSql = calledArgs[1];
    expect(calledSql.replace(/\s+/g, ' ').trim()).toEqual(expectedSql.replace(/\s+/g, ' ').trim());
    expect(calledArgs[2]).toEqual(tagIds.map(id => id.toString()));
    expect(calledArgs[3]).toEqual('VersionedGuidance query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidance.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidance.findBestPracticeByTagIds('VersionedGuidance query', context, tagIds);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidance.findByAffiliationAndTagIds', () => {
  const originalQuery = VersionedGuidance.query;

  let localQuery;
  let versionedGuidance;
  const affiliationId = 'https://ror.org/123456';
  const tagIds = [casual.integer(1, 50), casual.integer(51, 100)];

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidance = new VersionedGuidance({
      id: casual.integer(1, 9),
      versionedGuidanceGroupId: casual.integer(1, 100),
      guidanceId: casual.integer(1, 100),
      guidanceText: casual.sentence,
      tagId: tagIds[0],
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidance.query = originalQuery;
  });

  it('should call query with correct params and return guidance for affiliation and tags', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidance]);
    const result = await VersionedGuidance.findByAffiliationAndTagIds('VersionedGuidance query', context, affiliationId, tagIds);
    const placeholders = tagIds.map(() => '?').join(', ');
    const expectedSql = `
      SELECT DISTINCT vg.*
      FROM versionedGuidance vg
      INNER JOIN versionedGuidanceGroups vgg ON vg.versionedGuidanceGroupId = vgg.id
      INNER JOIN guidanceGroups gg ON vgg.guidanceGroupId = gg.id
      INNER JOIN guidance g ON vg.guidanceId = g.id
      WHERE gg.affiliationId = ? AND g.tagId IN (${placeholders}) AND vgg.active = 1
      ORDER BY vg.id ASC
    `;
    expect(localQuery).toHaveBeenCalledTimes(1);
    // Normalize whitespace and compare SQL to avoid fragile failures due to indentation
    const calledArgs = localQuery.mock.calls[0];
    const calledSql = calledArgs[1];
    expect(calledSql.replace(/\s+/g, ' ').trim()).toEqual(expectedSql.replace(/\s+/g, ' ').trim());
    expect(calledArgs[2]).toEqual([affiliationId, ...tagIds.map(id => id.toString())]);
    expect(calledArgs[3]).toEqual('VersionedGuidance query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidance.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidance.findByAffiliationAndTagIds('VersionedGuidance query', context, affiliationId, tagIds);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});
