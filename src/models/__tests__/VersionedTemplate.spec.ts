import casual from 'casual';
import { TemplateVisibility } from "../Template";
import { TemplateVersionType, VersionedTemplate, VersionedTemplateSearchResult } from '../VersionedTemplate';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { defaultLanguageId } from '../Language';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { generalConfig } from '../../config/generalConfig';
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
                  'WHERE vt.ownerId = affiliationId AND vt.active = 1 AND vt.versionType = ? '
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

describe('VersionedTemplate', () => {
  let templateId;
  let ownerId;
  let version;
  let name;
  let versionedById;
  let versioned;

  beforeEach(() => {
    templateId = casual.integer(1, 999);
    ownerId = casual.url;
    version = casual.word;
    name = casual.sentence;
    versionedById = casual.integer(1, 999);

    versioned = new VersionedTemplate({ templateId, version, name, ownerId, versionedById });
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
