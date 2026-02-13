import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationStatus
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
        errors: {}
      });

      expect(customization.status).toEqual(TemplateCustomizationStatus.DRAFT);
    });

    it('defaults migrationStatus to OK', async () => {
      const customization = new TemplateCustomization({
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        status: 'ACTIVE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
        errors: {}
      });

      const result = await customization.publish(mockContext);

      expect(result.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should add error when drift is detected', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 5,
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        latestPublishedVersionId: 5,
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        latestPublishedVersionId: 5,
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        latestPublishedVersionId: 5,
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
        errors: {}
      });

      const result = await customization.unpublish(mockContext);

      expect(result.errors.affiliationId).toBe('Affiliation can\'t be blank');
    });

    it('should return as-is when versioned customization is not found', async () => {
      const customization = new TemplateCustomization({
        id: 1,
        affiliationId: 'affil-123',
        templateId: 1,
        currentVersionedTemplateId: 10,
        latestPublishedVersionId: 100,
        status: 'PUBLISHED',
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE',
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE'
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
        status: 'ACTIVE',
        migrationStatus: 'UP_TO_DATE'
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
          status: 'ACTIVE',
          migrationStatus: 'UP_TO_DATE'
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
          status: 'ACTIVE',
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
