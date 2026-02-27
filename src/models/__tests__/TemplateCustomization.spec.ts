import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationStatus,
  TemplateCustomizationOverview,
} from '../TemplateCustomization';
import { VersionedTemplate } from '../VersionedTemplate';
import { VersionedTemplateCustomization } from '../VersionedTemplateCustomization';
import { MyContext } from '../../context';

describe('TemplateCustomization', () => {
  let mockContext: MyContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {} as MyContext;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  describe('isValid()', () => {
    it('should return true when all required fields are present', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it('should add error when affiliationId is missing', async () => {
      const customization = new TemplateCustomization({
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should add error when templateId is null', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: null,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateId).toBe('Template can\'t be blank');
    });

    it('should add error when currentVersionedTemplateId is missing', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: null,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.currentVersionedTemplateId).toBe('Current template version can\'t be blank');
    });

    it('defaults status to DRAFT', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: null,
        migrationStatus: 'OK',
        errors: {}
      });

      expect(customization.status).toEqual(TemplateCustomizationStatus.DRAFT);
    });

    it('defaults migrationStatus to OK', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: null,
        errors: {}
      });

      expect(customization.migrationStatus).toEqual(TemplateCustomizationMigrationStatus.OK);
    });

    it('should add multiple errors when multiple fields are missing', async () => {
      const customization = new TemplateCustomization({
        affiliationId: null,
        templateId: null,
        currentVersionedTemplateId: null,
        status: null,
        migrationStatus: null,
        errors: {}
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(Object.keys(customization.errors).length).toBe(3);
    });
  });

  describe('publish()', () => {
    it('should add error when id is not set', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.publish(mockContext);

      expect(result.errors.general).toBe('Customization has never been saved');
    });

    it('should add error when validation fails', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.publish(mockContext);

      expect(result.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should add error when the customization is already published', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        latestPublishedVersionId: 100,
        latestPublishedDate: '2026-01-01 12:13:14',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.publish(mockContext);

      expect(result.errors.general).toBe('Customization is already published!');
    });

    it('should add error when drift is detected', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: null,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockTemplate = { id: 15 } as undefined as VersionedTemplate;
      jest.spyOn(VersionedTemplate, 'findActiveByTemplateId').mockResolvedValue(mockTemplate);

      const result = await customization.publish(mockContext);

      expect(result.errors.general).toBe('Unable to create version');
    });

    it('should add error when versioned customization creation fails', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockTemplate = { id: 10 } as undefined as VersionedTemplate;
      const createSpy = jest.spyOn(VersionedTemplateCustomization.prototype, 'create').mockResolvedValue(null);
      jest.spyOn(VersionedTemplate, 'findActiveByTemplateId').mockResolvedValue(mockTemplate);

      await customization.publish(mockContext);

      expect(createSpy).toHaveBeenCalled();
    });

    it('should add error when update fails after successful version creation', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockVersionedCustomization = {
        id: 100,
        created: new Date()
      } as undefined as VersionedTemplateCustomization;
      const mockTemplate = { id: 10 } as undefined as VersionedTemplate;
      jest.spyOn(VersionedTemplate, 'findActiveByTemplateId').mockResolvedValue(mockTemplate);
      jest.spyOn(VersionedTemplateCustomization.prototype, 'create').mockResolvedValue(new VersionedTemplateCustomization(mockVersionedCustomization));
      customization.update = jest.fn().mockResolvedValue(null);

      const result = await customization.publish(mockContext);

      expect(result.errors.general).toBe('Unable to publish');
    });

    it('should successfully publish customization', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockVersionedCustomization = {
        id: 100,
        created: new Date()
      } as undefined as VersionedTemplateCustomization;
      const mockUpdatedCustomization = new TemplateCustomization({
        ...customization,
        status: TemplateCustomizationStatus.PUBLISHED
      }) as undefined as TemplateCustomization;
      const mockTemplate = { id: 10 } as undefined as VersionedTemplate;
      jest.spyOn(VersionedTemplate, 'findActiveByTemplateId').mockResolvedValue(mockTemplate);
      jest.spyOn(VersionedTemplateCustomization.prototype, 'create').mockResolvedValue(new VersionedTemplateCustomization(mockVersionedCustomization));
      customization.update = jest.fn().mockResolvedValue(mockUpdatedCustomization);

      const result = await customization.publish(mockContext);

      expect(customization.status).toBe(TemplateCustomizationStatus.PUBLISHED);
      expect(customization.isDirty).toBe(false);
      expect(customization.latestPublishedVersionId).toBe(100);
      expect(result).toBeInstanceOf(TemplateCustomization);
    });
  });

  describe('unpublish()', () => {
    it('should add error when id is not set', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.unpublish(mockContext);

      expect(result.errors.general).toBe('Customization has never been saved');
    });

    it('should add error when validation fails', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.unpublish(mockContext);

      expect(result.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should add error when the customization is not published', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        latestPublishedDate: null,
        latestPublishedVersionId: null,
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.unpublish(mockContext);

      expect(result.errors.general).toBe('Customization is not published!');
    });

    it('should return as-is when versioned customization is not found', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const findBySpy = jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(null);

      const result = await customization.unpublish(mockContext);

      expect(findBySpy).toHaveBeenCalledWith(
        'TemplateCustomization.unpublish',
        mockContext,
        100
      );
      expect(result).toBeInstanceOf(TemplateCustomization);
    });

    it('should add error when versioned customization update fails', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockVersionedCustomization = {
        id: 100,
        active: true,
        update: jest.fn().mockResolvedValue(null)
      } as undefined as VersionedTemplateCustomization;
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockVersionedCustomization);

      const result = await customization.unpublish(mockContext);

      expect(mockVersionedCustomization.update).toHaveBeenCalledWith(mockContext, false);
      expect(result.errors.general).toBe('Unable to unpublish');
    });

    it('should add error when customization update fails after version deactivation', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockVersionedCustomization = {
        id: 100,
        active: true,
        update: jest.fn().mockResolvedValue({id: 100})
      } as undefined as VersionedTemplateCustomization;
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockVersionedCustomization);
      customization.update = jest.fn().mockResolvedValue(null);

      const result = await customization.unpublish(mockContext);

      expect(result.errors.general).toBe('Unable to unpublish the customization');
    });

    it('should successfully unpublish customization', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockUpdatedCustomization = new TemplateCustomization({
        ...customization,
        status: TemplateCustomizationStatus.DRAFT
      });
      const mockVersionedCustomization = {
        id: 100,
        active: true,
        update: jest.fn().mockResolvedValue({id: 100})
      } as undefined as VersionedTemplateCustomization;
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockVersionedCustomization);
      customization.update = jest.fn().mockResolvedValue(mockUpdatedCustomization);

      const result = await customization.unpublish(mockContext);

      expect(customization.status).toBe(TemplateCustomizationStatus.DRAFT);
      expect(customization.isDirty).toBe(false);
      expect(customization.latestPublishedVersionId).toBeUndefined();
      expect(customization.latestPublishedDate).toBeUndefined();
      expect(result).toBe(mockUpdatedCustomization);
    });
  });

  describe('create()', () => {
    it('should add error when validation fails', async () => {
      const customization = new TemplateCustomization({
        affiliationId: null,
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.create(mockContext);

      expect(result.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should add error when customization already exists', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockExisting = new TemplateCustomization({id: 100});
      const findFirstSpy = jest.spyOn(TemplateCustomization, 'findByAffiliationAndTemplate').mockResolvedValue(mockExisting);

      const result = await customization.create(mockContext);

      expect(findFirstSpy).toHaveBeenCalledWith(
        'TemplateCustomization.create',
        mockContext,
        'affil-123',
        1
      );
      expect(result.errors.general).toBe('Template has already been customized');
    });

    it('should successfully create customization', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockCreated = new TemplateCustomization({id: 100, ...customization});
      jest.spyOn(TemplateCustomization, 'findByAffiliationAndTemplate').mockResolvedValue(null);
      const findBySpy = jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockCreated);
      const insertSpy = jest.spyOn(TemplateCustomization, 'insert').mockResolvedValue(100);

      const result = await customization.create(mockContext);

      expect(insertSpy).toHaveBeenCalledWith(
        mockContext,
        TemplateCustomization.tableName,
        customization,
        'TemplateCustomization.create'
      );
      expect(findBySpy).toHaveBeenCalledWith('TemplateCustomization.create', mockContext, 100);
      expect(result).toBe(mockCreated);
    });
  });

  describe('update()', () => {
    it('should add error when id is not set', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe('Customization has never been saved');
    });

    it('should set isDirty to true when published and noTouch is false', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockUpdated = new TemplateCustomization({
        ...customization,
        isDirty: true
      });
      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockUpdated);
      const updateSpy = jest.spyOn(TemplateCustomization, 'update').mockResolvedValue(undefined);

      const result = await customization.update(mockContext, false);

      expect(customization.isDirty).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        mockContext,
        TemplateCustomization.tableName,
        customization,
        'TemplateCustomization.update',
        [],
        false
      );
      expect(result).toBe(mockUpdated);
    });

    it('should not set isDirty when noTouch is true', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockUpdated = new TemplateCustomization(customization);
      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockUpdated);
      const updateSpy = jest.spyOn(TemplateCustomization, 'update').mockResolvedValue(undefined);

      const result = await customization.update(mockContext, true);

      expect(customization.isDirty).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith(
        mockContext,
        TemplateCustomization.tableName,
        customization,
        'TemplateCustomization.update',
        [],
        true
      );
      expect(result).toBe(mockUpdated);
    });

    it('should successfully update customization', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockUpdated = new TemplateCustomization(customization);
      const findBySpy = jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockUpdated);
      jest.spyOn(TemplateCustomization, 'update').mockResolvedValue(undefined);

      const result = await customization.update(mockContext);

      expect(findBySpy).toHaveBeenCalledWith('TemplateCustomization.update', mockContext, 1);
      expect(result).toBe(mockUpdated);
    });
  });

  describe('delete()', () => {
    it('should add error when id is not set', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe('Customization has never been saved');
    });

    it('should add error when delete fails', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockOriginal = new TemplateCustomization(customization);
      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockOriginal);
      const deleteSpy = jest.spyOn(TemplateCustomization, 'delete').mockResolvedValue(false);

      await customization.delete(mockContext);

      expect(deleteSpy).toHaveBeenCalledWith(
        mockContext,
        TemplateCustomization.tableName,
        1,
        'TemplateCustomization.delete'
      );
      expect(customization.errors.general).toBe('Failed to remove customization');
    });

    it('should successfully delete customization', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK',
        errors: {}
      });

      const mockOriginal = new TemplateCustomization(customization);
      const findBySpy = jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockOriginal);
      jest.spyOn(TemplateCustomization, 'delete').mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(findBySpy).toHaveBeenCalledWith('TemplateCustomization.delete', mockContext, 1);
      expect(result).toBe(mockOriginal);
    });
  });

  describe('static findById()', () => {
    it('should return undefined when no results are found', async () => {
      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([]);

      const result = await TemplateCustomization.findById('test-ref', mockContext, 123);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName} WHERE id = ?`,
        ['123'],
        'test-ref'
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      const result = await TemplateCustomization.findById('test-ref', mockContext, 123);

      expect(result).toBeUndefined();
    });

    it('should return customization when found', async () => {
      const mockData = {
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK'
      };

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([mockData]);

      const result = await TemplateCustomization.findById('test-ref', mockContext, 123);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName} WHERE id = ?`,
        ['123'],
        'test-ref'
      );
      expect(result.id).toEqual(mockData.id);
    });
  });

  describe('static findByAffiliationAndTemplate()', () => {
    it('should return undefined when no results are found', async () => {
      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([]);

      const result = await TemplateCustomization.findByAffiliationAndTemplate('test-ref', mockContext, 'affil-123', 1);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE affiliationId = ? AND templateId = ?`,
        ['affil-123', '1'],
        'test-ref'
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      const result = await TemplateCustomization.findByAffiliationAndTemplate('test-ref', mockContext, 'affil-123', 1);

      expect(result).toBeUndefined();
    });

    it('should return customization when found', async () => {
      const mockData = {
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'DRAFT',
        migrationStatus: 'OK'
      };

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([mockData]);

      const result = await TemplateCustomization.findByAffiliationAndTemplate('test-ref', mockContext, 'affil-123', 1);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE affiliationId = ? AND templateId = ?`,
        ['affil-123', '1'],
        'test-ref'
      );
      expect(result.id).toEqual(mockData.id);
    });
  });

  describe('static findByTemplateId()', () => {
    it('should return empty array when no results are found', async () => {
      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([]);

      const result = await TemplateCustomization.findByTemplateId('test-ref', mockContext, 1);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName} WHERE templateId = ?`,
        ['1'],
        'test-ref'
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      const result = await TemplateCustomization.findByTemplateId('test-ref', mockContext, 1);

      expect(result).toEqual([]);
    });

    it('should return array of customizations when found', async () => {
      const mockData = [
        {
          id: 123,
          affiliationId: 'affil-123',
          templateId: 1,
          currentVersionedTemplateId: 10,
          status: 'DRAFT',
          migrationStatus: 'OK'
        },
        {
          id: 124,
          affiliationId: 'affil-124',
          templateId: 1,
          currentVersionedTemplateId: 11,
          status: 'DRAFT',
          migrationStatus: 'STALE'
        }
      ];

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(mockData);

      const result = await TemplateCustomization.findByTemplateId('test-ref', mockContext, 1);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName} WHERE templateId = ?`,
        ['1'],
        'test-ref'
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(TemplateCustomization);
      expect(result[0].id).toBe(123);
      expect(result[1]).toBeInstanceOf(TemplateCustomization);
      expect(result[1].id).toBe(124);
    });
  });

  describe('static findByVersionedTemplateId()', () => {
    it('should return empty array when no results are found', async () => {
      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([]);

      const result = await TemplateCustomization.findByVersionedTemplateId('test-ref', mockContext, 10);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE currentVersionedTemplateId = ?`,
        ['10'],
        'test-ref'
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      const result = await TemplateCustomization.findByVersionedTemplateId('test-ref', mockContext, 10);

      expect(result).toEqual([]);
    });

    it('should return array of customizations when found', async () => {
      const mockData = [
        {
          id: 123,
          affiliationId: 'affil-123',
          templateId: 1,
          currentVersionedTemplateId: 10,
          status: 'DRAFT',
          migrationStatus: 'OK'
        },
        {
          id: 124,
          affiliationId: 'affil-124',
          templateId: 1,
          currentVersionedTemplateId: 10,
          status: 'PUBLISHED',
          migrationStatus: 'OK'
        }
      ];

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(mockData);

      const result = await TemplateCustomization.findByVersionedTemplateId('test-ref', mockContext, 10);

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE currentVersionedTemplateId = ?`,
        ['10'],
        'test-ref'
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(TemplateCustomization);
      expect(result[0].id).toBe(123);
      expect(result[1]).toBeInstanceOf(TemplateCustomization);
      expect(result[1].id).toBe(124);
    });
  });
});

