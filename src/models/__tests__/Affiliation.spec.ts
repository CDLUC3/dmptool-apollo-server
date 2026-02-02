import casual from "casual";
import { Affiliation, AffiliationSearch, PopularFunder } from "../Affiliation";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { DMPHubConfig } from "../../config/dmpHubConfig";
import { generalConfig } from "../../config/generalConfig";
import { logger } from "../../logger";
import { PaginationType } from "../../types/general";

let context;
jest.mock('../../context.ts');

describe('Affiliation', () => {
  let affiliation;
  const affiliationData = {
    uri: 'https://ror.org/01234',
    active: true,
    provenance: 'ROR',
    name: 'University of Virginia',
    displayName: 'University of Virginia (virginia.edu)',
    searchName: 'University of Virginia | virginia.edu | UVA ',
    funder: 1,
    fundrefId: 1000001234,
    homepage: 'http://www.virginia.edu/',
    acronyms: ["UVA"],
    aliases: [],
    types: ["Education"],
    contactName: 'Data Management Consulting Group',
    contactEmail: 'admin@virginia.edu',
    ssoEntityId: 'entity:virginia.edu',
    feedbackEnabled: 1,
    feedbackMessage: '<p>Will response to your request within 48 hours</p>',
    feedbackEmails: ["admin@virginia.edu"],
    managed: 1,
    apiTarget: 'api/test',
  }
  beforeEach(() => {
    affiliation = new Affiliation(affiliationData);
  });

  it('should initialize options as expected', () => {
    expect(affiliation.uri).toEqual(affiliationData.uri);
    expect(affiliation.active).toEqual(affiliationData.active);
    expect(affiliation.provenance).toEqual(affiliationData.provenance);
    expect(affiliation.name).toEqual(affiliationData.name);
    expect(affiliation.displayName).toEqual(affiliationData.displayName);
    expect(affiliation.searchName).toEqual(affiliationData.searchName);
    expect(affiliation.funder).toEqual(affiliationData.funder);
    expect(affiliation.fundrefId).toEqual(affiliationData.fundrefId);
    expect(affiliation.homepage).toEqual(affiliationData.homepage);
    expect(affiliation.acronyms).toEqual(affiliationData.acronyms);
    expect(affiliation.aliases).toEqual(affiliationData.aliases);
    expect(affiliation.types).toEqual(affiliationData.types);
    expect(affiliation.contactName).toEqual(affiliationData.contactName);
    expect(affiliation.contactEmail).toEqual(affiliationData.contactEmail);
    expect(affiliation.ssoEntityId).toEqual(affiliationData.ssoEntityId);
    expect(affiliation.feedbackEnabled).toEqual(affiliationData.feedbackEnabled);
    expect(affiliation.feedbackMessage).toEqual(affiliationData.feedbackMessage);
    expect(affiliation.feedbackEmails).toEqual(affiliationData.feedbackEmails);
    expect(affiliation.managed).toEqual(affiliationData.managed);
    expect(affiliation.apiTarget).toEqual(affiliationData.apiTarget);
  });

  it('should add additional properties to uneditableProperties if provenance is ROR', async () => {
    expect(await affiliation.uneditableProperties).toEqual(['uri', 'provenance', 'searchName', 'name', 'funder', 'fundrefId', 'homepage', 'acronyms', 'aliases', 'types']);
  });
});

