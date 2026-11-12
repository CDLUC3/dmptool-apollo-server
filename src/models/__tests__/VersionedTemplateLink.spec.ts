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
const { VersionedTemplateLink } = await import('../VersionedTemplateLink.js');
const { TemplateLinkType } = await import('../TemplateLink.js');
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { getCurrentDate } = await import('../../utils/helpers.js');

describe('VersionedTemplateLink', () => {
  let link;
  let context;

  const linkData = {
    id: casual.integer(1, 999),
    versionedTemplateId: casual.integer(1, 999),
    linkType: TemplateLinkType.SAMPLE_PLAN,
    url: 'https://funder.example.org/sample-plan.pdf',
    text: 'Sample plan',
    created: getCurrentDate(),
    createdById: casual.integer(1, 999),
    modified: getCurrentDate(),
    modifiedById: casual.integer(1, 999),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);
    link = new VersionedTemplateLink({ ...linkData, errors: {} });
  });

  describe('Constructor', () => {
    it('should initialize options as expected', () => {
      expect(link.id).toEqual(linkData.id);
      expect(link.versionedTemplateId).toEqual(linkData.versionedTemplateId);
      expect(link.linkType).toEqual(linkData.linkType);
      expect(link.url).toEqual(linkData.url);
      expect(link.text).toEqual(linkData.text);
    });
  });

  describe('isValid', () => {
    it('should return true for a valid link', async () => {
      expect(await link.isValid()).toBe(true);
    });

    it('should add an error when the versionedTemplateId is missing', async () => {
      const invalid = new VersionedTemplateLink({ ...linkData, versionedTemplateId: null });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.versionedTemplateId).toBeTruthy();
    });

    it('should add an error when the url is invalid', async () => {
      const invalid = new VersionedTemplateLink({ ...linkData, url: 'not a url' });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.url).toEqual('Invalid URL');
    });

    it('should add an error when the linkType is missing', async () => {
      const invalid = new VersionedTemplateLink({ ...linkData, linkType: undefined });
      expect(await invalid.isValid()).toBe(false);
      expect(invalid.errors.linkType).toBeTruthy();
    });
  });

  describe('create', () => {
    const originalInsert = VersionedTemplateLink.insert;
    const originalFindById = VersionedTemplateLink.findById;
    const originalFindByVersionedTemplateAndURL = VersionedTemplateLink.findByVersionedTemplateAndURL;

    let insertQuery;
    let mockFindByVersionedTemplateAndURL;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      insertQuery = jest.fn();
      mockFindByVersionedTemplateAndURL = jest.fn();
      mockFindById = jest.fn();
      (VersionedTemplateLink.insert as jest.Mock) = insertQuery;
      (VersionedTemplateLink.findByVersionedTemplateAndURL as jest.Mock) = mockFindByVersionedTemplateAndURL;
      (VersionedTemplateLink.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      VersionedTemplateLink.insert = originalInsert;
      VersionedTemplateLink.findById = originalFindById;
      VersionedTemplateLink.findByVersionedTemplateAndURL = originalFindByVersionedTemplateAndURL;
    });

    it('should insert into the versionedTemplateLinks table using the versionedTemplateId', async () => {
      mockFindByVersionedTemplateAndURL.mockResolvedValueOnce(null);
      insertQuery.mockResolvedValueOnce(link.id);
      mockFindById.mockResolvedValueOnce(link);

      const result = await link.create(context);
      expect(insertQuery).toHaveBeenCalledWith(
        context,
        'versionedTemplateLinks',
        expect.objectContaining({ versionedTemplateId: linkData.versionedTemplateId }),
        'VersionedTemplateLink.create'
      );
      // The table has no templateId column, so the model must not send one
      expect(Object.keys(insertQuery.mock.calls[0][2])).not.toContain('templateId');
      expect(result).toEqual(link);
    });

    it('should return an error if the url is already associated with the version', async () => {
      mockFindByVersionedTemplateAndURL.mockResolvedValueOnce(new VersionedTemplateLink(linkData));

      const result = await link.create(context);
      expect(result.errors.general).toContain('already associated');
      expect(insertQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors', async () => {
      const invalid = new VersionedTemplateLink({ ...linkData, url: 'invalid' });

      const result = await invalid.create(context);
      expect(result.errors.url).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });
  });

  describe('finders', () => {
    const originalQuery = VersionedTemplateLink.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (VersionedTemplateLink.query as jest.Mock) = query;
    });

    afterEach(() => {
      VersionedTemplateLink.query = originalQuery;
    });

    it('findById returns the link', async () => {
      query.mockResolvedValueOnce([linkData]);
      expect(await VersionedTemplateLink.findById('Test', context, linkData.id)).toEqual(expect.any(VersionedTemplateLink));
    });

    it('findById returns null when there are no results', async () => {
      query.mockResolvedValueOnce([]);
      expect(await VersionedTemplateLink.findById('Test', context, linkData.id)).toBeNull();
    });

    it('findByVersionedTemplateAndURL searches by versionedTemplateId and url', async () => {
      query.mockResolvedValueOnce([]);
      const result = await VersionedTemplateLink.findByVersionedTemplateAndURL(
        'Test',
        context,
        linkData.versionedTemplateId,
        linkData.url
      );
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM versionedTemplateLinks WHERE versionedTemplateId = ? AND url = ?',
        [linkData.versionedTemplateId.toString(), linkData.url],
        'Test'
      );
      expect(result).toBeNull();
    });

    it('findByVersionedTemplateId returns the links', async () => {
      query.mockResolvedValueOnce([linkData]);
      const result = await VersionedTemplateLink.findByVersionedTemplateId('Test', context, linkData.versionedTemplateId);
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM versionedTemplateLinks WHERE versionedTemplateId = ? ORDER BY id ASC',
        [linkData.versionedTemplateId.toString()],
        'Test'
      );
      expect(result[0]).toBeInstanceOf(VersionedTemplateLink);
    });

    it('findByVersionedTemplateId filters by linkType', async () => {
      query.mockResolvedValueOnce([]);
      await VersionedTemplateLink.findByVersionedTemplateId(
        'Test',
        context,
        linkData.versionedTemplateId,
        TemplateLinkType.FUNDER
      );
      expect(query).toHaveBeenCalledWith(
        context,
        'SELECT * FROM versionedTemplateLinks WHERE versionedTemplateId = ? AND linkType = ? ORDER BY id ASC',
        [linkData.versionedTemplateId.toString(), TemplateLinkType.FUNDER],
        'Test'
      );
    });
  });
});
