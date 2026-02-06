import casual from 'casual';
import { TemplateVisibility } from "../Template";
import {
  TemplateVersionType,
  VersionedTemplate,
  VersionedTemplateSearchResult,
  CustomizableTemplateSearchResult
} from '../VersionedTemplate';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { defaultLanguageId } from '../Language';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { generalConfig } from '../../config/generalConfig';
import { logger } from "../../logger";
import {
  PaginationOptions,
  PaginationOptionsForOffsets,
  PaginationOptionsForCursors,
  PaginationType,
  PaginatedQueryResults
} from '../../types/general';
import {
  TemplateCustomizationStatus,
  TemplateCustomizationMigrationStatus
} from '../TemplateCustomization';

jest.mock('../../context.ts');
jest.mock('../../logger');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('VersionedTemplateSearchResult', () => {
  const originalQuery = VersionedTemplate.query;

  let localQuery;
  let localPaginationQuery;
  let context;
  let versionedTemplateSearchResult;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedTemplate.query as jest.Mock) = localQuery;
    localPaginationQuery = jest.fn();
    (VersionedTemplate.queryWithPagination as jest.Mock) = localPaginationQuery;

    context = await buildMockContextWithToken(logger);

    versionedTemplateSearchResult = new VersionedTemplateSearchResult({
      id: casual.integer(1, 9),
      templateId: casual.integer(1, 99),
      name: casual.sentence,
      description: casual.sentences(5),
      version: `v${casual.integer(1, 9)}`,
      visibility: getRandomEnumValue(TemplateVisibility),
      bestPractice: casual.boolean,
      ownerId: casual.integer(1, 99),
      ownerURI: casual.url,
      ownerSearchName: casual.name,
      ownerDisplayName: casual.name,
      modifiedById: casual.integer(1, 999),
      modifiedByName: casual.name,
      modified: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedTemplate.query = originalQuery;
  });

  describe('search', () => {
    it('returns the matching VersionedTemplateSearchResults', async () => {
      localPaginationQuery.mockResolvedValueOnce([versionedTemplateSearchResult]);

      const term = versionedTemplateSearchResult.name.split(0, 5)[0];
      const result = await VersionedTemplateSearchResult.search('Test', context, term);
      const sql = 'SELECT vt.id, vt.templateId, vt.name, vt.description, vt.version, vt.visibility, vt.bestPractice, \
                            vt.modified, vt.modifiedById, TRIM(CONCAT(u.givenName, CONCAT(\' \', u.surName))) as modifiedByName, \
                            a.id as ownerId, vt.ownerId as ownerURI, a.displayName as ownerDisplayName, \
                            a.searchName as ownerSearchName \
                          FROM versionedTemplates vt \
                            LEFT JOIN users u ON u.id = vt.modifiedById \
                            LEFT JOIN affiliations a ON a.uri = vt.ownerId';
      const vals = [TemplateVersionType.PUBLISHED, `%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`];
      const whereFilters = ['vt.active = 1 AND vt.versionType = ?',
                            '(LOWER(vt.name) LIKE ? OR LOWER(a.searchName) LIKE ?)'];

      const sortFields = ["vt.name", "vt.created", "vt.visibility", "vt.bestPractice", "vt.modified"];

      const opts = {
        cursor: null,
        limit: generalConfig.defaultSearchLimit,
        sortField: 'vt.modified',
        sortDir: 'DESC',
        countField: 'vt.id',
        cursorField: 'vt.id',
        availableSortFields: sortFields
      };
      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'Test')
      expect(result).toEqual([versionedTemplateSearchResult]);
    });

    it('returns an empty array if there are no matching VersionedTemplateSearchResults', async () => {
      localPaginationQuery.mockResolvedValueOnce([]);

      const term = versionedTemplateSearchResult.name.split(0, 5)[0];
      const result = await VersionedTemplateSearchResult.search('Test', context, term);
      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe('findByAffiliationId', () => {
    it('returns the matching VersionedTemplateSearchResults', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplateSearchResult]);

      const affiliationId = versionedTemplateSearchResult.ownerURI;
      const result = await VersionedTemplateSearchResult.findByAffiliationId('Test', context, affiliationId);
      const sql = 'SELECT vt.id, vt.templateId, vt.name, vt.description, vt.version, vt.visibility, vt.bestPractice, ' +
                    'vt.modified, vt.modifiedById, TRIM(CONCAT(u.givenName, CONCAT(\' \', u.surName))) as modifiedByName, ' +
                    'a.id as ownerId, vt.ownerId as ownerURI, a.displayName as ownerDisplayName, ' +
                    'a.searchName as ownerSearchName ' +
                  'FROM versionedTemplates vt ' +
                    'LEFT JOIN users u ON u.id = vt.modifiedById ' +
                    'LEFT JOIN affiliations a ON a.uri = vt.ownerId ' +
                  'WHERE vt.ownerId = affiliationId AND vt.active = 1 AND vt.versionType = ? ' +
                  'ORDER BY vt.modified DESC;';
      const vals = [affiliationId, TemplateVersionType.PUBLISHED];
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, sql, vals, 'Test')
      expect(result).toEqual([versionedTemplateSearchResult]);
    });

    it('returns an empty array if there are no matching VersionedTemplateSearchResults', async () => {
      localQuery.mockResolvedValueOnce([]);

      const affiliationId = versionedTemplateSearchResult.ownerURI;
      const result = await VersionedTemplateSearchResult.findByAffiliationId('Test', context, affiliationId);
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });
});

