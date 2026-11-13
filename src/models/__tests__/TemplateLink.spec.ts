import { jest } from '@jest/globals';
import casual from 'casual';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

// Dynamic imports AFTER all mocks are registered
const {
  maxTemplateLinks,
  TEMPLATE_LINK_MAX_FIELD_LENGTH,
  TemplateLink,
  TemplateLinkType,
} = await import('../TemplateLink.js');
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { getCurrentDate } = await import('../../utils/helpers.js');

describe('TemplateLink', () => {
  let link;
  let context;

  const linkData = {
    id: casual.integer(1, 999),
    templateId: casual.integer(1, 999),
    linkType: TemplateLinkType.FUNDER,
    url: 'https://funder.example.org/requirements',
    text: 'Funder requirements',
    created: getCurrentDate(),
    createdById: casual.integer(1, 999),
    modified: getCurrentDate(),
    modifiedById: casual.integer(1, 999),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);
    link = new TemplateLink({ ...linkData, errors: {} });
  });

  describe('Constructor', () => {
    it('should initialize options as expected', () => {
      expect(link.id).toEqual(linkData.id);
      expect(link.templateId).toEqual(linkData.templateId);
      expect(link.linkType).toEqual(linkData.linkType);
      expect(link.url).toEqual(linkData.url);
      expect(link.text).toEqual(linkData.text);
      expect(link.createdById).toEqual(linkData.createdById);
      expect(link.modifiedById).toEqual(linkData.modifiedById);
    });

    it('should trim the url and text', () => {
      const trimmed = new TemplateLink({ ...linkData, url: '  https://example.org  ', text: '  Example  ' });
      expect(trimmed.url).toEqual('https://example.org');
      expect(trimmed.text).toEqual('Example');
    });

    it('should handle optional text', () => {
      const noText = new TemplateLink({ ...linkData, text: undefined });
      expect(noText.text).toBeUndefined();
    });
  });

  describe('maxTemplateLinks', () => {
    it('returns the configured limit for each link type', () => {
      expect(maxTemplateLinks(TemplateLinkType.FUNDER)).toEqual(5);
      expect(maxTemplateLinks(TemplateLinkType.SAMPLE_PLAN)).toEqual(5);
    });
  });

  describe('isValid', () => {
    it('should return true for a valid URL', async () => {
      expect(await link.isValid()).toBe(true);
      expect(Object.keys(link.errors).length).toBe(0);
    });

    it('should return true when the text is blank', async () => {
      const noText = new TemplateLink({ ...linkData, text: null });
      expect(await noText.isValid()).toBe(true);
    });

    it('should add an error when the templateId is missing', async () => {
      const invalid = new TemplateLink({ ...linkData, templateId: null });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.templateId).toBeTruthy();
    });

    it('should add an error when the linkType is missing', async () => {
      const invalid = new TemplateLink({ ...linkData, linkType: null });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.linkType).toBeTruthy();
    });

    it('should add an error when the linkType is not recognized', async () => {
      const invalid = new TemplateLink({ ...linkData, linkType: 'OTHER' });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.linkType).toEqual('Invalid link type');
    });

    it.each([['not a url'], [''], [null]])('should add an error when the url is %p', async (url) => {
      const invalid = new TemplateLink({ ...linkData, url });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.url).toEqual('Invalid URL');
    });

    it('should add an error when the url is too long', async () => {
      const url = `https://example.org/${'a'.repeat(TEMPLATE_LINK_MAX_FIELD_LENGTH)}`;
      const invalid = new TemplateLink({ ...linkData, url });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.url).toContain('characters or less');
    });

    it('should add an error when the text is too long', async () => {
      const invalid = new TemplateLink({ ...linkData, text: 'a'.repeat(TEMPLATE_LINK_MAX_FIELD_LENGTH + 1) });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.text).toContain('characters or less');
    });
  });

  describe('create', () => {
    const originalInsert = TemplateLink.insert;
    const originalFindById = TemplateLink.findById;
    const originalFindByTemplateAndURL = TemplateLink.findByTemplateAndURL;
    const originalFindByTemplateId = TemplateLink.findByTemplateId;

    let insertQuery;
    let mockFindByTemplateAndURL;
    let mockFindByTemplateId;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      insertQuery = jest.fn();
      mockFindByTemplateAndURL = jest.fn();
      mockFindByTemplateId = jest.fn();
      mockFindById = jest.fn();
      (TemplateLink.insert as jest.Mock) = insertQuery;
      (TemplateLink.findByTemplateAndURL as jest.Mock) = mockFindByTemplateAndURL;
      (TemplateLink.findByTemplateId as jest.Mock) = mockFindByTemplateId;
      (TemplateLink.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      TemplateLink.insert = originalInsert;
      TemplateLink.findById = originalFindById;
      TemplateLink.findByTemplateAndURL = originalFindByTemplateAndURL;
      TemplateLink.findByTemplateId = originalFindByTemplateId;
    });

    it('should create a new link', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(null);
      mockFindByTemplateId.mockResolvedValueOnce([]);
      insertQuery.mockResolvedValueOnce(link.id);
      mockFindById.mockResolvedValueOnce(link);

      const result = await link.create(context);
      expect(mockFindByTemplateId).toHaveBeenCalledWith(
        'TemplateLink.create',
        context,
        linkData.templateId,
        TemplateLinkType.FUNDER
      );
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(link);
    });

    it('should return an error if the url is already associated with the Template', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(new TemplateLink(linkData));

      const result = await link.create(context);
      expect(result.errors.general).toContain('already associated');
      expect(insertQuery).not.toHaveBeenCalled();
    });

    it('should return an error if the Template already has the maximum number of links', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(null);
      mockFindByTemplateId.mockResolvedValueOnce(
        [1, 2, 3, 4, 5].map((id) => new TemplateLink({ ...linkData, id, url: `https://example.org/${id}` }))
      );

      const result = await link.create(context);
      expect(result.errors.general).toEqual('A Template can have a maximum of 5 links of this type');
      expect(insertQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors without querying the database', async () => {
      const invalid = new TemplateLink({ ...linkData, url: 'invalid' });

      const result = await invalid.create(context);
      expect(result.errors.url).toBeTruthy();
      expect(mockFindByTemplateAndURL).not.toHaveBeenCalled();
      expect(insertQuery).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const originalUpdate = TemplateLink.update;
    const originalFindById = TemplateLink.findById;
    const originalFindByTemplateAndURL = TemplateLink.findByTemplateAndURL;

    let updateQuery;
    let mockFindById;
    let mockFindByTemplateAndURL;

    beforeEach(() => {
      jest.resetAllMocks();
      updateQuery = jest.fn();
      mockFindById = jest.fn();
      mockFindByTemplateAndURL = jest.fn();
      (TemplateLink.update as jest.Mock) = updateQuery;
      (TemplateLink.findById as jest.Mock) = mockFindById;
      (TemplateLink.findByTemplateAndURL as jest.Mock) = mockFindByTemplateAndURL;
    });

    afterEach(() => {
      TemplateLink.update = originalUpdate;
      TemplateLink.findById = originalFindById;
      TemplateLink.findByTemplateAndURL = originalFindByTemplateAndURL;
    });

    it('should update the link', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(null);
      updateQuery.mockResolvedValueOnce(link);
      mockFindById.mockResolvedValueOnce(link);

      const result = await link.update(context);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should allow the link to keep its own url', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(new TemplateLink(linkData));
      updateQuery.mockResolvedValueOnce(link);
      mockFindById.mockResolvedValueOnce(link);

      const result = await link.update(context);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should return an error if another link on the Template uses the url', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(new TemplateLink({ ...linkData, id: linkData.id + 1 }));

      const result = await link.update(context);
      expect(result.errors.general).toContain('already associated');
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return an error if the link has no id', async () => {
      const noId = new TemplateLink({ ...linkData, id: null });

      const result = await noId.update(context);
      expect(result.errors.general).toEqual('The link does not exist');
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors', async () => {
      const invalid = new TemplateLink({ ...linkData, url: 'invalid' });

      const result = await invalid.update(context);
      expect(result.errors.url).toBeTruthy();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return an error if the update fails', async () => {
      mockFindByTemplateAndURL.mockResolvedValueOnce(null);
      updateQuery.mockResolvedValueOnce(null);

      const result = await link.update(context);
      expect(result.errors.general).toEqual('Unable to update the link');
    });
  });

  describe('delete', () => {
    const originalDelete = TemplateLink.delete;
    let deleteQuery;

    beforeEach(() => {
      jest.resetAllMocks();
      deleteQuery = jest.fn();
      (TemplateLink.delete as jest.Mock) = deleteQuery;
    });

    afterEach(() => {
      TemplateLink.delete = originalDelete;
    });

    it('should delete the link', async () => {
      deleteQuery.mockResolvedValueOnce(true);

      const result = await link.delete(context);
      expect(deleteQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(TemplateLink));
    });

    it('should return null if the link has no id', async () => {
      const noId = new TemplateLink({ ...linkData, id: null });
      expect(await noId.delete(context)).toBeNull();
      expect(deleteQuery).not.toHaveBeenCalled();
    });

    it('should return null if the delete fails', async () => {
      deleteQuery.mockResolvedValueOnce(false);
      expect(await link.delete(context)).toBeNull();
    });
  });

  describe('finders', () => {
    const originalQuery = TemplateLink.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (TemplateLink.query as jest.Mock) = query;
    });

    afterEach(() => {
      TemplateLink.query = originalQuery;
    });

    it('findById returns the link', async () => {
      query.mockResolvedValueOnce([linkData]);
      const result = await TemplateLink.findById('Test', context, linkData.id);
      expect(query).toHaveBeenCalledWith(context, 'SELECT * FROM templateLinks WHERE id = ?', [linkData.id.toString()], 'Test');
      expect(result).toEqual(expect.any(TemplateLink));
    });

    it('findById returns null when there are no results', async () => {
      query.mockResolvedValueOnce([]);
      expect(await TemplateLink.findById('Test', context, linkData.id)).toBeNull();
    });

    it('findByTemplateAndURL searches by templateId and url', async () => {
      query.mockResolvedValueOnce([linkData]);
      const result = await TemplateLink.findByTemplateAndURL('Test', context, linkData.templateId, linkData.url);
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM templateLinks WHERE templateId = ? AND url = ?',
        [linkData.templateId.toString(), linkData.url],
        'Test'
      );
      expect(result).toEqual(expect.any(TemplateLink));
    });

    it('findByTemplateAndURL returns null when there are no results', async () => {
      query.mockResolvedValueOnce([]);
      expect(await TemplateLink.findByTemplateAndURL('Test', context, 1, 'https://example.org')).toBeNull();
    });

    it('findByTemplateId returns all of the links in the order they were added', async () => {
      query.mockResolvedValueOnce([linkData, { ...linkData, id: linkData.id + 1 }]);
      const result = await TemplateLink.findByTemplateId('Test', context, linkData.templateId);
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM templateLinks WHERE templateId = ? ORDER BY id ASC',
        [linkData.templateId.toString()],
        'Test'
      );
      expect(result.length).toBe(2);
      result.forEach((entry) => expect(entry).toBeInstanceOf(TemplateLink));
    });

    it('findByTemplateId filters by linkType', async () => {
      query.mockResolvedValueOnce([]);
      const result = await TemplateLink.findByTemplateId(
        'Test',
        context,
        linkData.templateId,
        TemplateLinkType.SAMPLE_PLAN
      );
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM templateLinks WHERE templateId = ? AND linkType = ? ORDER BY id ASC',
        [linkData.templateId.toString(), TemplateLinkType.SAMPLE_PLAN],
        'Test'
      );
      expect(result).toEqual([]);
    });
  });
});
