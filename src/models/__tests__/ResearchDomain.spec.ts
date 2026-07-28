import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { ResearchDomain } from "../ResearchDomain";
import { generalConfig } from "../../config/generalConfig";
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

describe('ResearchDomain', () => {
  let domain;

  const funderData = {
    name: casual.company_name,
    uri: casual.url,
    description: casual.sentences(3),
  }
  beforeEach(() => {
    domain = new ResearchDomain(funderData);
  });

  it('should initialize options as expected', () => {
    expect(domain.name).toEqual(funderData.name);
    expect(domain.uri).toEqual(funderData.uri);
    expect(domain.description).toEqual(funderData.description);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await domain.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the name field is missing', async () => {
    domain.name = null;
    expect(await domain.isValid()).toBe(false);
    expect(Object.keys(domain.errors).length).toBe(1);
    expect(domain.errors['name']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is missing', async () => {
    domain.uri = null;
    expect(await domain.isValid()).toBe(false);
    expect(Object.keys(domain.errors).length).toBe(1);
    expect(domain.errors['uri']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is not a URI', async () => {
    domain.uri = casual.uuid;
    expect(await domain.isValid()).toBe(false);
    expect(Object.keys(domain.errors).length).toBe(1);
    expect(domain.errors['uri']).toBeTruthy();
  });

  it('should return false when specifying a parent research domain that is the same id', async () => {
    const id = casual.integer(1, 9999)
    domain.id = id;
    domain.parentResearchDomain = { id };
    expect(await domain.isValid()).toBe(false);
    expect(Object.keys(domain.errors).length).toBe(1);
    expect(domain.errors['parentResearchDomain']).toBeTruthy();
  });

  it('should return false when specifying a parent research domain that has a null id', async () => {
    domain.id = casual.integer(1, 9999);
    domain.parentResearchDomain = { name: casual.sentence };
    expect(await domain.isValid()).toBe(false);
    expect(Object.keys(domain.errors).length).toBe(1);
    expect(domain.errors['parentResearchDomain']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = ResearchDomain.query;

  let localQuery;
  let localPaginationQuery
  let context;
  let domain;

  beforeEach(async () => {
    localQuery = jest.fn();
    (ResearchDomain.query as jest.Mock) = localQuery;

    localPaginationQuery = jest.fn();
    (ResearchDomain.queryWithPagination as jest.Mock) = localPaginationQuery;

    context = await buildMockContextWithToken(logger);

    domain = new ResearchDomain({
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    ResearchDomain.query = originalQuery;
  });

  it('search should call query with correct params and return the object', async () => {
    localPaginationQuery.mockResolvedValueOnce([domain]);
    const name = casual.company_name;
    const result = await ResearchDomain.search('testing', context, name.toLowerCase().trim());
    const sql = 'SELECT rd.* FROM researchDomains rd';
    const whereFilters = ['(LOWER(rd.name) LIKE ? OR LOWER(rd.description) LIKE ?)'];
    const vals = [`%${name.toLowerCase().trim()}%`, `%${name.toLowerCase().trim()}%`];
    const sortFields = ["rd.name", "rd.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'rd.name',
      sortDir: 'ASC',
      countField: 'rd.id',
      cursorField: 'rd.id',
      availableSortFields: sortFields,
    };
    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'testing');
    expect(result).toEqual([domain]);
  });

  it('search should return an empty array if it finds no records', async () => {
    localPaginationQuery.mockResolvedValueOnce([]);
    const name = casual.company_name;
    const result = await ResearchDomain.search('testing', context, name);
    expect(result).toEqual([]);
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const domainId = casual.integer(1, 999);
    const result = await ResearchDomain.findById('testing', context, domainId);
    const expectedSql = 'SELECT * FROM researchDomains WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [domainId.toString()], 'testing');
    expect(result).toEqual(domain);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const domainId = casual.integer(1, 999);
    const result = await ResearchDomain.findById('testing', context, domainId);
    expect(result).toEqual(null);
  });

  it('findByURI should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const uri = casual.url;
    const result = await ResearchDomain.findByURI('testing', context, uri);
    const expectedSql = 'SELECT * FROM researchDomains WHERE uri = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [uri], 'testing');
    expect(result).toEqual(domain);
  });

  it('findByURI should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const uri = casual.url;
    const result = await ResearchDomain.findByURI('testing', context, uri);
    expect(result).toEqual(null);
  });

  it('findByName should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const name = casual.company_name;
    const result = await ResearchDomain.findByName('testing', context, name.toLowerCase().trim());
    const expectedSql = 'SELECT * FROM researchDomains WHERE LOWER(name) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [name.toLowerCase().trim()], 'testing');
    expect(result).toEqual(domain);
  });

  it('findByName should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const name = casual.company_name;
    const result = await ResearchDomain.findByName('testing', context, name);
    expect(result).toEqual(null);
  });

  it('topLevelDomains should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const result = await ResearchDomain.topLevelDomains('testing', context);
    const expectedSql = 'SELECT * FROM researchDomains WHERE parentResearchDomainId IS NULL ORDER BY name';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [], 'testing');
    expect(result).toEqual([domain]);
  });

  it('topLevelDomains should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await ResearchDomain.topLevelDomains('testing', context);
    expect(result).toEqual([]);
  });

  it('findByParentId should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const domainId = casual.integer(1, 999);
    const result = await ResearchDomain.findByParentId('testing', context, domainId);
    const expectedSql = 'SELECT * FROM researchDomains WHERE parentResearchDomainId = ? ORDER BY name';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [domainId.toString()], 'testing');
    expect(result).toEqual([domain]);
  });

  it('findByParentId should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const domainId = casual.integer(1, 999);
    const result = await ResearchDomain.findByParentId('testing', context, domainId);
    expect(result).toEqual([]);
  });

  it('findByMetadataStandardId should call query with correct params and return an array', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const standardId = casual.integer(1, 999);
    const result = await ResearchDomain.findByMetadataStandardId('testing', context, standardId);
    const sql = 'SELECT rd.* FROM metadataStandardResearchDomains jt';
    const joinClause = 'INNER JOIN researchDomains rd ON jt.researchDomainId = rd.id';
    const whereClause = 'WHERE jt.metadataStandardId = ?';
    const vals = [standardId.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, `${sql} ${joinClause} ${whereClause}`, vals, 'testing');
    expect(result).toEqual([domain]);
  });

  it('findByMetadataStandardId should return and empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const standardId = casual.integer(1, 999);
    const result = await ResearchDomain.findByMetadataStandardId('testing', context, standardId);
    expect(result).toEqual([]);
  });

  it('findByRepositoryId should call query with correct params and return an array', async () => {
    localQuery.mockResolvedValueOnce([domain]);
    const repositoryId = casual.integer(1, 999);
    const result = await ResearchDomain.findByRepositoryId('testing', context, repositoryId);
    const sql = 'SELECT rd.* FROM repositoryResearchDomains jt';
    const joinClause = 'INNER JOIN researchDomains rd ON jt.researchDomainId = rd.id';
    const whereClause = 'WHERE jt.repositoryId = ?';
    const vals = [repositoryId.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, `${sql} ${joinClause} ${whereClause}`, vals, 'testing');
    expect(result).toEqual([domain]);
  });

  it('findByRepositoryId should return and empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const repositoryId = casual.integer(1, 999);
    const result = await ResearchDomain.findByRepositoryId('testing', context, repositoryId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let domain;

  beforeEach(() => {
    updateQuery = jest.fn();
    (ResearchDomain.update as jest.Mock) = updateQuery;

    domain = new ResearchDomain({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    })
  });

  it('returns the ResearchDomain with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (domain.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await domain.update(context);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the ResearchDomain has no id', async () => {
    const localValidator = jest.fn();
    (domain.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    domain.id = null;
    const result = await domain.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated ResearchDomain', async () => {
    const localValidator = jest.fn();
    (domain.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(domain);

    const mockFindById = jest.fn();
    (ResearchDomain.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(domain);

    const result = await domain.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ResearchDomain);
  });
});

describe('create', () => {
  const originalInsert = ResearchDomain.insert;
  let insertQuery;
  let domain;

  beforeEach(() => {
    insertQuery = jest.fn();
    (ResearchDomain.insert as jest.Mock) = insertQuery;

    domain = new ResearchDomain({
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    ResearchDomain.insert = originalInsert;
  });

  it('returns the ResearchDomain without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (domain.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await domain.create(context);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the ResearchDomain with errors if it is invalid', async () => {
    domain.name = undefined;
    const response = await domain.create(context);
    expect(response.errors['name']).toBe('Name can\'t be blank');
  });

  it('returns the ResearchDomain with an error if the object already exists', async () => {
    const mockFindBy = jest.fn();
    (ResearchDomain.findByURI as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(domain);

    const result = await domain.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added ResearchDomain', async () => {
    const mockFindbyURI = jest.fn();
    (ResearchDomain.findByURI as jest.Mock) = mockFindbyURI;
    mockFindbyURI.mockResolvedValueOnce(null);

    const mockFindByName = jest.fn();
    (ResearchDomain.findByName as jest.Mock) = mockFindByName;
    mockFindByName.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (ResearchDomain.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(domain);

    const result = await domain.create(context);
    expect(mockFindbyURI).toHaveBeenCalledTimes(1);
    expect(mockFindByName).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ResearchDomain);
  });
});

describe('delete', () => {
  let domain;

  beforeEach(() => {
    domain = new ResearchDomain({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  })

  it('returns null if the ResearchDomain has no id', async () => {
    domain.id = null;
    expect(await domain.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (ResearchDomain.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await domain.delete(context)).toBe(null);
  });

  it('returns the ResearchDomain if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (ResearchDomain.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(domain);

    const mockFindById = jest.fn();
    (ResearchDomain.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(domain);

    const result = await domain.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result.errors).toEqual({});
    expect(result).toBeInstanceOf(ResearchDomain);
  });
});

describe('addToRepository', () => {
  let context;
  let mockDomain;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockDomain = new ResearchDomain({
      id: casual.integer(1, 99),
      label: casual.word,
      url: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the ResearchDomain to the specified Repository', async () => {
    const repositoryId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(mockDomain);
    const result = await mockDomain.addToRepository(context, repositoryId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    let expectedSql = 'INSERT INTO repositoryResearchDomains (researchDomainId, repositoryId, createdById,';
    expectedSql += 'modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockDomain.id.toString(), repositoryId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'ResearchDomain.addToRepository')
    expect(result).toBe(true);
  });

  it('returns null if the domain cannot be associated with the Repository', async () => {
    const repositoryId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(null);
    const result = await mockDomain.addToRepository(context, repositoryId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('addToMetadataStandard', () => {
  let context;
  let mockDomain;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockDomain = new ResearchDomain({
      id: casual.integer(1, 99),
      label: casual.word,
      url: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the ResearchDomain to the specified MetadataStandard', async () => {
    const standardId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(mockDomain);
    const result = await mockDomain.addToMetadataStandard(context, standardId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    let expectedSql = 'INSERT INTO metadataStandardResearchDomains (researchDomainId, metadataStandardId, '
    expectedSql += 'createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockDomain.id.toString(), standardId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'ResearchDomain.addToMetadataStandard');
    expect(result).toBe(true);
  });

  it('returns null if the domain cannot be associated with the MetadataStandard', async () => {
    const standardId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(null);
    const result = await mockDomain.addToMetadataStandard(context, standardId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('removeFromRepository', () => {
  let context;
  let mockDomain;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockDomain = new ResearchDomain({
      id: casual.integer(1, 99),
      label: casual.word,
      url: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the ResearchDomain association with the specified Repository', async () => {
    const repositoryId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(mockDomain);
    const result = await mockDomain.removeFromRepository(context, repositoryId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'DELETE FROM repositoryResearchDomains WHERE researchDomainId = ? AND repositoryId = ?';
    const vals = [mockDomain.id.toString(), repositoryId.toString()]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'ResearchDomain.removeFromRepository');
    expect(result).toBe(true);
  });

  it('returns null if the domain cannot be removed from the Repository', async () => {
    const repositoryId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(null);
    const result = await mockDomain.removeFromRepository(context, repositoryId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('removeFromMetadataStandard', () => {
  let context;
  let mockDomain;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockDomain = new ResearchDomain({
      id: casual.integer(1, 99),
      label: casual.word,
      url: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the ResearchDomain association from the specified MetadataStandard', async () => {
    const standardId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(mockDomain);
    const result = await mockDomain.removeFromMetadataStandard(context, standardId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'DELETE FROM metadataStandardResearchDomains WHERE researchDomainId = ? AND metadataStandardId = ?';
    const vals = [mockDomain.id.toString(), standardId.toString()]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'ResearchDomain.removeFromMetadataStandard')
    expect(result).toBe(true);
  });

  it('returns null if the domain cannot be removed from the MetadataStandard', async () => {
    const standardId = casual.integer(1, 999);
    const querySpy = jest.spyOn(ResearchDomain, 'query').mockResolvedValueOnce(null);
    const result = await mockDomain.removeFromMetadataStandard(context, standardId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});