describe('TemplateCustomizationOverview', () => {
  let mockContext: MyContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      logger: {
        error: jest.fn()
      }
    } as undefined as MyContext;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize all properties correctly', () => {
      const options = {
        versionedTemplateId: 1,
        versionedTemplateAffiliationId: 'affil-123',
        versionedTemplateAffiliationName: 'Test Affiliation',
        versionedTemplateName: 'Test Template',
        versionedTemplateVersion: '1.0',
        versionedTemplateLastModified: '2023-01-01',
        customizationId: 10,
        customizationIsDirty: true,
        customizationStatus: TemplateCustomizationStatus.PUBLISHED,
        customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
        customizationLastCustomizedById: 100,
        customizationLastCustomizedByName: 'John Doe',
        customizationLastCustomized: '2023-02-01',
        sections: []
      };

      const overview = new TemplateCustomizationOverview(options);

      expect(overview.versionedTemplateId).toBe(1);
      expect(overview.versionedTemplateAffiliationId).toBe('affil-123');
      expect(overview.versionedTemplateAffiliationName).toBe('Test Affiliation');
      expect(overview.versionedTemplateName).toBe('Test Template');
      expect(overview.versionedTemplateVersion).toBe('1.0');
      expect(overview.versionedTemplateLastModified).toBe('2023-01-01');
      expect(overview.customizationId).toBe(10);
      expect(overview.customizationIsDirty).toBe(true);
      expect(overview.customizationStatus).toBe(TemplateCustomizationStatus.PUBLISHED);
      expect(overview.customizationMigrationStatus).toBe(TemplateCustomizationMigrationStatus.OK);
      expect(overview.customizationLastCustomizedById).toBe(100);
      expect(overview.customizationLastCustomizedByName).toBe('John Doe');
      expect(overview.customizationLastCustomized).toBe('2023-02-01');
      expect(overview.sections).toEqual([]);
    });

    it('should default sections to empty array when not provided', () => {
      const options = {
        versionedTemplateId: 1,
        versionedTemplateAffiliationId: 'affil-123',
        versionedTemplateAffiliationName: 'Test Affiliation',
        versionedTemplateName: 'Test Template',
        versionedTemplateVersion: '1.0',
        versionedTemplateLastModified: '2023-01-01',
        customizationId: 10,
        customizationIsDirty: false,
        customizationStatus: TemplateCustomizationStatus.DRAFT,
        customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
        customizationLastCustomizedById: 100,
        customizationLastCustomizedByName: 'John Doe',
        customizationLastCustomized: '2023-02-01'
      };

      const overview = new TemplateCustomizationOverview(options);

      expect(overview.sections).toEqual([]);
    });
  });

  describe('generateOverview()', () => {
    it('should return undefined when no template rows are found', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        1
      );

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        {templateCustomizationId: 1},
        'Unable to find template customization'
      );
      expect(result).toBeUndefined();
    });

    it('should generate overview with base sections and questions', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: true,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 1,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: true,
          questionCustomizationHasSampleText: false
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result).toBeInstanceOf(TemplateCustomizationOverview);
      expect(result.versionedTemplateId).toBe(1);
      expect(result.customizationId).toBe(10);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].id).toBe(1);
      expect(result.sections[0].sectionCustomizationId).toBe(101);
      expect(result.sections[0].name).toBe('Section 1');
      expect(result.sections[0].questions).toHaveLength(1);
      expect(result.sections[0].questions[0].id).toBe(1);
      expect(result.sections[0].questions[0].questionCustomizationId).toBe(201);
      expect(result.sections[0].questions[0].questionText).toBe('Question 1');
    });

    it('should handle sections without questions', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: null,
          versionedQuestionText: null,
          versionedQuestionDisplayOrder: null,
          questionCustomizationId: null,
          questionCustomizationMigrationStatus: null,
          questionCustomizationHasGuidanceText: null,
          questionCustomizationHasSampleText: null
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].questions).toHaveLength(0);
    });

    it('should inject custom sections and questions', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 1,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        }
      ];

      const mockCustomSections = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: 1,
          guidance: 'Custom Section Guidance',
        }
      ];

      const mockCustomQuestions = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 1,
          guidanceText: 'Custom Question Guidance',
          sampleText: 'Custom Question Sample Text'
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce(mockCustomSections)
        .mockResolvedValueOnce(mockCustomQuestions);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].sectionType).toBe('BASE');
      expect(result.sections[1].sectionType).toBe('CUSTOM');
      expect(result.sections[1].hasCustomGuidance).toBe(true);
      expect(result.sections[0].questions).toHaveLength(2);
      expect(result.sections[0].questions[0].questionType).toBe('BASE');
      expect(result.sections[0].questions[1].questionType).toBe('CUSTOM');
      expect(result.sections[0].questions[1].hasCustomGuidance).toBe(true);
      expect(result.sections[0].questions[1].hasCustomSampleAnswer).toBe(true);
    });
  });

  describe('injectCustomSections()', () => {
    it('should insert custom section at the beginning when pinId is null', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Base Section',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: []
        }
      ];

      const customRows = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: null
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomSections(sections, customRows, mockContext);
      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe(500);
      expect(sections[0].name).toBe('Custom Section');
      expect(sections[1].id).toBe(1);
    });

    it('should insert custom section after the pinned section', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Base Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: []
        },
        {
          sectionType: 'BASE',
          id: 2,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Base Section 2',
          displayOrder: 2,
          hasCustomGuidance: false,
          questions: []
        }
      ];

      const customRows = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: 1
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomSections(sections, customRows, mockContext);

      expect(sections).toHaveLength(3);
      expect(sections[0].id).toBe(1);
      expect(sections[1].id).toBe(500);
      expect(sections[2].id).toBe(2);
    });

    it('should append custom section when pinId is not found', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Base Section',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: []
        }
      ];

      const customRows = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: 999
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomSections(sections, customRows, mockContext);

      expect(sections).toHaveLength(2);
      expect(sections[1].id).toBe(500);
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        customRows[0],
        'Unable to find section to pin custom section'
      );
    });

    it('should sort custom sections by pinId before injection', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Base Section',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: []
        }
      ];

      const customRows = [
        {
          customSectionId: 502,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section 2',
          customSectionPinType: 'BASE',
          customSectionPinId: 1
        },
        {
          customSectionId: 501,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section 1',
          customSectionPinType: 'BASE',
          customSectionPinId: null
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomSections(sections, customRows, mockContext);

      expect(sections).toHaveLength(3);
      expect(sections[0].id).toBe(501);
      expect(sections[2].id).toBe(502);
    });
  });

  describe('injectCustomQuestions()', () => {
    it('should insert custom question at the beginning when pinId is null', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: [
            {
              questionType: 'BASE',
              id: 1,
              migrationStatus: TemplateCustomizationMigrationStatus.OK,
              questionText: 'Base Question',
              displayOrder: 1,
              hasCustomGuidance: false,
              hasCustomSampleAnswer: false
            }
          ]
        }
      ];

      const customRows = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: null
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomQuestions(sections, customRows, mockContext);

      expect(sections[0].questions).toHaveLength(2);
      expect(sections[0].questions[0].id).toBe(600);
      expect(sections[0].questions[1].id).toBe(1);
    });

    it('should insert custom question after the pinned question', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: [
            {
              questionType: 'BASE',
              id: 1,
              migrationStatus: TemplateCustomizationMigrationStatus.OK,
              questionText: 'Base Question 1',
              displayOrder: 1,
              hasCustomGuidance: false,
              hasCustomSampleAnswer: false
            },
            {
              questionType: 'BASE',
              id: 2,
              migrationStatus: TemplateCustomizationMigrationStatus.OK,
              questionText: 'Base Question 2',
              displayOrder: 2,
              hasCustomGuidance: false,
              hasCustomSampleAnswer: false
            }
          ]
        }
      ];

      const customRows = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 1
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomQuestions(sections, customRows, mockContext);

      expect(sections[0].questions).toHaveLength(3);
      expect(sections[0].questions[0].id).toBe(1);
      expect(sections[0].questions[1].id).toBe(600);
      expect(sections[0].questions[2].id).toBe(2);
    });

    it('should append custom question to section when pinId is not found', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: [
            {
              questionType: 'BASE',
              id: 1,
              migrationStatus: TemplateCustomizationMigrationStatus.OK,
              questionText: 'Base Question',
              displayOrder: 1,
              hasCustomGuidance: false,
              hasCustomSampleAnswer: false
            }
          ]
        }
      ];

      const customRows = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 999
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomQuestions(sections, customRows, mockContext);

      expect(sections[0].questions).toHaveLength(2);
      expect(sections[0].questions[1].id).toBe(600);
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        customRows[0],
        'Unable to find the question to pin the custom question to'
      );
    });

    it('should append custom question to last section when section is not found', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: []
        },
        {
          sectionType: 'BASE',
          id: 2,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 2',
          displayOrder: 2,
          hasCustomGuidance: false,
          questions: []
        }
      ];

      const customRows = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 999,
          customQuestionPinType: 'BASE',
          customQuestionPinId: null
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomQuestions(sections, customRows, mockContext);

      expect(sections[1].questions).toHaveLength(1);
      expect(sections[1].questions[0].id).toBe(600);
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        customRows[0],
        'Unable to find the section the custom question belongs to'
      );
    });

    it('should sort custom questions by pinId before injection', () => {
      const sections = [
        {
          sectionType: 'BASE',
          id: 1,
          migrationStatus: TemplateCustomizationMigrationStatus.OK,
          name: 'Section 1',
          displayOrder: 1,
          hasCustomGuidance: false,
          questions: [
            {
              questionType: 'BASE',
              id: 1,
              migrationStatus: TemplateCustomizationMigrationStatus.OK,
              questionText: 'Base Question',
              displayOrder: 1,
              hasCustomGuidance: false,
              hasCustomSampleAnswer: false
            }
          ]
        }
      ];

      const customRows = [
        {
          customQuestionId: 602,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question 2',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 1
        },
        {
          customQuestionId: 601,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question 1',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: null
        }
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomizationOverview as any).injectCustomQuestions(sections, customRows, mockContext);

      expect(sections[0].questions).toHaveLength(3);
      expect(sections[0].questions[0].id).toBe(601);
      expect(sections[0].questions[2].id).toBe(602);
    });
  });

  describe('fetchTemplateData()', () => {
    it('should call query with correct parameters', async () => {
      const mockResults = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 1,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        }
      ];

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(mockResults);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchTemplateData(
        mockContext,
        10,
        'test-ref'
      );

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        expect.stringContaining('SELECT'),
        ['10'],
        'test-ref'
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchTemplateData(
        mockContext,
        10,
        'test-ref'
      );

      expect(result).toEqual([]);
    });
  });

  describe('fetchCustomSections()', () => {
    it('should call query with correct parameters', async () => {
      const mockResults = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: 1
        }
      ];

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(mockResults);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchCustomSections(
        mockContext,
        10,
        'test-ref'
      );

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        expect.stringContaining('SELECT'),
        ['10'],
        'test-ref'
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchCustomSections(
        mockContext,
        10,
        'test-ref'
      );

      expect(result).toEqual([]);
    });
  });

  describe('fetchCustomQuestions()', () => {
    it('should call query with correct parameters', async () => {
      const mockResults = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 1
        }
      ];

      const querySpy = jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(mockResults);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchCustomQuestions(
        mockContext,
        10,
        'test-ref'
      );

      expect(querySpy).toHaveBeenCalledWith(
        mockContext,
        expect.stringContaining('SELECT'),
        ['10'],
        'test-ref'
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when results is not an array', async () => {
      jest.spyOn(TemplateCustomization, 'query').mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (TemplateCustomizationOverview as any).fetchCustomQuestions(
        mockContext,
        10,
        'test-ref'
      );

      expect(result).toEqual([]);
    });
  });

  describe('generateOverview() - display order sequencing', () => {
    it('should set sequential display orders for sections starting from 0', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 5,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: null,
          versionedQuestionText: null,
          versionedQuestionDisplayOrder: null,
          questionCustomizationId: null,
          questionCustomizationMigrationStatus: null,
          questionCustomizationHasGuidanceText: null,
          questionCustomizationHasSampleText: null
        },
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 2,
          versionedSectionName: 'Section 2',
          versionedSectionDisplayOrder: 10,
          sectionCustomizationId: 102,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: null,
          versionedQuestionText: null,
          versionedQuestionDisplayOrder: null,
          questionCustomizationId: null,
          questionCustomizationMigrationStatus: null,
          questionCustomizationHasGuidanceText: null,
          questionCustomizationHasSampleText: null
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].displayOrder).toBe(0);
      expect(result.sections[1].displayOrder).toBe(1);
    });

    it('should set sequential display orders for questions within each section starting from 0', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 5,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        },
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 2,
          versionedQuestionText: 'Question 2',
          versionedQuestionDisplayOrder: 10,
          questionCustomizationId: 202,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].questions).toHaveLength(2);
      expect(result.sections[0].questions[0].displayOrder).toBe(0);
      expect(result.sections[0].questions[1].displayOrder).toBe(1);
    });

    it('should update display orders correctly for multiple sections with multiple questions', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 3,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 8,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        },
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 3,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 2,
          versionedQuestionText: 'Question 2',
          versionedQuestionDisplayOrder: 15,
          questionCustomizationId: 202,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        },
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 2,
          versionedSectionName: 'Section 2',
          versionedSectionDisplayOrder: 7,
          sectionCustomizationId: 102,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 3,
          versionedQuestionText: 'Question 3',
          versionedQuestionDisplayOrder: 20,
          questionCustomizationId: 203,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        },
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 2,
          versionedSectionName: 'Section 2',
          versionedSectionDisplayOrder: 7,
          sectionCustomizationId: 102,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 4,
          versionedQuestionText: 'Question 4',
          versionedQuestionDisplayOrder: 25,
          questionCustomizationId: 204,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].displayOrder).toBe(0);
      expect(result.sections[0].questions).toHaveLength(2);
      expect(result.sections[0].questions[0].displayOrder).toBe(0);
      expect(result.sections[0].questions[1].displayOrder).toBe(1);
      expect(result.sections[1].displayOrder).toBe(1);
      expect(result.sections[1].questions).toHaveLength(2);
      expect(result.sections[1].questions[0].displayOrder).toBe(0);
      expect(result.sections[1].questions[1].displayOrder).toBe(1);
    });

    it('should update display orders correctly when custom sections and questions are injected', async () => {
      const mockTemplateRows = [
        {
          versionedTemplateId: 1,
          versionedTemplateAffiliationId: 'affil-123',
          versionedTemplateAffiliationName: 'Test Affiliation',
          versionedTemplateName: 'Test Template',
          versionedTemplateVersion: '1.0',
          versionedTemplateLastModified: '2023-01-01',
          customizationId: 10,
          customizationIsDirty: false,
          customizationStatus: TemplateCustomizationStatus.PUBLISHED,
          customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customizationLastCustomizedById: 100,
          customizationLastCustomized: '2023-02-01',
          customizationLastCustomizedByName: 'John Doe',
          versionedSectionId: 1,
          versionedSectionName: 'Section 1',
          versionedSectionDisplayOrder: 1,
          sectionCustomizationId: 101,
          sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          sectionCustomizationHasGuidanceText: false,
          versionedQuestionId: 1,
          versionedQuestionText: 'Question 1',
          versionedQuestionDisplayOrder: 1,
          questionCustomizationId: 201,
          questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          questionCustomizationHasGuidanceText: false,
          questionCustomizationHasSampleText: false
        }
      ];

      const mockCustomSections = [
        {
          customSectionId: 500,
          customSectionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customSectionName: 'Custom Section',
          customSectionPinType: 'BASE',
          customSectionPinId: 1
        }
      ];

      const mockCustomQuestions = [
        {
          customQuestionId: 600,
          customQuestionMigrationStatus: TemplateCustomizationMigrationStatus.OK,
          customQuestionText: 'Custom Question',
          customQuestionSectionType: 'BASE',
          customQuestionSectionId: 1,
          customQuestionPinType: 'BASE',
          customQuestionPinId: 1
        }
      ];

      jest.spyOn(TemplateCustomization, 'query')
        .mockResolvedValueOnce(mockTemplateRows)
        .mockResolvedValueOnce(mockCustomSections)
        .mockResolvedValueOnce(mockCustomQuestions);

      const result = await TemplateCustomizationOverview.generateOverview(
        'test-ref',
        mockContext,
        10
      );

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].displayOrder).toBe(0);
      expect(result.sections[0].questions).toHaveLength(2);
      expect(result.sections[0].questions[0].displayOrder).toBe(0);
      expect(result.sections[0].questions[1].displayOrder).toBe(1);
      expect(result.sections[1].displayOrder).toBe(1);
      expect(result.sections[1].questions).toHaveLength(0);
    });
  });

  describe('static markAsDirty()', () => {
    it('should return false when customization is not found', async () => {
      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(null);

      const result = await TemplateCustomization.markAsDirty('test-ref', mockContext, 123);

      expect(result).toBe(false);
    });

    it('should return true when customization is already dirty', async () => {
      const mockCustomization = new TemplateCustomization({
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        isDirty: true,
        errors: {}
      });

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockCustomization);

      const result = await TemplateCustomization.markAsDirty('test-ref', mockContext, 123);

      expect(result).toBe(true);
    });

    it('should return false when update fails', async () => {
      const mockCustomization = new TemplateCustomization({
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        isDirty: false,
        errors: {}
      });

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockCustomization);
      mockCustomization.update = jest.fn().mockResolvedValue(null);

      const result = await TemplateCustomization.markAsDirty('test-ref', mockContext, 123);

      expect(mockCustomization.isDirty).toBe(true);
      expect(mockCustomization.update).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });

    it('should return false when update returns customization with errors', async () => {
      const mockCustomization = new TemplateCustomization({
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        isDirty: false,
        errors: {}
      });

      const mockUpdated = new TemplateCustomization({
        ...mockCustomization,
        isDirty: true,
        errors: {general: 'Some error'}
      });

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockCustomization);
      mockCustomization.update = jest.fn().mockResolvedValue(mockUpdated);

      const result = await TemplateCustomization.markAsDirty('test-ref', mockContext, 123);

      expect(mockCustomization.isDirty).toBe(true);
      expect(mockCustomization.update).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });

    it('should return true when successfully marked as dirty', async () => {
      const mockCustomization = new TemplateCustomization({
        id: 123,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'PUBLISHED',
        migrationStatus: 'OK',
        isDirty: false,
        errors: {}
      });

      const mockUpdated = new TemplateCustomization({
        ...mockCustomization,
        isDirty: true
      });

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(mockCustomization);
      mockCustomization.update = jest.fn().mockResolvedValue(mockUpdated);

      const result = await TemplateCustomization.markAsDirty('test-ref', mockContext, 123);

      expect(mockCustomization.isDirty).toBe(true);
      expect(mockCustomization.update).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);
    });
  });

});