describe('CustomizableTemplateSearchResult', () => {
  const originalQuery = VersionedTemplate.queryWithPagination;
  const originalGetDefaultPaginationOptions = VersionedTemplate.getDefaultPaginationOptions;

  let localPaginationQuery;
  let localGetDefaultPaginationOptions;
  let context;
  let customizableTemplateSearchResult;

  beforeEach(async () => {
    jest.resetAllMocks();

    localPaginationQuery = jest.fn();
    (VersionedTemplate.queryWithPagination as jest.Mock) = localPaginationQuery;

    localGetDefaultPaginationOptions = jest.fn();
    (VersionedTemplate.getDefaultPaginationOptions as jest.Mock) = localGetDefaultPaginationOptions;

    context = await buildMockContextWithToken(logger);
    context.token.affiliationId = 'test-affiliation-123';

    customizableTemplateSearchResult = new CustomizableTemplateSearchResult({
      versionedTemplateId: casual.integer(1, 999),
      templateCustomizationId: casual.integer(1, 999),
      affiliationId: 'test-affiliation-123',
      affiliationName: casual.company_name,
      name: casual.sentence,
      version: `v${casual.integer(1, 9)}`,
      description: casual.sentences(3),
      status: TemplateCustomizationStatus.DRAFT,
      migrationStatus: TemplateCustomizationMigrationStatus.OK,
      lastCustomizedById: casual.integer(1, 999),
      lastCustomizedByName: casual.name,
      lastCustomized: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedTemplate.queryWithPagination = originalQuery;
    VersionedTemplate.getDefaultPaginationOptions = originalGetDefaultPaginationOptions;
  });

  describe('search', () => {
    it('returns matching CustomizableTemplateSearchResults with no filters', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
        sortField: 'tc.modified',
        sortDir: 'DESC',
        availableSortFields: ['vt.name', 'a.name', 'vt.created', 'vt.bestPractice',
          'tc.status', 'tc.migrationStatus', 'tc.modified'],
        countField: 'vt.id',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 1,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const result = await CustomizableTemplateSearchResult.search('Test', context);

      const expectedSql = `
      SELECT vt.id AS versionedTemplateId, vt.name, vt.version, vt.description,
        a.uri AS affiliationId, a.name AS affiliationName,
        tc.id AS templateCustomizationId, tc.status, tc.migrationStatus, tc.isDirty,
        tc.modifiedById AS lastCustomizedById, tc.modified AS lastCustomized,
        CONCAT(u.givenName, ' ', u.surName) AS lastCustomizedByName
      FROM versionedTemplates vt
      JOIN affiliations a ON a.uri = vt.ownerId
      LEFT JOIN templateCustomizations tc ON tc.versionedTemplateId = vt.id
        LEFT JOIN users u ON u.id = tc.modifiedById
    `;
      const whereFilters = [
        "vt.active = 1 AND vt.versionType = 'PUBLISHED' AND vt.visibility = 'PUBLIC'",
        "(LOWER(vt.name) LIKE ? OR LOWER(vt.description) LIKE ?)",
        'tc.affiliationId = ?'
      ];
      const vals = ['%%', '%%', 'test-affiliation-123'];

      const expectedOpts = {
        ...mockOptions,
        sortField: 'tc.modified',
        sortDir: 'DESC',
        cursorField: 'vt.id',
      };

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery).toHaveBeenCalledWith(context, expectedSql, whereFilters, '', vals, expectedOpts, 'Test');
      expect(result).toEqual(mockResponse);
    });

    it('returns matching CustomizableTemplateSearchResults with search term filter', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
        sortField: 'tc.modified',
        sortDir: 'DESC',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 1,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const searchTerm = 'test template';
      const result = await CustomizableTemplateSearchResult.search('Test', context, searchTerm);

      const whereFilters = [
        "vt.active = 1 AND vt.versionType = 'PUBLISHED' AND vt.visibility = 'PUBLIC'",
        '(LOWER(vt.name) LIKE ? OR LOWER(vt.description) LIKE ?)',
        'tc.affiliationId = ?'
      ];
      const vals = ['%test template%', '%test template%', 'test-affiliation-123'];

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][2]).toEqual(whereFilters);
      expect(localPaginationQuery.mock.calls[0][4]).toEqual(vals);
      expect(result).toEqual(mockResponse);
    });

    it('returns matching CustomizableTemplateSearchResults with status filter', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
        sortField: 'tc.modified',
        sortDir: 'DESC',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 1,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const status = TemplateCustomizationStatus.PUBLISHED;
      const result = await CustomizableTemplateSearchResult.search('Test', context, undefined, status);

      const whereFilters = [
        "vt.active = 1 AND vt.versionType = 'PUBLISHED' AND vt.visibility = 'PUBLIC'",
        "(LOWER(vt.name) LIKE ? OR LOWER(vt.description) LIKE ?)",
        'tc.status = ?',
        'tc.affiliationId = ?'
      ];
      const vals = ['%%', '%%', status, 'test-affiliation-123'];

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][2]).toEqual(whereFilters);
      expect(localPaginationQuery.mock.calls[0][4]).toEqual(vals);
      expect(result).toEqual(mockResponse);
    });

    it('returns matching CustomizableTemplateSearchResults with migrationStatus filter', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
        sortField: 'tc.modified',
        sortDir: 'DESC',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 1,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const migrationStatus = TemplateCustomizationMigrationStatus.STALE;
      const result = await CustomizableTemplateSearchResult.search('Test', context, undefined, undefined, migrationStatus);

      const whereFilters = [
        "vt.active = 1 AND vt.versionType = 'PUBLISHED' AND vt.visibility = 'PUBLIC'",
        "(LOWER(vt.name) LIKE ? OR LOWER(vt.description) LIKE ?)",
        'tc.migrationStatus = ?',
        'tc.affiliationId = ?'
      ];
      const vals = ['%%', '%%', migrationStatus, 'test-affiliation-123'];

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][2]).toEqual(whereFilters);
      expect(localPaginationQuery.mock.calls[0][4]).toEqual(vals);
      expect(result).toEqual(mockResponse);
    });

    it('returns matching CustomizableTemplateSearchResults with all filters', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
        sortField: 'tc.modified',
        sortDir: 'DESC',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 1,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const searchTerm = 'template search';
      const status = TemplateCustomizationStatus.DRAFT;
      const migrationStatus = TemplateCustomizationMigrationStatus.ORPHANED;

      const result = await CustomizableTemplateSearchResult.search('Test', context, searchTerm, status, migrationStatus);

      const whereFilters = [
        "vt.active = 1 AND vt.versionType = 'PUBLISHED' AND vt.visibility = 'PUBLIC'",
        '(LOWER(vt.name) LIKE ? OR LOWER(vt.description) LIKE ?)',
        'tc.status = ?',
        'tc.migrationStatus = ?',
        'tc.affiliationId = ?'
      ];
      const vals = ['%template search%', '%template search%', status, migrationStatus, 'test-affiliation-123'];

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][2]).toEqual(whereFilters);
      expect(localPaginationQuery.mock.calls[0][4]).toEqual(vals);
      expect(result).toEqual(mockResponse);
    });

    it('uses cursor-based pagination when type is CURSOR', async () => {
      const mockOptions: PaginationOptionsForCursors = {
        type: PaginationType.CURSOR,
        sortField: null,
        sortDir: null,
        cursor: 'test-cursor',
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: true,
        hasPreviousPage: false,
        totalCount: 10,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const result = await CustomizableTemplateSearchResult.search('Test', context, undefined, undefined, undefined, mockOptions);

      const expectedOpts: PaginationOptionsForCursors = {
        ...mockOptions,
        sortField: 'tc.modified',
        sortDir: 'DESC',
        availableSortFields: ['vt.name', 'a.name', 'vt.created', 'vt.bestPractice', 'tc.status', 'tc.migrationStatus', 'tc.modified'],
        countField: 'vt.id',
        cursorField: 'vt.id',
      };

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][5]).toEqual(expectedOpts);
      expect(result).toEqual(mockResponse);
    });

    it('uses offset-based pagination when type is OFFSET', async () => {
      const mockOptions: PaginationOptionsForOffsets = {
        type: PaginationType.OFFSET,
        sortField: 'vt.name',
        sortDir: 'ASC',
        offset: 10,
        limit: 20,
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [customizableTemplateSearchResult],
        hasNextPage: true,
        hasPreviousPage: true,
        totalCount: 50,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const result = await CustomizableTemplateSearchResult.search('Test', context, undefined, undefined, undefined, mockOptions);

      const expectedOpts: PaginationOptionsForOffsets = {
        ...mockOptions,
        availableSortFields: ['vt.name', 'a.name', 'vt.created', 'vt.bestPractice', 'tc.status', 'tc.migrationStatus', 'tc.modified'],
        countField: 'vt.id',
      };

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery.mock.calls[0][5]).toEqual(expectedOpts);
      expect(result).toEqual(mockResponse);
    });

    it('returns empty results when no templates match', async () => {
      const mockOptions: PaginationOptions = {
        type: PaginationType.CURSOR,
      };
      localGetDefaultPaginationOptions.mockReturnValue(mockOptions);

      const mockResponse: PaginatedQueryResults<CustomizableTemplateSearchResult> = {
        items: [],
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: 0,
        limit: 20
      };
      localPaginationQuery.mockResolvedValueOnce(mockResponse);

      const result = await CustomizableTemplateSearchResult.search('Test', context, 'nonexistent');

      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });
})


