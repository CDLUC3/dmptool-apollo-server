import casual from "casual";
import { Section } from "../Section";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

let context;
jest.mock('../../context.ts');

describe('Section', () => {
  let section;
  const sectionData = {
    name: 'Henry',
    introduction: 'This is the intro',
    requirements: 'This is the requirements',
    guidance: 'This is the guidance',
    displayOrder: 1,
  }
  beforeEach(() => {
    section = new Section(sectionData);
    context = buildMockContextWithToken(logger);
  });

  it('should initialize options as expected', () => {
    expect(section.id).toBeFalsy();
    expect(section.name).toEqual(sectionData.name);
    expect(section.introduction).toEqual(sectionData.introduction);
    expect(section.requirements).toEqual(sectionData.requirements);
    expect(section.guidance).toEqual(sectionData.guidance);
    expect(section.displayOrder).toEqual(sectionData.displayOrder);
    expect(section.isDirty).toBe(true);
    expect(section.created).toBeTruthy();
    expect(section.modified).toBeTruthy();
    expect(section.errors).toEqual({});
  });

  it('should return true when calling isValid with a name field', async () => {
    expect(await section.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a name field', async () => {
    section.name = null;
    expect(await section.isValid()).toBe(false);
    expect(Object.keys(section.errors).length).toBe(1);
    expect(section.errors['name']).toBeTruthy();
  });
});

describe('findBySectionName', () => {
  const originalQuery = Section.query;

  let localQuery;
  let context;
  let section;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Section.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Section.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localQuery.mockResolvedValueOnce([section]);
    const templateId = 15;
    const result = await Section.findBySectionName('Section query', context, section.name, templateId);
    const expectedSql = 'SELECT * FROM sections WHERE LOWER(name) = ? AND templateId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [section.name.toLowerCase(), templateId.toString()], 'Section query')
    expect(result).toEqual(section);
  });

  it('should return null if it finds no Section', async () => {
    localQuery.mockResolvedValueOnce([]);
    const templateId = 15;
    const result = await Section.findBySectionName('Section query', context, section.name, templateId);
    expect(result).toEqual(null);
  });
});

describe('findByTemplateId', () => {
  const originalQuery = Section.query;

  let localQuery;
  let context;
  let section;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Section.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Section.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localQuery.mockResolvedValueOnce([section]);
    const templateId = 1;
    const result = await Section.findByTemplateId('Section query', context, templateId);
    const expectedSql = 'SELECT * FROM sections WHERE templateId = ? ORDER BY displayOrder ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Section query')
    expect(result).toEqual([section]);
  });

  it('should return an empty array if it finds no Section', async () => {
    localQuery.mockResolvedValueOnce([]);
    const templateId = 1;
    const result = await Section.findByTemplateId('Section query', context, templateId);
    expect(result).toEqual([]);
  });
});

describe('findById', () => {
  const originalQuery = Section.query;

  let localQuery;
  let context;
  let section;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Section.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Section.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localQuery.mockResolvedValueOnce([section]);
    const sectionId = 1;
    const result = await Section.findById('Section query', context, sectionId);
    const expectedSql = 'SELECT * FROM sections where id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [sectionId.toString()], 'Section query')
    expect(result).toEqual(section);
  });

  it('should return an empty array if it finds no Section', async () => {
    localQuery.mockResolvedValueOnce([]);
    const templateId = 1;
    const result = await Section.findById('Section query', context, templateId);
    expect(result).toEqual(null);
  });
});

describe('create', () => {
  const originalInsert = Section.insert;
  let insertQuery;
  let section;

  beforeEach(() => {
    // jest.resetAllMocks();

    insertQuery = jest.fn();
    (Section.insert as jest.Mock) = insertQuery;

    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  });

  afterEach(() => {
    // jest.resetAllMocks();
    Section.insert = originalInsert;
  });

  it('returns the Section without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (section.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await section.create(context);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });
  it('returns the newly added Section', async () => {
    const localValidator = jest.fn();
    (section.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn();
    (Section.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(section);

    const result = await section.create(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Section);
  });
});

describe('update', () => {
  let updateQuery;
  let section;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Section.update as jest.Mock) = updateQuery;

    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  });

  it('returns the Section without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (section.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await section.update(context);
    expect(result.errors).toEqual({});
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Section has no id', async () => {
    const localValidator = jest.fn();
    (section.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    section.id = null;
    const result = await section.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated Section', async () => {
    const localValidator = jest.fn();
    (section.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    const mockFindById = jest.fn();
    (Section.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(section);

    const result = await section.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Section);
  });
});

describe('delete', () => {
  let section;

  beforeEach(() => {
    section = new Section({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    })
  })

  it('returns null if the Section has no id', async () => {
    section.id = null;
    expect(await section.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Section.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await section.delete(context)).toBe(null);
  });

  it('returns the Section if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Section.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(section);

    const mockFindById = jest.fn();
    (Section.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(section);

    const result = await section.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result.errors).toEqual({});
    expect(result).toBeInstanceOf(Section);
  });
});