describe('prepForSave', () => {
  it('sets the appropriate defaults', () => {
    const name = casual.company_name;
    const homepage = casual.url;
    const acronyms = [casual.letter, casual.word, undefined];
    const aliases = [casual.words(2), casual.word, null];
    const affiliation = new Affiliation({ name, homepage, acronyms, aliases });
    const domain = homepage.replace(/https?:\/\//, '').replace('/', '').toLowerCase();
    affiliation.prepForSave();
    expect(affiliation.name).toEqual(name);
    expect(affiliation.homepage).toEqual(homepage);
    expect(affiliation.displayName).toEqual(`${name} (${domain})`);
    expect(affiliation.searchName.includes(name)).toBe(true);
    expect(affiliation.searchName.includes(domain)).toBe(true);
    expect(affiliation.searchName.includes(aliases[0])).toBe(true);
    expect(affiliation.searchName.includes(aliases[1])).toBe(true);
    expect(affiliation.searchName.includes(acronyms[0])).toBe(true);
    expect(affiliation.searchName.includes(acronyms[1])).toBe(true);
    expect(affiliation.searchName.includes('undefined')).toBe(false);
    expect(affiliation.searchName.includes('null')).toBe(false);
    expect(affiliation.searchName.includes('||')).toBe(false);
    expect(affiliation.searchName.includes('| |')).toBe(false);
  });
});

describe('findById', () => {
  const originalQuery = Affiliation.query;

  let localQuery;
  let context;
  let affiliation;

  beforeEach(async() => {
    jest.clearAllMocks();

    context = await buildMockContextWithToken(logger);

    affiliation = new Affiliation({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })

    localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;
  });

  afterEach(() => {
    jest.resetAllMocks();
    Affiliation.query = originalQuery;
  });

  it('should return the Affiliation when findById gets a result', async () => {
    localQuery.mockResolvedValueOnce([affiliation]);

    const id = affiliation.id;
    const result = await Affiliation.findById('Test', context, affiliation.id);
    const expectedSql = 'SELECT * FROM affiliations WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
    expect(result).toEqual(affiliation);
  });

  it('should return null when findById has no results', async () => {
    localQuery.mockResolvedValueOnce([]);

    const result = await Affiliation.findById('Test', context, affiliation.id);
    expect(result).toEqual(null);
  });
});

describe('create', () => {
  const originalInsert = Affiliation.insert;
  const originalFindById = Affiliation.findById;
  const originalFindByURI = Affiliation.findByURI;
  let insertQuery;
  let affiliation;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    insertQuery = jest.fn();
    (Affiliation.insert as jest.Mock) = insertQuery;

    affiliation = new Affiliation({
      uri: 'https://ror.org/01234',
      active: true,
      provenance: 'ROR',
      name: 'University of Virginia',
      displayName: 'University of Virginia (virginia.edu)',
      searchName: 'University of Virginia | virginia.edu | UVA ',
      funder: 1,
      fundrefId: 1000001234,
      homepage: 'http://www.virginia.edu/',
      acronyms: ["UVA"],
      aliases: [],
      types: ["Education"],
      contactName: 'Data Management Consulting Group',
      contactEmail: 'admin@virginia.edu',
      ssoEntityId: 'entity:virginia.edu',
      feedbackEnabled: 1,
      feedbackMessage: '<p>Will response to your request within 48 hours</p>',
      feedbackEmails: ["admin@virginia.edu"],
      managed: 1,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Affiliation.insert = originalInsert;
    Affiliation.findById = originalFindById;
    Affiliation.findByURI = originalFindByURI;
  });

  it('should return the newly added Affiliation', async () => {
    const mockFindByURI = jest.fn();
    (Affiliation.findByURI as jest.Mock) = mockFindByURI;
    mockFindByURI.mockResolvedValue(false);

    const mockFindById = jest.fn();
    (Affiliation.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(affiliation);

    const result = await affiliation.create(context);
    expect(mockFindByURI).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should add an error if affiliation already exists', async () => {
    const mockFindByURI = jest.fn();
    (Affiliation.findByURI as jest.Mock) = mockFindByURI;
    mockFindByURI.mockResolvedValue(true);

    const mockFindById = jest.fn();
    (Affiliation.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(affiliation);

    await affiliation.create(context);
    expect(affiliation.errors['general']).toBeTruthy();
  });
});

describe('update', () => {
  const originalUpdate = Affiliation.update;
  let updateQuery;
  let affiliation;

  beforeEach(async() => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    affiliation = new Affiliation({
      id: casual.integer(1, 999),
      uri: 'https://ror.org/01234',
      active: true,
      provenance: 'ROR',
      name: 'University of Virginia',
      displayName: 'University of Virginia (virginia.edu)',
      searchName: 'University of Virginia | virginia.edu | UVA ',
      funder: 1,
      fundrefId: 1000001234,
      homepage: 'http://www.virginia.edu/',
      acronyms: ["UVA"],
      aliases: [],
      types: ["Education"],
      contactName: 'Data Management Consulting Group',
      contactEmail: 'admin@virginia.edu',
      ssoEntityId: 'entity:virginia.edu',
      feedbackEnabled: 1,
      feedbackMessage: '<p>Will response to your request within 48 hours</p>',
      feedbackEmails: ["admin@virginia.edu"],
      managed: 1,
      createdById: casual.integer(1, 999),
      modifiedById: casual.integer(1, 999),
    })
    updateQuery = jest.fn().mockResolvedValue(affiliation);
    (Affiliation.update as jest.Mock) = updateQuery;
  });

  afterEach(() => {
    jest.clearAllMocks();
    Affiliation.update = originalUpdate;
  });

  it('should return Affiliation with no errors if affiliation is valid', async () => {
    const localValidator = jest.fn();
    (affiliation.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);
    const findByQuery = jest.fn().mockResolvedValue(affiliation);
    (Affiliation.findById as jest.Mock) = findByQuery;
    const result = await affiliation.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});

describe('delete', () => {
  const originalDelete = Affiliation.delete;
  let deleteQuery;
  let affiliation;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    affiliation = new Affiliation({
      id: casual.integer(1, 99),
      uri: 'http://test.com',
      createdById: casual.integer(1, 999),
      ownerId: casual.url,
      name: casual.sentence,
    });
    deleteQuery = jest.fn().mockResolvedValue(affiliation);
    (Affiliation.delete as jest.Mock) = deleteQuery;
  });

  afterEach(() => {
    jest.clearAllMocks();
    Affiliation.delete = originalDelete;
  });

  it('should return Affiliation if there is uri data', async () => {
    const result = await affiliation.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('should return null if there is no uri data', async () => {
    affiliation = new Affiliation({
      id: casual.integer(1, 99),
      createdById: casual.integer(1, 999),
      ownerId: casual.url,
      name: casual.sentence,
    });

    expect(await affiliation.delete(context)).toBe(null);
  })
});

describe('findByURI', () => {
  const originalQuery = Affiliation.query;

  let localQuery;
  let context;
  let affiliation;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = await buildMockContextWithToken(logger);

    affiliation = new Affiliation({
      id: casual.integer(1, 9),
      uri: 'http://test.com',
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })

    localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;
  });

  afterEach(() => {
    jest.resetAllMocks();
    Affiliation.query = originalQuery;
  });

  it('should return the Affiliation when findByURI gets a result', async () => {
    localQuery.mockResolvedValueOnce([affiliation]);

    const id = affiliation.uri;
    const result = await Affiliation.findByURI('Test', context, affiliation.uri);
    const expectedSql = 'SELECT * FROM affiliations WHERE uri = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id], 'Test')
    expect(result).toEqual(affiliation);
  });

  it('should return null when findByURI has no results', async () => {
    localQuery.mockResolvedValueOnce([]);

    const result = await Affiliation.findByURI('Test', context, affiliation.id);
    expect(result).toEqual(null);
  });
});

describe('findByName', () => {
  const originalQuery = Affiliation.query;

  let localQuery;
  let context;
  let affiliation;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = await buildMockContextWithToken(logger);

    affiliation = new Affiliation({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
      ssoEntityId: casual.url
    })

    localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;
  });

  afterEach(() => {
    jest.resetAllMocks();
    Affiliation.query = originalQuery;
  });

  it('should return the Affiliation when findByName gets a result', async () => {
    localQuery.mockResolvedValueOnce([affiliation]);

    const result = await Affiliation.findByName('Test', context, affiliation.name);
    const expectedSql = 'SELECT * FROM affiliations WHERE TRIM(LOWER(name)) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliation.name.toLowerCase()], 'Test')
    expect(result).toEqual(affiliation);
  });

  it('should return null when findByName has no results', async () => {
    localQuery.mockResolvedValueOnce([]);

    const result = await Affiliation.findByName('Test', context, affiliation.name);
    expect(result).toEqual(null);
  });

  it('should return the Affiliation when findByEntityId gets a result', async () => {
    localQuery.mockResolvedValueOnce([affiliation]);

    const result = await Affiliation.findByEntityId('Test', context, affiliation.ssoEntityId);
    const expectedSql = 'SELECT * FROM affiliations WHERE TRIM(LOWER(ssoEntityId)) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliation.ssoEntityId.toLowerCase()], 'Test')
    expect(result).toEqual(affiliation);
  });

  it('should return null when findByEntityId has no results', async () => {
    localQuery.mockResolvedValueOnce([]);

    const result = await Affiliation.findByEntityId('Test', context, affiliation.ssoEntityId);
    expect(result).toEqual(null);
  });
});

