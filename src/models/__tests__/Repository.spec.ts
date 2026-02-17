import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { Repository, REPOSITORY_TYPE } from "../Repository";
import { generalConfig } from "../../config/generalConfig";
import { logger } from "../../logger";
import { isCustomRepository, isRe3DataRepository } from "../../types/repository";

jest.mock('../../context.ts');

let context;

// Helper function to get a random repository type value
const getRandomRepositoryType = (): string => {
  const types = Object.values(REPOSITORY_TYPE);
  return types[Math.floor(Math.random() * types.length)];
};

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Repository', () => {
  let repo;

  const repoData = {
    name: casual.company_name,
    uri: casual.url,
    description: casual.sentences(3),
    website: casual.url,
    researchDomains: [{ id: casual.integer(1, 99) }],
    repositoryTypes: [getRandomRepositoryType(), getRandomRepositoryType()],
    keywords: [casual.word, casual.word],
  }
  beforeEach(() => {
    repo = new Repository(repoData);
  });

  it('should initialize options as expected', () => {
    expect(repo.name).toEqual(repoData.name);
    expect(repo.uri).toEqual(repoData.uri);
    expect(repo.description).toEqual(repoData.description);
    expect(repo.website).toEqual(repoData.website);
    expect(repo.repositoryTypes).toEqual(repoData.repositoryTypes);
    expect(repo.researchDomains).toEqual(repoData.researchDomains);
    expect(repo.keywords).toEqual(repoData.keywords);
  });

  it('should initialize with re3dataId when provided', () => {
    const repoWithRe3Data = new Repository({
      ...repoData,
      re3dataId: 'r3d100014782',
    });
    expect(repoWithRe3Data.re3dataId).toEqual('r3d100014782');
  });

  it('should initialize with undefined re3dataId when not provided', () => {
    expect(repo.re3dataId).toBeUndefined();
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await repo.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the name field is missing', async () => {
    repo.name = null;
    expect(await repo.isValid()).toBe(false);
    expect(Object.keys(repo.errors).length).toBe(1);
    expect(repo.errors['name']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is missing', async () => {
    repo.uri = null;
    expect(await repo.isValid()).toBe(false);
    expect(Object.keys(repo.errors).length).toBe(1);
    expect(repo.errors['uri']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is not a URI', async () => {
    repo.uri = casual.uuid;
    expect(await repo.isValid()).toBe(false);
    expect(Object.keys(repo.errors).length).toBe(1);
    expect(repo.errors['uri']).toBeTruthy();
  });

  it('should return false when calling isValid if the website field is not a URI', async () => {
    repo.website = casual.uuid;
    expect(await repo.isValid()).toBe(false);
    expect(Object.keys(repo.errors).length).toBe(1);
    expect(repo.errors['website']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = Repository.query;

  let localQuery;
  let localPaginationQuery
  let context;
  let repo;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Repository.query as jest.Mock) = localQuery;

    localPaginationQuery = jest.fn();
    (Repository.queryWithPagination as jest.Mock) = localPaginationQuery;

    context = await buildMockContextWithToken(logger);

    repo = new Repository({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Repository.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([repo]);
    const repoId = casual.integer(1, 999);
    const result = await Repository.findById('testing', context, repoId);
    const expectedSql = 'SELECT * FROM repositories WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [repoId.toString()], 'testing')
    expect(result).toEqual(repo);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const repoId = casual.integer(1, 999);
    const result = await Repository.findById('testing', context, repoId);
    expect(result).toEqual(null);
  });

  it('findByURI should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([repo]);
    const uri = casual.url;
    const result = await Repository.findByURI('testing', context, uri);
    const expectedSql = 'SELECT * FROM repositories WHERE uri = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [uri], 'testing')
    expect(result).toEqual(repo);
  });

  it('findByURI should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const uri = casual.url;
    const result = await Repository.findByURI('testing', context, uri);
    expect(result).toEqual(null);
  });

    it('findByURIs should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([repo]);
    const uris = [casual.url, casual.url];
    const result = await Repository.findByURIs('testing', context, uris);
    const expectedSql = `SELECT * FROM repositories WHERE uri IN (?, ?)`;
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, uris, 'testing');
    expect(result).toEqual([repo]);
  });


  it('findByName should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([repo]);
    const name = casual.company_name;
    const result = await Repository.findByName('testing', context, name.toLowerCase().trim());
    const expectedSql = 'SELECT * FROM repositories WHERE LOWER(name) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [name.toLowerCase().trim()], 'testing')
    expect(result).toEqual(repo);
  });

  it('findByName should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const name = casual.company_name;
    const result = await Repository.findByName('testing', context, name);
    expect(result).toEqual(null);
  });

  it('findByResearchDomainId should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([repo]);
    const id = casual.integer(1, 99);
    const result = await Repository.findByResearchDomainId('testing', context, id);
    const sql = 'SELECT r.* FROM repositories r';
    const joinClause = 'INNER JOIN repositoryResearchDomains rrd ON r.id = rrd.repositoryId';
    const whereClause = 'WHERE rrd.researchDomainId = ?';
    const vals = [id.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, `${sql} ${joinClause} ${whereClause}`, vals, 'testing')
    expect(result).toEqual([repo]);
  });

  it('findByResearchDomainId should return an empty array if there are no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = casual.integer(1, 99);
    const result = await Repository.findByResearchDomainId('testing', context, id);
    expect(result).toEqual([]);
  });

  it('search should work when a search term and repositoryType are specified', async () => {
    localPaginationQuery.mockResolvedValueOnce([repo]);
    const term = casual.words(3);
    const repositoryTypes = Object.values(REPOSITORY_TYPE);
    const repositoryType = repositoryTypes[Math.floor(Math.random() * repositoryTypes.length)];
    const result = await Repository.search('testing', context, term, [], null, repositoryType);
    const sql = 'SELECT r.* FROM repositories r';
    const vals = [`%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`,
                  JSON.stringify(repositoryType)];
    const whereFilters = ['(LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.keywords) LIKE ?)',
                          'JSON_CONTAINS(r.repositoryTypes, ?, \'$\')'];
    const sortFields = ["r.name", "r.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'r.name',
      sortDir: 'ASC',
      countField: 'r.id',
      cursorField: 'r.id',
      availableSortFields: sortFields,
    };
    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenCalledWith(context, sql, whereFilters, '', vals, opts, 'testing');
    expect(result).toEqual([repo]);
  });

  it('search should work when no filters are specified', async () => {
    localPaginationQuery.mockResolvedValueOnce([repo]);
    const result = await Repository.search('testing', context, null, [], null, null);
    const sql = 'SELECT r.* FROM repositories r';
    const vals = ['%%', '%%', '%%'];
    const whereFilters = [
      '(LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.keywords) LIKE ?)'
    ];
    const sortFields = ["r.name", "r.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'r.name',
      sortDir: 'ASC',
      countField: 'r.id',
      cursorField: 'r.id',
      availableSortFields: sortFields,
    };
    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenCalledWith(context, sql, whereFilters, '', vals, opts, 'testing');
    expect(result).toEqual([repo]);
  });

  it('search should work when only a Repository Type is specified', async () => {
    localPaginationQuery.mockResolvedValueOnce([repo]);
    const repositoryTypes = Object.values(REPOSITORY_TYPE);
    const repositoryType = repositoryTypes[Math.floor(Math.random() * repositoryTypes.length)];
    const result = await Repository.search('testing', context, null, [], null, repositoryType);
    const sql = 'SELECT r.* FROM repositories r';
    const vals = ['%%', '%%', '%%', JSON.stringify(repositoryType)];
    const whereFilters = [
      '(LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.keywords) LIKE ?)',
      'JSON_CONTAINS(r.repositoryTypes, ?, \'$\')'
    ];
    const sortFields = ["r.name", "r.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'r.name',
      sortDir: 'ASC',
      countField: 'r.id',
      cursorField: 'r.id',
      availableSortFields: sortFields,
    };
    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'testing')
    expect(result).toEqual([repo]);
  });

  it('search should work when only a search term is specified', async () => {
    localPaginationQuery.mockResolvedValueOnce([repo]);
    const term = casual.words(3);
    const result = await Repository.search('testing', context, term, [], null, null);
    const sql = 'SELECT r.* FROM repositories r';
    const vals = [`%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`];
    const whereFilters = ['(LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.keywords) LIKE ?)'];
    const sortFields = ["r.name", "r.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'r.name',
      sortDir: 'ASC',
      countField: 'r.id',
      cursorField: 'r.id',
      availableSortFields: sortFields,
    };
    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'testing')
    expect(result).toEqual([repo]);
  });

  it('search should return empty array if it finds no records', async () => {
    localPaginationQuery.mockResolvedValueOnce([]);
    const term = casual.words(3);
    const repositoryTypes = Object.values(REPOSITORY_TYPE);
    const repositoryType = repositoryTypes[Math.floor(Math.random() * repositoryTypes.length)];
    const result = await Repository.search('testing', context, term, [], null, repositoryType);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let repo;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Repository.update as jest.Mock) = updateQuery;

    repo = new Repository({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    })
  });

  it('returns the Repository with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (repo.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await repo.update(context);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Repository has no id', async () => {
    const localValidator = jest.fn();
    (repo.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    repo.id = null;
    const result = await repo.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated Repository', async () => {
    const localValidator = jest.fn();
    (repo.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(repo);

    const mockFindById = jest.fn();
    (Repository.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(repo);

    const result = await repo.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Repository);
  });
});