describe('VersionedTemplate', () => {
  let templateId;
  let ownerId;
  let version;
  let name;
  let versionedById;
  let versioned;

  beforeEach(() => {
    jest.clearAllMocks();

    templateId = casual.integer(1, 999);
    ownerId = casual.url;
    version = casual.word;
    name = casual.sentence;
    versionedById = casual.integer(1, 999);

    versioned = new VersionedTemplate({
      templateId,
      version,
      name,
      ownerId,
      versionedById,
      created: casual.date('YYYY-MM-DD HH:mm:ss'),
      createdById: casual.integer(1, 999),
      modified: casual.date('YYYY-MM-DD HH:mm:ss'),
      modifiedById: casual.integer(1, 999),
    });
  });

  it('constructor should initialize as expected', () => {
    expect(versioned.id).toBeFalsy();
    expect(versioned.templateId).toEqual(templateId);
    expect(versioned.version).toEqual(version);
    expect(versioned.name).toEqual(name);
    expect(versioned.ownerId).toEqual(ownerId);
    expect(versioned.versionedById).toEqual(versionedById);
    expect(versioned.visibility).toEqual(TemplateVisibility.ORGANIZATION);
    expect(versioned.languageId).toEqual(defaultLanguageId);
    expect(versioned.created).toBeTruthy();
    expect(versioned.active).toBe(false);
    expect(versioned.comment).toEqual('');
  });

  it('isValid returns true when the record is valid', async () => {
    expect(await versioned.isValid()).toBe(true);
  });

  it('isValid returns false if the templateId is null', async () => {
    versioned.templateId = null;
    expect(await versioned.isValid()).toBe(false);
    expect(Object.keys(versioned.errors).length).toBe(1);
    expect(versioned.errors['templateId'].includes('Template')).toBe(true);
  });

  it('isValid returns false if the versionedById is null', async () => {
    versioned.versionedById = null;
    expect(await versioned.isValid()).toBe(false);
    expect(Object.keys(versioned.errors).length).toBe(1);
    expect(versioned.errors['versionedById'].includes('Versioned by')).toBe(true);
  });

  it('isValid returns false if the version is blank', async () => {
    versioned.version = '';
    expect(await versioned.isValid()).toBe(false);
    expect(Object.keys(versioned.errors).length).toBe(1);
    expect(versioned.errors['version'].includes('Version')).toBe(true);
  });

  it('isValid returns false if the name is blank', async () => {
    versioned.name = '';
    expect(await versioned.isValid()).toBe(false);
    expect(Object.keys(versioned.errors).length).toBe(1);
    expect(versioned.errors['name'].includes('Name')).toBe(true);
  });

  it('isValid returns false if the ownerId is null', async () => {
    versioned.ownerId = null;
    expect(await versioned.isValid()).toBe(false);
    expect(Object.keys(versioned.errors).length).toBe(1);
    expect(versioned.errors['ownerId'].includes('Owner')).toBe(true);
  });

  describe('findBy queries', () => {
    const originalQuery = VersionedTemplate.query;

    let localQuery;
    let context;
    let versionedTemplate;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (VersionedTemplate.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);

      versionedTemplate = new VersionedTemplate({
        id: casual.integer(1, 9),
        createdById: casual.integer(1, 999),
        templateId: casual.integer(1, 99),
        name: casual.sentence,
        ownerId: casual.url,
        version: `v${casual.integer(1, 9)}`,
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      VersionedTemplate.query = originalQuery;
    });

    it('findById returns the VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplate]);
      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
      expect(result).toEqual(versionedTemplate);
      expect(result).toBeInstanceOf(VersionedTemplate);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('findById returns null if there is no VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([]);
      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
      expect(result).toEqual(null);
    });

    it('findByAffiliationId returns the VersionedTemplates', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplate]);
      const affiliationId = '1234'
      const result = await VersionedTemplate.findByAffiliationId('Test', context, affiliationId);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE ownerId = ? ORDER BY modified DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliationId], 'Test')
      expect(result).toEqual([versionedTemplate]);
    });

    it('findByAffiliationId returns an empty array if there are no VersionedTemplates', async () => {
      localQuery.mockResolvedValueOnce([]);
      const affiliationId = '1234'
      const result = await VersionedTemplate.findByAffiliationId('Test', context, affiliationId);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE ownerId = ? ORDER BY modified DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliationId], 'Test')
      expect(result).toEqual([]);
    });

    it('findByTemplateId returns the VersionedTemplates for the Template', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplate]);

      const templateId = versionedTemplate.templateId;
      const result = await VersionedTemplate.findByTemplateId('Test', context, templateId);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE templateId = ? ORDER BY version DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test')
      expect(result).toEqual([versionedTemplate]);
    });

    it('findByTemplateId returns an empty array if there are no VersionedTemplates', async () => {
      localQuery.mockResolvedValueOnce([]);

      const templateId = versionedTemplate.templateId;
      const result = await VersionedTemplate.findByTemplateId('Test', context, templateId);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE templateId = ? ORDER BY version DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test')
      expect(result).toEqual([]);
    });

    it('findVersionedTemplateById returns the VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplate]);

      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findVersionedTemplateById('Test', context, id);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
      expect(result).toEqual(versionedTemplate);
    });

    it('findActiveByTemplateId returns the VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([versionedTemplate]);
      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findActiveByTemplateId('Test', context, id);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE templateId = ? AND active = 1 ORDER BY modified DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
      expect(result).toEqual(versionedTemplate);
      expect(result).toBeInstanceOf(VersionedTemplate);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('findActiveByTemplateId returns undefined if there is no VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([]);
      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findActiveByTemplateId('Test', context, id);
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(undefined);
    });

    it('findVersionedTemplateById returns null if there is no VersionedTemplate', async () => {
      localQuery.mockResolvedValueOnce([]);

      const id = versionedTemplate.id;
      const result = await VersionedTemplate.findVersionedTemplateById('Test', context, id);
      const expectedSql = 'SELECT * FROM versionedTemplates WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
      expect(result).toEqual(null);
    });
  });

  describe('create', () => {
    let insertQuery;
    let versionedTemplate;

    beforeEach(() => {
      insertQuery = jest.fn();
      (VersionedTemplate.insert as jest.Mock) = insertQuery;

      versionedTemplate = new VersionedTemplate({
        templateId: casual.integer(1, 999),
        versionedById: casual.integer(1, 99),
        version: `v${casual.integer(1, 9)}`,
        ownerId: casual.url,
        name: casual.sentence,
        description: casual.sentences(5),
        comment: casual.sentences(10),
      })
    });

    it('returns the VersionedTemplate with errors if it is not valid', async () => {
      const localValidator = jest.fn();
      (versionedTemplate.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await versionedTemplate.create(context);
      expect(result).toBeInstanceOf(VersionedTemplate);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns the newly added VersionedTemplate', async () => {
      const localValidator = jest.fn();
      (versionedTemplate.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockFindBy = jest.fn();
      (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValue(versionedTemplate);

      const result = await versionedTemplate.create(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(VersionedTemplate);
      expect(Object.keys(result.errors).length).toBe(0);
    });
  });

  describe('update', () => {
    let updateQuery;
    let versionedTemplate;

    beforeEach(() => {
      updateQuery = jest.fn();
      (VersionedTemplate.update as jest.Mock) = updateQuery;

      versionedTemplate = new VersionedTemplate({
        id: casual.integer(1, 99),
        createdById: casual.integer(1, 999),
        ownerId: casual.url,
        name: casual.sentence,
      })
    });

    it('returns the VersionedTemplate with errors if it is not valid', async () => {
      const localValidator = jest.fn();
      (versionedTemplate.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await versionedTemplate.update(context);
      expect(result).toBeInstanceOf(VersionedTemplate);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns an error if the VersionedTemplate has no id', async () => {
      const localValidator = jest.fn();
      (versionedTemplate.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      versionedTemplate.id = null;
      const result = await versionedTemplate.update(context);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the updated VersionedTemplate', async () => {
      const localValidator = jest.fn();
      (versionedTemplate.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      updateQuery.mockResolvedValueOnce(versionedTemplate);

      const result = await versionedTemplate.update(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(VersionedTemplate);
    });
  });

  describe('hasAssociatedPlans', () => {
    const originalQuery = VersionedTemplate.query;

    let localQuery;
    let context;
    let templateId;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (VersionedTemplate.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);
      templateId = casual.integer(1, 999);
    });

    afterEach(() => {
      jest.clearAllMocks();
      VersionedTemplate.query = originalQuery;
    });

    it('returns true when there are associated plans', async () => {
      localQuery.mockResolvedValueOnce([{ id: 1 }]);

      const result = await VersionedTemplate.hasAssociatedPlans('Test', context, templateId);
      const expectedSql = 'SELECT p.id FROM plans AS p ' +
                          'JOIN versionedTemplates AS vt ON p.versionedTemplateId = vt.id ' +
                          'WHERE vt.templateId = ? LIMIT 1';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test');
      expect(result).toBe(true);
    });

    it('returns false when there are no associated plans', async () => {
      localQuery.mockResolvedValueOnce([]);

      const result = await VersionedTemplate.hasAssociatedPlans('Test', context, templateId);
      const expectedSql = 'SELECT p.id FROM plans AS p ' +
                          'JOIN versionedTemplates AS vt ON p.versionedTemplateId = vt.id ' +
                          'WHERE vt.templateId = ? LIMIT 1';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test');
      expect(result).toBe(false);
    });

    it('returns false when query returns null', async () => {
      localQuery.mockResolvedValueOnce(null);

      const result = await VersionedTemplate.hasAssociatedPlans('Test', context, templateId);
      expect(result).toBe(false);
    });
  });

  describe('deactivateByTemplateId', () => {
    const originalQuery = VersionedTemplate.query;

    let localQuery;
    let context;
    let templateId;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (VersionedTemplate.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);
      templateId = casual.integer(1, 999);
    });

    afterEach(() => {
      jest.clearAllMocks();
      VersionedTemplate.query = originalQuery;
    });

    it('executes the correct SQL to deactivate versionedTemplates', async () => {
      localQuery.mockResolvedValueOnce([]);

      await VersionedTemplate.deactivateByTemplateId('Test', context, templateId);
      const expectedSql = 'UPDATE versionedTemplates SET active = 0 WHERE templateId = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test');
    });
  });
});