describe('AffiliationSearch', () => {
  let affiliationSearch;

  const affiliationSearchData = new AffiliationSearch({
    id: casual.integer(1, 9),
    uri: 'https://ror.org/01234',
    displayName: 'University of Virginia (virginia.edu)',
    funder: 1,
    types: ["Education"],
    apiTarget: `${DMPHubConfig.dmpHubURL}/api/test`,
  });
  beforeEach(() => {
    affiliationSearch = new AffiliationSearch(affiliationSearchData);
  });

  it('should initialize AffiliationSerach options as expected', () => {
    expect(affiliationSearch.uri).toEqual(affiliationSearchData.uri);
    expect(affiliationSearch.id).toEqual(affiliationSearchData.id);
    expect(affiliationSearch.displayName).toEqual(affiliationSearchData.displayName);
    expect(affiliationSearch.funder).toEqual(affiliationSearchData.funder);
    expect(affiliationSearch.types).toEqual(affiliationSearchData.types);
    expect(affiliationSearch.apiTarget).toEqual(affiliationSearchData.apiTarget);
  });
});

describe('search', () => {
  const originalQuery = Affiliation.query;

  let localQuery;
  let context;
  let affiliationSearch;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Affiliation.queryWithPagination as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    affiliationSearch = new AffiliationSearch({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
      apiTarget: casual.url,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Affiliation.query = originalQuery;
  });

  it('should call query with correct params and return the affiliation', async () => {
    localQuery.mockResolvedValueOnce([affiliationSearch]);
    const term = 'Test';
    const result = await AffiliationSearch.search('Test', context, term, true);
    const sql = 'SELECT a.* FROM affiliations a';
    const whereFilters = ['a.active = 1', '(LOWER(a.searchName) LIKE ?)', 'a.funder = 1'];
    const vals = [`%${term.toLowerCase().trim()}%`];
    const sortFields =  ["a.displayName", "a.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'a.displayName',
      sortDir: 'ASC',
      countField: 'a.id',
      cursorField: 'a.id',
      availableSortFields: sortFields,
    };
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'Test')
    expect(result).toEqual([affiliationSearch]);
  });

  it('should allow funderOnly to be false', async () => {
    localQuery.mockResolvedValueOnce([affiliationSearch]);
    const term = 'Test';
    const result = await AffiliationSearch.search('Test', context, term, false);
    const sql = 'SELECT a.* FROM affiliations a';
    const whereFilters = ['a.active = 1', '(LOWER(a.searchName) LIKE ?)'];
    const vals = [`%${term.toLowerCase().trim()}%`];
    const sortFields =  ["a.displayName", "a.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'a.displayName',
      sortDir: 'ASC',
      countField: 'a.id',
      cursorField: 'a.id',
      availableSortFields: sortFields,
    };
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'Test')
    expect(result).toEqual([affiliationSearch]);
  });

  it('should return an empty array if it finds no affiliation', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await AffiliationSearch.search('Test', context, 'test', true);
    expect(result).toEqual([]);
  });
});

