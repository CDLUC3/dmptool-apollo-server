import casual from 'casual';
import { AffiliationEmailDomain } from '../AffiliationEmailDomain';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from '../../logger';
import { getCurrentDate } from '../../utils/helpers';

jest.mock('../../context.ts');

describe('AffiliationEmailDomain', () => {
  let emailDomain;
  let context;

  const domainData = {
    id: casual.integer(1, 999),
    affiliationId: casual.url,
    emailDomain: 'example.edu',
    created: getCurrentDate(),
    createdById: casual.integer(1, 999),
    modified: getCurrentDate(),
    modifiedById: casual.integer(1, 999),
    errors: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);
    emailDomain = new AffiliationEmailDomain(domainData);
  });

  describe('Constructor', () => {
    it('should initialize options as expected', () => {
      expect(emailDomain.id).toEqual(domainData.id);
      expect(emailDomain.affiliationId).toEqual(domainData.affiliationId);
      expect(emailDomain.emailDomain).toEqual(domainData.emailDomain);
      expect(emailDomain.createdById).toEqual(domainData.createdById);
      expect(emailDomain.modifiedById).toEqual(domainData.modifiedById);
    });
  });

  describe('isValid', () => {
    it('should return true when all required fields are present', async () => {
      const result = await emailDomain.isValid();
      expect(result).toBe(true);
      expect(Object.keys(emailDomain.errors).length).toBe(0);
    });

    it('should add error when affiliationId is missing', async () => {
      const invalidDomain = new AffiliationEmailDomain({
        ...domainData,
        affiliationId: null,
      });
      const result = await invalidDomain.isValid();
      expect(result).toBe(false);
      expect(invalidDomain.errors.affiliationId).toBeTruthy();
    });

    it('should add error when affiliationId is empty string', async () => {
      const invalidDomain = new AffiliationEmailDomain({
        ...domainData,
        affiliationId: '',
      });
      const result = await invalidDomain.isValid();
      expect(result).toBe(false);
      expect(invalidDomain.errors.affiliationId).toBeTruthy();
    });

    it('should add error when emailDomain is missing', async () => {
      const invalidDomain = new AffiliationEmailDomain({
        ...domainData,
        emailDomain: null,
      });
      const result = await invalidDomain.isValid();
      expect(result).toBe(false);
      expect(invalidDomain.errors.emailDomain).toBeTruthy();
    });

    it('should add error when emailDomain is empty string', async () => {
      const invalidDomain = new AffiliationEmailDomain({
        ...domainData,
        emailDomain: '',
      });
      const result = await invalidDomain.isValid();
      expect(result).toBe(false);
      expect(invalidDomain.errors.emailDomain).toBeTruthy();
    });

    it('should add multiple errors when multiple required fields are missing',
      async () => {
        const invalidDomain = new AffiliationEmailDomain({
          ...domainData,
          affiliationId: null,
          emailDomain: null,
        });
        const result = await invalidDomain.isValid();
        expect(result).toBe(false);
        expect(invalidDomain.errors.affiliationId).toBeTruthy();
        expect(invalidDomain.errors.emailDomain).toBeTruthy();
      }
    );
  });

  describe('create', () => {
    const originalInsert = AffiliationEmailDomain.insert;
    const originalFindById = AffiliationEmailDomain.findById;
    const originalFindByDomain = AffiliationEmailDomain.findByDomain;

    let insertQuery;
    let mockFindByDomain;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      insertQuery = jest.fn();
      mockFindByDomain = jest.fn();
      mockFindById = jest.fn();
      (AffiliationEmailDomain.insert as jest.Mock) = insertQuery;
      (AffiliationEmailDomain.findByDomain as jest.Mock) = mockFindByDomain;
      (AffiliationEmailDomain.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationEmailDomain.insert = originalInsert;
      AffiliationEmailDomain.findById = originalFindById;
      AffiliationEmailDomain.findByDomain = originalFindByDomain;
    });

    it('should create a new email domain successfully', async () => {
      mockFindByDomain.mockResolvedValue(null);
      mockFindById.mockResolvedValueOnce(emailDomain);
      insertQuery.mockResolvedValueOnce(emailDomain.id);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (emailDomain.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await emailDomain.create(context);
      expect(mockFindByDomain).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(emailDomain);
    });

    it('should return error if domain already exists', async () => {
      const existingDomain = new AffiliationEmailDomain(domainData);
      mockFindByDomain.mockResolvedValue(existingDomain);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (emailDomain.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await emailDomain.create(context);
      expect(result.errors.general).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors if email domain is invalid', async () => {
      const invalidDomain = new AffiliationEmailDomain({
        ...domainData,
        emailDomain: null,
      });

      const result = await invalidDomain.create(context);
      expect(result.errors.emailDomain).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const originalDelete = AffiliationEmailDomain.delete;
    let deleteQuery;

    beforeEach(() => {
      jest.resetAllMocks();
      deleteQuery = jest.fn();
      (AffiliationEmailDomain.delete as jest.Mock) = deleteQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationEmailDomain.delete = originalDelete;
    });

    it('should delete email domain successfully', async () => {
      deleteQuery.mockResolvedValueOnce(true);

      const result = await emailDomain.delete(context);
      expect(deleteQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationEmailDomain));
    });

    it('should return null if domain has no id', async () => {
      const noDomain = new AffiliationEmailDomain({
        ...domainData,
        id: null,
      });

      const result = await noDomain.delete(context);
      expect(result).toBe(null);
      expect(deleteQuery).not.toHaveBeenCalled();
    });

    it('should return null if delete fails', async () => {
      deleteQuery.mockResolvedValueOnce(false);

      const result = await emailDomain.delete(context);
      expect(result).toBe(null);
    });
  });

  describe('findById', () => {
    const originalQuery = AffiliationEmailDomain.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationEmailDomain.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationEmailDomain.query = originalQuery;
    });

    it('should return email domain when findById gets a result', async () => {
      query.mockResolvedValueOnce([domainData]);

      const result = await AffiliationEmailDomain.findById(
        'Test',
        context,
        emailDomain.id
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationEmailDomain));
    });

    it('should return null when findById has no results', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationEmailDomain.findById(
        'Test',
        context,
        emailDomain.id
      );
      expect(result).toBe(null);
    });
  });

  describe('findByDomain', () => {
    const originalQuery = AffiliationEmailDomain.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationEmailDomain.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationEmailDomain.query = originalQuery;
    });

    it('should return email domain when findByDomain gets a result', async () => {
      query.mockResolvedValueOnce([domainData]);

      const result = await AffiliationEmailDomain.findByDomain(
        'Test',
        context,
        emailDomain.emailDomain
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationEmailDomain));
    });

    it('should return null when findByDomain has no results', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationEmailDomain.findByDomain(
        'Test',
        context,
        emailDomain.emailDomain
      );
      expect(result).toBe(null);
    });

    it('should search with LIKE operator for flexible matching', async () => {
      query.mockResolvedValueOnce([domainData]);

      const testDomain = 'example.edu';
      await AffiliationEmailDomain.findByDomain('Test', context, testDomain);

      expect(query).toHaveBeenCalledWith(
        context,
        expect.stringContaining('LIKE'),
        [testDomain],
        'Test'
      );
    });
  });

  describe('findByAffiliationId', () => {
    const originalQuery = AffiliationEmailDomain.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationEmailDomain.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationEmailDomain.query = originalQuery;
    });

    it('should return all email domains for affiliation', async () => {
      const domains = [
        new AffiliationEmailDomain(domainData),
        new AffiliationEmailDomain({
          ...domainData,
          id: casual.integer(1, 999),
          emailDomain: 'another.edu',
        }),
      ];
      query.mockResolvedValueOnce(domains);

      const result = await AffiliationEmailDomain.findByAffiliationId(
        'Test',
        context,
        domainData.affiliationId
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no domains found', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationEmailDomain.findByAffiliationId(
        'Test',
        context,
        domainData.affiliationId
      );
      expect(result).toEqual([]);
    });

    it('should return array of AffiliationEmailDomain instances', async () => {
      const domains = [
        new AffiliationEmailDomain(domainData),
        new AffiliationEmailDomain({
          ...domainData,
          id: casual.integer(1, 999),
          emailDomain: 'test.org',
        }),
      ];
      query.mockResolvedValueOnce(domains);

      const result = await AffiliationEmailDomain.findByAffiliationId(
        'Test',
        context,
        domainData.affiliationId
      );

      result.forEach(domain => {
        expect(domain).toBeInstanceOf(AffiliationEmailDomain);
      });
    });
  });
});






