import casual from "casual";
import { VersionedSection, VersionedSectionSearchResult } from "../VersionedSection";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { generalConfig } from "../../config/generalConfig";
import { TemplateVersionType } from "../VersionedTemplate";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

describe('VersionedSectionSearchResult', () => {
  let versionedSectionSearchResult;
  const versionedSectionSearchResultData = {
    name: casual.sentence,
    introduction: casual.sentence,
    displayOrder: casual.integer(1, 20),
    bestPractice: casual.boolean,
    versionedTemplateId: casual.integer(1, 20),
    versionedTemplateName: casual.sentence,
    versionedQuestionCount: casual.integer(1, 20),
  }
  beforeEach(() => {
    versionedSectionSearchResult = new VersionedSectionSearchResult(versionedSectionSearchResultData);
  });

  it('should initialize options as expected', () => {
    expect(versionedSectionSearchResult.name).toEqual(versionedSectionSearchResultData.name);
    expect(versionedSectionSearchResult.introduction).toEqual(versionedSectionSearchResultData.introduction);
    expect(versionedSectionSearchResult.displayOrder).toEqual(versionedSectionSearchResultData.displayOrder);
    expect(versionedSectionSearchResult.bestPractice).toEqual(versionedSectionSearchResultData.bestPractice);
    expect(versionedSectionSearchResult.versionedTemplateId).toEqual(versionedSectionSearchResultData.versionedTemplateId);
    expect(versionedSectionSearchResult.versionedTemplateName).toEqual(versionedSectionSearchResultData.versionedTemplateName);
    expect(versionedSectionSearchResult.versionedQuestionCount).toEqual(versionedSectionSearchResultData.versionedQuestionCount);
  });

  it('should initialize with default values', () => {
    const defaultVersionedSectionSearchResult = new VersionedSectionSearchResult({});
    expect(defaultVersionedSectionSearchResult.name).toEqual(undefined);
    expect(defaultVersionedSectionSearchResult.introduction).toEqual(undefined);
    expect(defaultVersionedSectionSearchResult.displayOrder).toEqual(0);
    expect(defaultVersionedSectionSearchResult.bestPractice).toEqual(false);
    expect(defaultVersionedSectionSearchResult.versionedTemplateId).toEqual(undefined);
    expect(defaultVersionedSectionSearchResult.versionedTemplateName).toEqual(undefined);
    expect(defaultVersionedSectionSearchResult.versionedQuestionCount).toEqual(0);
  });

  describe('search', () => {
    const originalQuery = VersionedSection.query;

    let localPaginationQuery;
    let versionedSectionSearchResult;
    let context;

    beforeEach(async () => {
      jest.resetAllMocks();

      localPaginationQuery = jest.fn();
      (VersionedSection.queryWithPagination as jest.Mock) = localPaginationQuery;

      context = await buildMockContextWithToken(logger);

      versionedSectionSearchResult = new VersionedSectionSearchResult({
        id: casual.integer(1, 9),
        modified: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
        created: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
        name: casual.sentence,
        introduction: casual.sentences(5),
        displayOrder: casual.integer(1, 20),
        bestPractice: casual.boolean,
        versionedTemplateId: casual.integer(1, 99),
        versionedTemplateName: casual.sentence,
        versionedQuestionCount: casual.integer(1, 20),
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      VersionedSection.query = originalQuery;
    });

    it('should call query with correct params and return the default', async () => {
      localPaginationQuery.mockResolvedValueOnce([versionedSectionSearchResult]);

      const term = versionedSectionSearchResult.name.split(0, 5)[0];
      const result = await VersionedSectionSearchResult.search('Test', context, term);
      const sql = 'SELECT vs.id, vs.modified, vs.created, vs.name, vs.introduction, vs.displayOrder, vt.bestPractice, ' +
                        'vt.id as versionedTemplateId, vt.name as versionedTemplateName, ' +
                        'COUNT(vq.id) as versionedQuestionCount ' +
                  'FROM versionedSections vs ' +
                    'INNER JOIN versionedTemplates vt ON vs.versionedTemplateId = vt.id ' +
                    'LEFT JOIN versionedQuestions vq ON vs.id = vq.versionedSectionId';

      const vals = [TemplateVersionType.PUBLISHED.toString(), context?.token?.affiliationId, `%${term.toLowerCase()}%`];
      const whereFilters = ['vt.active = 1','vt.versionType = ?', '(vt.ownerId = ? OR vt.bestPractice = 1)',
                            'LOWER(vs.name) LIKE ?'];
      const groupBy = 'GROUP BY vs.id, vs.modified, vs.created, vs.name, vs.introduction, vs.displayOrder, ' +
                        'vt.bestPractice, vt.id, vt.name'
      const sortFields = ["vs.name", "vs.created", "vs.bestPractice", "vt.name", "vs.modified", "versionedQuestionCount"];
      const opts = {
        cursor: null,
        limit: generalConfig.defaultSearchLimit,
        sortField: 'vs.modified',
        sortDir: 'DESC',
        countField: 'vs.id',
        cursorField: 'vs.id',
        availableSortFields: sortFields,
      };
      expect(localPaginationQuery).toHaveBeenCalledTimes(1);
      expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, groupBy, vals, opts, 'Test')
      expect(result).toEqual([versionedSectionSearchResult]);
    });

    it('should return empty array if it finds no default', async () => {
      localPaginationQuery.mockResolvedValueOnce([]);
      const searchTerm = 'tesTIing';
      const result = await VersionedSectionSearchResult.search('testing', context, searchTerm);
      expect(result).toEqual([]);
    });
  });
});


describe('VersionedSection', () => {
  let versionedSection;

  const versionedSectionData = {
    name: casual.sentence,
    introduction: casual.sentence,
    requirements: casual.sentence,
    guidance: casual.sentence,
    displayOrder: casual.integer(1, 20),
  }
  beforeEach(() => {
    versionedSection = new VersionedSection(versionedSectionData);
  });

  it('should initialize options as expected', () => {
    expect(versionedSection.name).toEqual(versionedSectionData.name);
    expect(versionedSection.introduction).toEqual(versionedSectionData.introduction);
    expect(versionedSection.requirements).toEqual(versionedSectionData.requirements);
    expect(versionedSection.guidance).toEqual(versionedSectionData.guidance);
    expect(versionedSection.displayOrder).toEqual(versionedSectionData.displayOrder);
  });
});

describe('findByName', () => {
  const originalQuery = VersionedSection.query;

  let localQuery;
  let localPaginationQuery
  let context;
  let versionedSection;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedSection.query as jest.Mock) = localQuery;

    localPaginationQuery = jest.fn();
    (VersionedSection.queryWithPagination as jest.Mock) = localPaginationQuery;

    context = await buildMockContextWithToken(logger);

    versionedSection = new VersionedSection({
      name: casual.sentence,
      introduction: casual.sentence,
      requirements: casual.sentence,
      guidance: casual.sentence,
      displayOrder: casual.integer(1, 20),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedSection.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localPaginationQuery.mockResolvedValueOnce([versionedSection]);

    const result = await VersionedSection.findByName('Test', context, versionedSection.name);
    const sql = 'SELECT vs.* FROM versionedSections vs';
    const vals = [`%${versionedSection.name.toLowerCase()}%`];
    const whereFilters = ['LOWER(vs.name) LIKE ?'];
    const sortFields = ["vs.name", "vs.created"];
    const opts = {
      cursor: null,
      limit: generalConfig.defaultSearchLimit,
      sortField: 'vs.name',
      sortDir: 'ASC',
      countField: 'vs.id',
      cursorField: 'vs.id',
      availableSortFields: sortFields,
    };

    expect(localPaginationQuery).toHaveBeenCalledTimes(1);
    expect(localPaginationQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, '', vals, opts, 'Test')
    /* As part of this unit test, all fields without a value default to 'undefined' for the mocked VersionedSection, but
the getVersionedSectionsBySectionId method returns an empty array for tags, and not undefined*/
    expect(result).toEqual([versionedSection])
  });

  it('should return an empty array if it finds no VersionedSection', async () => {
    localPaginationQuery.mockResolvedValueOnce([]);

    const result = await VersionedSection.findByName('VersionedSection query', context, versionedSection.name);
    expect(result).toEqual([]);
  });
});