describe('PopularFunder', () => {
  let popularFunder;

  const popularFunderData = {
    id: casual.integer(1, 9),
    uri: 'https://ror.org/01234',
    displayName: 'University of Virginia (virginia.edu)',
    apiTarget: casual.url,
    nbrPlans: casual.integer(1, 999),
  }
  beforeEach(() => {
    popularFunder = new PopularFunder(popularFunderData);
  });

  it('should initialize options as expected', () => {
    expect(popularFunder.id).toEqual(popularFunderData.id);
    expect(popularFunder.uri).toEqual(popularFunderData.uri);
    expect(popularFunder.displayName).toEqual(popularFunderData.displayName);
    expect(popularFunder.apiTarget).toEqual(popularFunderData.apiTarget);
    expect(popularFunder.nbrPlans).toEqual(popularFunderData.nbrPlans);
  });
});

describe('top5', () => {
  it('should call query with correct params and return the popular funders', async () => {
    const context = await buildMockContextWithToken(logger);
    const localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;

    const popularFunder = new PopularFunder({
      id: casual.integer(1, 9),
      uri: 'https://ror.org/01234',
      displayName: 'University of Virginia (virginia.edu)',
      apiTarget: casual.url,
      nbrPlans: casual.integer(1, 999),
    });

    localQuery.mockResolvedValueOnce([popularFunder]);
    const result = await PopularFunder.top5(context);
    const expectedSql = 'SELECT a.id, a.uri, a.displayName, a.apiTarget, COUNT(p.id) AS nbrPlans ' +
                        'FROM affiliations a LEFT JOIN projectFundings pf ON pf.affiliationId = a.uri ' +
                        'LEFT JOIN projects p ON p.id = pf.projectId WHERE a.active = 1 AND a.funder = 1 ' +
                        'AND p.isTestProject = 0 AND p.created BETWEEN ? AND ? GROUP BY a.id, a.uri, ' +
                        'a.displayName ORDER BY nbrPlans DESC LIMIT 5';
    // Get the date range for the past year
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);
    const startDate = lastYear.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(
      context,
      expectedSql,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`],
      'PopularFunder.top5'
    );
    expect(result).toEqual([popularFunder]);
  });

  it('should return an empty array if it finds no popular funders', async () => {
    const context = await buildMockContextWithToken(logger);
    const localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;

    localQuery.mockResolvedValueOnce([]);
    const result = await PopularFunder.top5(context);
    expect(result).toEqual([]);
  });

  it('should throw an error if the query fails', async () => {
    const context = await buildMockContextWithToken(logger);
    const localQuery = jest.fn();
    (Affiliation.query as jest.Mock) = localQuery;

    localQuery.mockRejectedValueOnce(new Error('Query failed'));
    await expect(PopularFunder.top5(context)).rejects.toThrow('Query failed');
  });
});

describe('searchManagedWithPublishedGuidance', () => {
  let localQueryWithPagination;
  let context;
  let affiliationSearch;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQueryWithPagination = jest.fn();
    (Affiliation.queryWithPagination as jest.Mock) = localQueryWithPagination;

    context = await buildMockContextWithToken(logger);

    affiliationSearch = new AffiliationSearch({
      id: casual.integer(1, 9),
      uri: 'https://ror.org/01234',
      displayName: 'University of Virginia (virginia.edu)',
      managed: 1,
      apiTarget: casual.url,
    });
  });

  it('should call queryWithPagination with correct params and return paginated results', async () => {
    const name = 'Virginia';
    const affiliationUris = ['https://ror.org/01234', 'https://ror.org/56789'];
    const options = { sortField: undefined, sortDir: undefined, type: PaginationType.OFFSET };
    const expectedOpts = expect.objectContaining({
      type: PaginationType.OFFSET,
      sortField: 'a.displayName',
      sortDir: 'ASC',
      availableSortFields: ['a.displayName', 'a.created'],
      countField: 'a.id',
    });
    localQueryWithPagination.mockResolvedValueOnce({ results: [affiliationSearch], totalCount: 1 });

    const result = await AffiliationSearch.searchManagedWithPublishedGuidance(
      'TestRef',
      context,
      name,
      affiliationUris,
      options
    );

    const expectedSql = 'SELECT a.* FROM affiliations a';
    const expectedWhere = [
      'a.active = 1',
      'a.managed = 1',
      'a.uri IN (?,?)',
      '(LOWER(a.searchName) LIKE ?)',
    ];
    const expectedGroupBy = '';
    const expectedVals = [...affiliationUris, `%${name.toLowerCase().trim()}%`];

    expect(localQueryWithPagination).toHaveBeenCalledTimes(1);
    expect(localQueryWithPagination).toHaveBeenLastCalledWith(
      context,
      expectedSql,
      expectedWhere,
      expectedGroupBy,
      expectedVals,
      expectedOpts,
      'TestRef'
    );
    expect(result).toEqual({ results: [affiliationSearch], totalCount: 1 });
  });

  it('should handle no search term and no URI filter', async () => {
    localQueryWithPagination.mockResolvedValueOnce({ results: [], totalCount: 0 });

    const result = await AffiliationSearch.searchManagedWithPublishedGuidance(
      'TestRef',
      context,
      undefined, // name
      undefined, // affiliationUris
      { type: PaginationType.OFFSET }
    );

    expect(localQueryWithPagination).toHaveBeenCalledWith(
      context,
      'SELECT a.* FROM affiliations a',
      [
        'a.active = 1',
        'a.managed = 1',
      ],
      '',
      [],
      expect.any(Object),
      'TestRef'
    );
    expect(result).toEqual({ results: [], totalCount: 0 });
  });

  it('should propagate errors from queryWithPagination', async () => {
    localQueryWithPagination.mockRejectedValueOnce(new Error('Query failed'));
    await expect(
      AffiliationSearch.searchManagedWithPublishedGuidance('TestRef', context, 'foo', undefined, { type: PaginationType.OFFSET })
    ).rejects.toThrow('Query failed');
  });
});
