import casual from 'casual';
import { AffiliationLink } from '../AffiliationLink';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from '../../logger';
import { getCurrentDate } from '../../utils/helpers';

jest.mock('../../context.ts');

describe('AffiliationLink', () => {
  let link;
  let context;

  const linkData = {
    id: casual.integer(1, 999),
    affiliationId: casual.url,
    url: 'https://example.edu/resource',
    text: 'Example Resource',
    created: getCurrentDate(),
    createdById: casual.integer(1, 999),
    modified: getCurrentDate(),
    modifiedById: casual.integer(1, 999),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);
    link = new AffiliationLink({ ...linkData, errors: {} });
  });

  describe('Constructor', () => {
    it('should initialize options as expected', () => {
      expect(link.id).toEqual(linkData.id);
      expect(link.affiliationId).toEqual(linkData.affiliationId);
      expect(link.url).toEqual(linkData.url);
      expect(link.text).toEqual(linkData.text);
      expect(link.createdById).toEqual(linkData.createdById);
      expect(link.modifiedById).toEqual(linkData.modifiedById);
    });

    it('should handle optional text', () => {
      const data = {
        ...linkData,
        text: undefined,
      };
      const newLink = new AffiliationLink(data);
      expect(newLink.text).toBeUndefined();
    });
  });

  describe('isValid', () => {
    it('should return true when all required fields are present', async () => {
      const result = await link.isValid();
      expect(result).toBe(true);
      expect(Object.keys(link.errors).length).toBe(0);
    });

    it('should add error when affiliationId is missing', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        affiliationId: null,
      });
      const result = await invalidLink.isValid();
      expect(result).toBe(false);
      expect(invalidLink.errors.affiliationId).toBeTruthy();
    });

    it('should add error when affiliationId is empty string', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        affiliationId: '',
      });
      const result = await invalidLink.isValid();
      expect(result).toBe(false);
      expect(invalidLink.errors.affiliationId).toBeTruthy();
    });

    it('should add error when url is invalid', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        url: 'not a url',
      });
      const result = await invalidLink.isValid();
      expect(result).toBe(false);
      expect(invalidLink.errors.url).toBeTruthy();
    });

    it('should add error when url is empty', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        url: '',
      });
      const result = await invalidLink.isValid();
      expect(result).toBe(false);
      expect(invalidLink.errors.url).toBeTruthy();
    });

    it('should add error when url is null', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        url: null,
      });
      const result = await invalidLink.isValid();
      expect(result).toBe(false);
      expect(invalidLink.errors.url).toBeTruthy();
    });

    it('should add multiple errors when multiple required fields are invalid',
      async () => {
        const invalidLink = new AffiliationLink({
          ...linkData,
          affiliationId: null,
          url: 'invalid',
        });
        const result = await invalidLink.isValid();
        expect(result).toBe(false);
        expect(invalidLink.errors.affiliationId).toBeTruthy();
        expect(invalidLink.errors.url).toBeTruthy();
      }
    );

    it('should accept valid URLs with different protocols', async () => {
      const httpLink = new AffiliationLink({
        ...linkData,
        url: 'http://example.edu',
      });
      const result = await httpLink.isValid();
      expect(result).toBe(true);
    });
  });

  describe('create', () => {
    const originalInsert = AffiliationLink.insert;
    const originalFindById = AffiliationLink.findById;
    const originalFindByAffiliationAndURL =
      AffiliationLink.findByAffiliationAndURL;

    let insertQuery;
    let mockFindByAffiliationAndURL;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      insertQuery = jest.fn();
      mockFindByAffiliationAndURL = jest.fn();
      mockFindById = jest.fn();
      (AffiliationLink.insert as jest.Mock) = insertQuery;
      (AffiliationLink.findByAffiliationAndURL as jest.Mock) =
        mockFindByAffiliationAndURL;
      (AffiliationLink.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.insert = originalInsert;
      AffiliationLink.findById = originalFindById;
      AffiliationLink.findByAffiliationAndURL = originalFindByAffiliationAndURL;
    });

    it('should create a new link successfully', async () => {
      mockFindByAffiliationAndURL.mockResolvedValue(null);
      mockFindById.mockResolvedValueOnce(link);
      insertQuery.mockResolvedValueOnce(link.id);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (link.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await link.create(context);
      expect(mockFindByAffiliationAndURL).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(link);
    });

    it('should return error if link already exists for this affiliation',
      async () => {
        const existingLink = new AffiliationLink(linkData);
        mockFindByAffiliationAndURL.mockResolvedValue(existingLink);
        // Mock isValid to return true
        const localValidator = jest.fn();
        (link.isValid as jest.Mock) = localValidator;
        localValidator.mockResolvedValueOnce(true);

        const result = await link.create(context);
        expect(result.errors.general).toBeTruthy();
        expect(insertQuery).not.toHaveBeenCalled();
      }
    );

    it('should add specific error message when link exists for same affiliation',
      async () => {
        const existingLink = new AffiliationLink(linkData);
        mockFindByAffiliationAndURL.mockResolvedValue(existingLink);
        // Mock isValid to return true
        const localValidator = jest.fn();
        (link.isValid as jest.Mock) = localValidator;
        localValidator.mockResolvedValueOnce(true);

        const result = await link.create(context);
        expect(result.errors.general).toContain('this Affiliation');
      }
    );

    it('should return validation errors if link is invalid', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        url: 'invalid',
      });

      const result = await invalidLink.create(context);
      expect(result.errors.url).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const originalUpdate = AffiliationLink.update;
    const originalFindById = AffiliationLink.findById;

    let updateQuery;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      updateQuery = jest.fn();
      mockFindById = jest.fn();
      (AffiliationLink.update as jest.Mock) = updateQuery;
      (AffiliationLink.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.update = originalUpdate;
      AffiliationLink.findById = originalFindById;
    });

    it('should update link successfully', async () => {
      mockFindById.mockResolvedValueOnce(link);
      updateQuery.mockResolvedValueOnce(true);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (link.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await link.update(context);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should return error if link has no id', async () => {
      const noLink = new AffiliationLink({
        ...linkData,
        id: null,
      });

      const result = await noLink.update(context);
      expect(result.errors.general).toBeTruthy();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors if update data is invalid', async () => {
      const invalidLink = new AffiliationLink({
        ...linkData,
        url: 'invalid',
      });

      const result = await invalidLink.update(context);
      expect(result.errors.url).toBeTruthy();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return link with errors if update fails', async () => {
      updateQuery.mockResolvedValueOnce(false);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (link.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await link.update(context);
      expect(result).toEqual(expect.any(AffiliationLink));
    });
  });

  describe('delete', () => {
    const originalDelete = AffiliationLink.delete;
    let deleteQuery;

    beforeEach(() => {
      jest.resetAllMocks();
      deleteQuery = jest.fn();
      (AffiliationLink.delete as jest.Mock) = deleteQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.delete = originalDelete;
    });

    it('should delete link successfully', async () => {
      deleteQuery.mockResolvedValueOnce(true);

      const result = await link.delete(context);
      expect(deleteQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationLink));
    });

    it('should return null if link has no id', async () => {
      const noLink = new AffiliationLink({
        ...linkData,
        id: null,
      });

      const result = await noLink.delete(context);
      expect(result).toBe(null);
      expect(deleteQuery).not.toHaveBeenCalled();
    });

    it('should return null if delete fails', async () => {
      deleteQuery.mockResolvedValueOnce(false);

      const result = await link.delete(context);
      expect(result).toBe(null);
    });
  });

  describe('findById', () => {
    const originalQuery = AffiliationLink.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationLink.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.query = originalQuery;
    });

    it('should return link when findById gets a result', async () => {
      query.mockResolvedValueOnce([linkData]);

      const result = await AffiliationLink.findById('Test', context, link.id);
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationLink));
    });

    it('should return null when findById has no results', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationLink.findById('Test', context, link.id);
      expect(result).toBe(null);
    });
  });

  describe('findByAffiliationAndURL', () => {
    const originalQuery = AffiliationLink.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationLink.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.query = originalQuery;
    });

    it('should return link when findByAffiliationAndURL gets a result',
      async () => {
        query.mockResolvedValueOnce([linkData]);

        const result = await AffiliationLink.findByAffiliationAndURL(
          'Test',
          context,
          link.affiliationId,
          link.url
        );
        expect(query).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expect.any(AffiliationLink));
      }
    );

    it('should return null when findByAffiliationAndURL has no results',
      async () => {
        query.mockResolvedValueOnce([]);

        const result = await AffiliationLink.findByAffiliationAndURL(
          'Test',
          context,
          link.affiliationId,
          link.url
        );
        expect(result).toBe(null);
      }
    );

    it('should search by exact affiliation and URL', async () => {
      query.mockResolvedValueOnce([linkData]);

      const affiliationId = 'https://ror.org/123456';
      const url = 'https://example.edu/resource';
      await AffiliationLink.findByAffiliationAndURL(
        'Test',
        context,
        affiliationId,
        url
      );

      expect(query).toHaveBeenCalledWith(
        context,
        expect.any(String),
        [affiliationId, url],
        'Test'
      );
    });
  });

  describe('findByAffiliationId', () => {
    const originalQuery = AffiliationLink.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationLink.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationLink.query = originalQuery;
    });

    it('should return all links for affiliation', async () => {
      const links = [
        new AffiliationLink(linkData),
        new AffiliationLink({
          ...linkData,
          id: casual.integer(1, 999),
          url: 'https://example.edu/another',
          text: 'Another Resource',
        }),
      ];
      query.mockResolvedValueOnce(links);

      const result = await AffiliationLink.findByAffiliationId(
        'Test',
        context,
        linkData.affiliationId
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no links found', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationLink.findByAffiliationId(
        'Test',
        context,
        linkData.affiliationId
      );
      expect(result).toEqual([]);
    });

    it('should return array of AffiliationLink instances', async () => {
      const links = [
        new AffiliationLink(linkData),
        new AffiliationLink({
          ...linkData,
          id: casual.integer(1, 999),
          url: 'https://example.edu/resource2',
        }),
      ];
      query.mockResolvedValueOnce(links);

      const result = await AffiliationLink.findByAffiliationId(
        'Test',
        context,
        linkData.affiliationId
      );

      result.forEach(affiliationLink => {
        expect(affiliationLink).toBeInstanceOf(AffiliationLink);
      });
    });
  });
});