describe('findByTemplateId', () => {
  const originalQuery = VersionedSection.query;

  let localQuery;
  let context;
  let versionedSection;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedSection.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedSection = new VersionedSection({
      name: casual.sentence,
      introduction: casual.sentence,
      requirements: casual.sentence,
      guidance: casual.sentence,
      displayOrder: casual.integer(1, 20),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedSection.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localQuery.mockResolvedValueOnce([versionedSection]);
    const versionedTemplateId = 1;
    const result = await VersionedSection.findByTemplateId('VersionedSection query', context, versionedTemplateId);
    const expectedSql = 'SELECT * FROM versionedSections WHERE versionedTemplateId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [versionedTemplateId.toString()], 'VersionedSection query')
    /* As part of this unit test, all fields without a value default to 'undefined' for the mocked VersionedSection, but
the getVersionedSectionsBySectionId method returns an empty array for tags, and not undefined*/
    expect(result).toEqual([versionedSection])
  });

  it('should return empty array if it finds no VersionedSection', async () => {
    localQuery.mockResolvedValueOnce([]);
    const versionedTemplateId = 1;
    const result = await VersionedSection.findByTemplateId('VersionedSection query', context, versionedTemplateId);
    expect(result).toEqual([]);
  });
});

describe('create', () => {
  const originalInsert = VersionedSection.insert;
  const originalFindById = VersionedSection.findById;
  let insertQuery;
  let versionedSection;

  beforeEach(() => {
    // jest.resetAllMocks();

    insertQuery = jest.fn();
    (VersionedSection.insert as jest.Mock) = insertQuery;

    versionedSection = new VersionedSection({
      name: casual.sentence,
      versionedTemplateId: casual.integer(1, 20),
      sectionId: casual.integer(1, 20),
      introduction: casual.sentence,
      requirements: casual.sentence,
      guidance: casual.sentence,
      displayOrder: casual.integer(1, 20),
    })
  });

  afterEach(() => {
    // jest.resetAllMocks();
    VersionedSection.insert = originalInsert;
    VersionedSection.findById = originalFindById;
  });

  it('returns the VersionedSection without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (versionedSection.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await versionedSection.create(context);
    expect(result instanceof VersionedSection).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the VersionedSection with an error if versionedTemplateId is undefined', async () => {
    versionedSection.versionedTemplateId = undefined;
    const response = await versionedSection.create(context);
    expect(response.errors['versionedTemplateId']).toBeTruthy();
  });

  it('returns the VersionedSection with an error if sectionId is undefined', async () => {
    versionedSection.sectionId = undefined;
    const response = await versionedSection.create(context);
    expect(response.errors['sectionId']).toBeTruthy();
  });

  it('returns the VersionedSection with an error if name is undefined', async () => {
    versionedSection.name = undefined;
    const response = await versionedSection.create(context);
    expect(response.errors['name']).toBeTruthy();
  });

  it('returns the VersionedSection with an error if displayOrder is undefined', async () => {
    versionedSection.displayOrder = undefined;
    const response = await versionedSection.create(context);
    expect(response.errors['displayOrder']).toBeTruthy();
  });

  it('returns the newly added VersionedSection', async () => {
    const mockFindById = jest.fn();
    (VersionedSection.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(versionedSection);

    const result = await versionedSection.create(context);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(VersionedSection);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});
describe('finders', () => {
  const originalQuery = VersionedSection.query;

  let localQuery;
  let context;
  let versionedSection;

  beforeEach(async () => {
    // jest.resetAllMocks();

    localQuery = jest.fn();
    (VersionedSection.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    versionedSection = new VersionedSection({
      id: casual.integer(1, 999),
      name: casual.sentence,
      versionedTemplateId: casual.integer(1, 20),
      sectionId: casual.integer(1, 20),
      introduction: casual.sentence,
      requirements: casual.sentence,
      guidance: casual.sentence,
      displayOrder: casual.integer(1, 20),
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    VersionedSection.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([versionedSection]);
    const id = casual.integer(1, 999);
    const result = await VersionedSection.findById('testing', context, id);
    const expectedSql = 'SELECT * FROM versionedSections WHERE id= ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'testing')
    expect(result).toBeInstanceOf(VersionedSection);
  });

  it('findActiveBySectionId returns the VersionedSection', async () => {
    localQuery.mockResolvedValueOnce([versionedSection]);
    const id = versionedSection.id;
    const result = await VersionedSection.findActiveBySectionId('Test', context, id);
    const expectedSql = 'SELECT * FROM versionedSections WHERE sectionId = ? AND active = 1 ORDER BY modified DESC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test')
    expect(result).toEqual(versionedSection);
    expect(result).toBeInstanceOf(VersionedSection);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('findActiveBySectionId returns undefined if there is no VersionedSection', async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = versionedSection.id;
    const result = await VersionedSection.findActiveBySectionId('Test', context, id);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(undefined);
  });
});
