import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { License } from "../License";
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

describe('License', () => {
  let license;

  const licenseData = {
    name: casual.company_name,
    uri: casual.url,
    description: casual.sentences(3),
  }
  beforeEach(() => {
    license = new License(licenseData);
  });

  it('should initialize options as expected', () => {
    expect(license.name).toEqual(licenseData.name);
    expect(license.uri).toEqual(licenseData.uri);
    expect(license.description).toEqual(licenseData.description);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await license.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the name field is missing', async () => {
    license.name = null;
    expect(await license.isValid()).toBe(false);
    expect(Object.keys(license.errors).length).toBe(1);
    expect(license.errors['name']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is missing', async () => {
    license.uri = null;
    expect(await license.isValid()).toBe(false);
    expect(Object.keys(license.errors).length).toBe(1);
    expect(license.errors['uri']).toBeTruthy();
  });

  it('should return false when calling isValid if the uri field is not a URI', async () => {
    license.uri = casual.uuid;
    expect(await license.isValid()).toBe(false);
    expect(Object.keys(license.errors).length).toBe(1);
    expect(license.errors['uri']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = License.query;

  let localQuery;
  let localPaginationQuery
  let context;
  let license;

  beforeEach(async () => {
    localQuery = jest.fn();
    (License.query as jest.Mock) = localQuery;

    localPaginationQuery = jest.fn();
    (License.queryWithPagination as jest.Mock) = localPaginationQuery;

    context = await buildMockContextWithToken(logger);

    license = new License({
      id: casual.integer(1,9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomains: [{ id: casual.integer(1, 99) }],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    License.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([license]);
    const licenseId = casual.integer(1, 999);
    const result = await License.findById('testing', context, licenseId);
    const expectedSql = 'SELECT * FROM licenses WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [licenseId.toString()], 'testing')
    expect(result).toEqual(license);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const licenseId = casual.integer(1, 999);
    const result = await License.findById('testing', context, licenseId);
    expect(result).toEqual(null);
  });

  it('findByURI should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([license]);
    const uri = casual.url;
    const result = await License.findByURI('testing', context, uri);
    const expectedSql = 'SELECT * FROM licenses WHERE uri = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [uri], 'testing')
    expect(result).toEqual(license);
  });

  it('findByURI should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const uri = casual.url;
    const result = await License.findByURI('testing', context, uri);
    expect(result).toEqual(null);
  });

  it('findByName should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([license]);
    const name = casual.company_name;
    const result = await License.findByName('testing', context, name.toLowerCase().trim());
    const expectedSql = 'SELECT * FROM licenses WHERE LOWER(name) = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [name.toLowerCase().trim()], 'testing')
    expect(result).toEqual(license);
  });

  it('findByName should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const name = casual.company_name;
    const result = await License.findByName('testing', context, name);
    expect(result).toEqual(null);
  });

  it('all should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([license]);
    const result = await License.all('testing', context);
    const expectedSql = 'SELECT * FROM licenses ORDER BY name ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [], 'testing')
    expect(result).toEqual([license]);
  });

  it('all should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await License.all('testing', context);
    expect(result).toEqual([]);
  });

  it('recommended should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([license]);
    const result = await License.recommended('testing', context, true);
    const expectedSql = 'SELECT * FROM licenses WHERE recommended = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, ['1'], 'testing')
    expect(result).toEqual([license]);
  });

  it('recommended should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await License.recommended('testing', context, true);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let license;

  beforeEach(() => {
    updateQuery = jest.fn();
    (License.update as jest.Mock) = updateQuery;

    license = new License({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    })
  });

  it('returns the License with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (license.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await license.update(context);
    expect(result instanceof License).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the License has no id', async () => {
    const localValidator = jest.fn();
    (license.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    license.id = null;
    const result = await license.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated License', async () => {
    const localValidator = jest.fn();
    (license.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(license);

    const mockFindById = jest.fn();
    (License.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(license);

    const result = await license.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(License);
  });
});

describe('create', () => {
  const originalInsert = License.insert;
  let insertQuery;
  let license;

  beforeEach(() => {
    insertQuery = jest.fn();
    (License.insert as jest.Mock) = insertQuery;

    license = new License({
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  });

  afterEach(() => {
    License.insert = originalInsert;
  });

  it('returns the License without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (license.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await license.create(context);
    expect(result instanceof License).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the License with errors if it is invalid', async () => {
    license.name = undefined;
    const response = await license.create(context);
    expect(response.errors['name']).toBe('Name can\'t be blank');
  });

  it('returns the License with an error if the object already exists', async () => {
    const mockFindBy = jest.fn();
    (License.findByURI as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(license);

    const result = await license.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added License', async () => {
    const mockFindbyURI = jest.fn();
    (License.findByURI as jest.Mock) = mockFindbyURI;
    mockFindbyURI.mockResolvedValueOnce(null);

    const mockFindByName = jest.fn();
    (License.findByName as jest.Mock) = mockFindByName;
    mockFindByName.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (License.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(license);

    const result = await license.create(context);
    expect(mockFindbyURI).toHaveBeenCalledTimes(1);
    expect(mockFindByName).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(License);
  });
});

describe('delete', () => {
  let license;

  beforeEach(() => {
    license = new License({
      id: casual.integer(1, 9999),
      name: casual.company_name,
      uri: casual.url,
      description: casual.sentences(3),
      researchDomainIds: [casual.integer(1, 99)],
      keywords: [casual.word, casual.word],
    });
  })

  it('returns null if the License has no id', async () => {
    license.id = null;
    expect(await license.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (License.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await license.delete(context)).toBe(null);
  });

  it('returns the License if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (License.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(license);

    const mockFindById = jest.fn();
    (License.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(license);

    const result = await license.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(License);
  });
});