describe('create', () => {
  const originalInsert = Repository.insert;
  let insertQuery;
  let repo;

  beforeEach(() => {
    insertQuery = jest.fn();
    (Repository.insert as jest.Mock) = insertQuery;

    repo = new Repository({
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    Repository.insert = originalInsert;
  });

  it('returns the Repository without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (repo.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    // Mock findByURI and findByName to return null so repo is considered new
    const mockFindByURI = jest.fn();
    (Repository.findByURI as jest.Mock) = mockFindByURI;
    mockFindByURI.mockResolvedValueOnce(null);

    const mockFindByName = jest.fn();
    (Repository.findByName as jest.Mock) = mockFindByName;
    mockFindByName.mockResolvedValueOnce(null);

    // Mock insert and findById for successful creation
    const mockInsert = jest.fn();
    (Repository.insert as jest.Mock) = mockInsert;
    mockInsert.mockResolvedValueOnce(123); // fake new id

    const mockFindById = jest.fn();
    (Repository.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(repo);

    const result = await repo.create(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the Repository with errors if it is not valid', async () => {
    repo.name = null; // Make repo invalid so errors are set

    const result = await repo.create(context);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    expect(result.errors['name']).toBe('Name can\'t be blank');
  });

  it('returns the Repository with errors if it is invalid', async () => {
    repo.name = undefined;
    const response = await repo.create(context);
    expect(response.errors['name']).toBe('Name can\'t be blank');
  });

  it('returns the Repository with an error if the object already exists', async () => {
    const mockFindBy = jest.fn();
    (Repository.findByURI as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(repo);

    const result = await repo.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added Repository', async () => {
    const mockFindbyURI = jest.fn();
    (Repository.findByURI as jest.Mock) = mockFindbyURI;
    mockFindbyURI.mockResolvedValueOnce(null);

    const mockFindByName = jest.fn();
    (Repository.findByName as jest.Mock) = mockFindByName;
    mockFindByName.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (Repository.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(repo);

    const result = await repo.create(context);
    expect(mockFindbyURI).toHaveBeenCalledTimes(1);
    expect(mockFindByName).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Repository);
  });
});

describe('delete', () => {
  let repo;

  beforeEach(() => {
    repo = new Repository({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  })

  it('returns null if the Repository has no id', async () => {
    repo.id = null;
    expect(await repo.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Repository.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await repo.delete(context)).toBe(null);
  });

  it('returns the Repository if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Repository.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(repo);

    const mockFindById = jest.fn();
    (Repository.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(repo);

    const result = await repo.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result.errors).toEqual({});
    expect(result).toBeInstanceOf(Repository);
  });
});

describe('Discriminator Functions', () => {
  describe('isCustomRepository', () => {
    it('should return true for custom repository with numeric ID', () => {
      const customRepo = {
        id: 123,
        name: 'Custom Repo',
      };
      expect(isCustomRepository(customRepo)).toBe(true);
    });

    it('should return true for custom repository with numeric string ID', () => {
      const customRepo = {
        id: '456',
        name: 'Custom Repo',
      };
      expect(isCustomRepository(customRepo)).toBe(true);
    });

    it('should return true for custom repository with re3dataId', () => {
      const customRepo = {
        id: 789,
        name: 'Custom Repo',
        re3dataId: 'r3d100014782',
      };
      expect(isCustomRepository(customRepo)).toBe(true);
    });

    it('should return false for non-numeric string ID (re3data)', () => {
      const re3dataRepo = {
        id: 'some-uuid-or-doi',
        name: 'Re3Data Repo',
      };
      expect(isCustomRepository(re3dataRepo)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isCustomRepository(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCustomRepository(undefined)).toBe(false);
    });

    it('should return false for object without id', () => {
      const obj = { name: 'No ID' };
      expect(isCustomRepository(obj)).toBe(false);
    });
  });

  describe('isRe3DataRepository', () => {
    it('should return true for re3data repository with non-numeric string ID', () => {
      const re3dataRepo = {
        id: 'r3d100014782',
        name: 'Re3Data Repo',
      };
      expect(isRe3DataRepository(re3dataRepo)).toBe(true);
    });

    it('should return true for re3data repository with UUID-like ID', () => {
      const re3dataRepo = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Re3Data Repo',
      };
      expect(isRe3DataRepository(re3dataRepo)).toBe(true);
    });

    it('should return false when re3dataId field is present', () => {
      const repo = {
        id: 'r3d100014782',
        name: 'Custom Repo',
        re3dataId: 'r3d100014782',
      };
      expect(isRe3DataRepository(repo)).toBe(false);
    });

    it('should return false for numeric ID (custom repository)', () => {
      const customRepo = {
        id: 123,
        name: 'Custom Repo',
      };
      expect(isRe3DataRepository(customRepo)).toBe(false);
    });

    it('should return false for numeric string ID (custom repository)', () => {
      const customRepo = {
        id: '456',
        name: 'Custom Repo',
      };
      expect(isRe3DataRepository(customRepo)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isRe3DataRepository(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRe3DataRepository(undefined)).toBe(false);
    });

    it('should return false for object without id', () => {
      const obj = { name: 'No ID' };
      expect(isRe3DataRepository(obj)).toBe(false);
    });
  });

  describe('Discriminator Function Exclusivity', () => {
    it('should not match the same object as both custom and re3data', () => {
      const customRepo = {
        id: 123,
        name: 'Custom Repo',
      };
      const isCustom = isCustomRepository(customRepo);
      const isRe3Data = isRe3DataRepository(customRepo);
      expect(isCustom && isRe3Data).toBe(false);
    });

    it('custom repo with re3dataId should only match isCustomRepository', () => {
      const repo = {
        id: 123,
        name: 'Custom Repo with Re3Data Reference',
        re3dataId: 'r3d100014782',
      };
      expect(isCustomRepository(repo)).toBe(true);
      expect(isRe3DataRepository(repo)).toBe(false);
    });

    it('re3data repo should only match isRe3DataRepository', () => {
      const repo = {
        id: 'r3d100014782',
        name: 'Re3Data Repo',
      };
      expect(isCustomRepository(repo)).toBe(false);
      expect(isRe3DataRepository(repo)).toBe(true);
    });
  });
});
