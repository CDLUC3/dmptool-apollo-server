import casual from "casual";
import { VersionedGuidanceGroup } from "../VersionedGuidanceGroup.js";
import { buildMockContextWithToken } from "../../__mocks__/context.js";

import { logger } from "../../logger.js";

jest.mock('../../context.js')

let context;

beforeEach(async () => {
  jest.resetAllMocks();
  context = await buildMockContextWithToken(logger);
});

describe('VersionedGuidanceGroup', () => {
  let versionedGuidanceGroup;
  const versionedGuidanceGroupData = {
    guidanceGroupId: casual.integer(1, 100),
    version: casual.integer(1, 10),
    bestPractice: false,
    active: true,
    name: 'Test Versioned Guidance Group',
    description: 'This is a test versioned guidance group',
  }

  beforeEach(() => {
    versionedGuidanceGroup = new VersionedGuidanceGroup(versionedGuidanceGroupData);
  });

  it('should initialize options as expected', () => {
    expect(versionedGuidanceGroup.id).toBeFalsy();
    expect(versionedGuidanceGroup.guidanceGroupId).toEqual(versionedGuidanceGroupData.guidanceGroupId);
    expect(versionedGuidanceGroup.version).toEqual(versionedGuidanceGroupData.version);
    expect(versionedGuidanceGroup.bestPractice).toEqual(versionedGuidanceGroupData.bestPractice);
    expect(versionedGuidanceGroup.active).toEqual(versionedGuidanceGroupData.active);
    expect(versionedGuidanceGroup.name).toEqual(versionedGuidanceGroupData.name);
    expect(versionedGuidanceGroup.description).toEqual(versionedGuidanceGroupData.description);
    expect(versionedGuidanceGroup.created).toBeTruthy();
    expect(versionedGuidanceGroup.modified).toBeTruthy();
    expect(versionedGuidanceGroup.errors).toEqual({});
  });

  it('should initialize with default values', () => {
    const defaultVersionedGuidanceGroup = new VersionedGuidanceGroup({
      guidanceGroupId: 1,
      name: 'Test'
    });
    expect(defaultVersionedGuidanceGroup.bestPractice).toEqual(false);
    expect(defaultVersionedGuidanceGroup.active).toEqual(false);
  });

  it('should return true when calling isValid with required fields', async () => {
    expect(await versionedGuidanceGroup.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a guidanceGroupId', async () => {
    versionedGuidanceGroup.guidanceGroupId = null;
    expect(await versionedGuidanceGroup.isValid()).toBe(false);
    expect(Object.keys(versionedGuidanceGroup.errors).length).toBe(1);
    expect(versionedGuidanceGroup.errors['guidanceGroupId']).toBeTruthy();
  });

  it('should return false when calling isValid without a name', async () => {
    versionedGuidanceGroup.name = null;
    expect(await versionedGuidanceGroup.isValid()).toBe(false);
    expect(Object.keys(versionedGuidanceGroup.errors).length).toBe(1);
    expect(versionedGuidanceGroup.errors['name']).toBeTruthy();
  });
});

describe('VersionedGuidanceGroup.findById', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  let versionedGuidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidanceGroup = new VersionedGuidanceGroup({
      id: casual.integer(1, 9),
      guidanceGroupId: casual.integer(1, 100),
      version: casual.integer(1, 10),
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return the versioned guidance group', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidanceGroup]);
    const result = await VersionedGuidanceGroup.findById('VersionedGuidanceGroup query', context, versionedGuidanceGroup.id);
    const expectedSql = 'SELECT * FROM versionedGuidanceGroups WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidanceGroup.id.toString()], 'VersionedGuidanceGroup query');
    expect(result.id).toEqual(versionedGuidanceGroup.id);
  });

  it('should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidanceGroup.findById('VersionedGuidanceGroup query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});

describe('VersionedGuidanceGroup.findByGuidanceGroupId', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  let versionedGuidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidanceGroup = new VersionedGuidanceGroup({
      id: casual.integer(1, 9),
      guidanceGroupId: casual.integer(1, 100),
      version: casual.integer(1, 10),
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return versioned guidance groups', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidanceGroup]);
    const result = await VersionedGuidanceGroup.findByGuidanceGroupId('VersionedGuidanceGroup query', context, versionedGuidanceGroup.guidanceGroupId);
    const expectedSql = 'SELECT * FROM versionedGuidanceGroups WHERE guidanceGroupId = ? ORDER BY version DESC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidanceGroup.guidanceGroupId.toString()], 'VersionedGuidanceGroup query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidanceGroup.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidanceGroup.findByGuidanceGroupId('VersionedGuidanceGroup query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidanceGroup.findActiveByGuidanceGroupId', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  let versionedGuidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidanceGroup = new VersionedGuidanceGroup({
      id: casual.integer(1, 9),
      guidanceGroupId: casual.integer(1, 100),
      version: casual.integer(1, 10),
      active: true,
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return the active versioned guidance group', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidanceGroup]);
    const result = await VersionedGuidanceGroup.findActiveByGuidanceGroupId('VersionedGuidanceGroup query', context, versionedGuidanceGroup.guidanceGroupId);
    const expectedSql = 'SELECT * FROM versionedGuidanceGroups WHERE guidanceGroupId = ? AND active = 1 LIMIT 1';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [versionedGuidanceGroup.guidanceGroupId.toString()], 'VersionedGuidanceGroup query');
    expect(result.id).toEqual(versionedGuidanceGroup.id);
  });

  it('should return null if no active record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidanceGroup.findActiveByGuidanceGroupId('VersionedGuidanceGroup query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});

describe('VersionedGuidanceGroup.findActiveBestPractice', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  let versionedGuidanceGroup;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidanceGroup = new VersionedGuidanceGroup({
      id: casual.integer(1, 9),
      guidanceGroupId: casual.integer(1, 100),
      version: casual.integer(1, 10),
      bestPractice: true,
      active: true,
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return active best practice groups', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidanceGroup]);
    const result = await VersionedGuidanceGroup.findActiveBestPractice('VersionedGuidanceGroup query', context);
    const expectedSql = 'SELECT * FROM versionedGuidanceGroups WHERE bestPractice = 1 AND active = 1 ORDER BY name ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [], 'VersionedGuidanceGroup query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidanceGroup.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidanceGroup.findActiveBestPractice('VersionedGuidanceGroup query', context);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidanceGroup.findActiveByAffiliationId', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  let versionedGuidanceGroup;
  const affiliationId = 'https://ror.org/123456';

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedGuidanceGroup = new VersionedGuidanceGroup({
      id: casual.integer(1, 9),
      guidanceGroupId: casual.integer(1, 100),
      version: casual.integer(1, 10),
      active: true,
      name: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params and return active groups for affiliation', async () => {
    localQuery.mockResolvedValueOnce([versionedGuidanceGroup]);
    const result = await VersionedGuidanceGroup.findActiveByAffiliationId('VersionedGuidanceGroup query', context, affiliationId);
    const expectedSql = `
      SELECT vgg.*
      FROM versionedGuidanceGroups vgg
      INNER JOIN guidanceGroups gg ON vgg.guidanceGroupId = gg.id
      WHERE gg.affiliationId = ? AND vgg.active = 1
      ORDER BY vgg.name ASC
    `;
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [affiliationId], 'VersionedGuidanceGroup query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(versionedGuidanceGroup.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await VersionedGuidanceGroup.findActiveByAffiliationId('VersionedGuidanceGroup query', context, affiliationId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('VersionedGuidanceGroup.deactivateAll', () => {
  const originalQuery = VersionedGuidanceGroup.query;

  let localQuery;
  const guidanceGroupId = casual.integer(1, 100);

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedGuidanceGroup.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedGuidanceGroup.query = originalQuery;
  });

  it('should call query with correct params to deactivate all versions', async () => {
    localQuery.mockResolvedValueOnce({});
    const result = await VersionedGuidanceGroup.deactivateAll('VersionedGuidanceGroup query', context, guidanceGroupId);
    const expectedSql = 'UPDATE versionedGuidanceGroups SET active = 0 WHERE guidanceGroupId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [guidanceGroupId.toString()], 'VersionedGuidanceGroup query');
    expect(result).toBe(true);
  });

  it('should return false if the query fails', async () => {
    localQuery.mockResolvedValueOnce(null);
    const result = await VersionedGuidanceGroup.deactivateAll('VersionedGuidanceGroup query', context, guidanceGroupId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});
