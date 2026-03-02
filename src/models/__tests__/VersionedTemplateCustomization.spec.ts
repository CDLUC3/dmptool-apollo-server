import {
  VersionedTemplateCustomization
} from '../VersionedTemplateCustomization';
import { MySqlModel } from '../MySqlModel';
import { MyContext } from '../../context';

describe('VersionedTemplateCustomization', () => {
  let mockContext: MyContext;
  let mockOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {} as MyContext;

    mockOptions = {
      id: 1,
      created: '2024-01-01',
      createdById: 100,
      modified: '2024-01-02',
      modifiedById: 101,
      errors: {},
      affiliationId: 'affil-123',
      templateCustomizationId: 10,
      currentVersionedTemplateId: 20,
      active: true,
    };

    // Mock parent class methods
    (MySqlModel.prototype.isValid as jest.Mock) = jest.fn().mockResolvedValue(true);
    (MySqlModel.prototype.addError as jest.Mock) = jest.fn();
    (MySqlModel.prototype.hasErrors as jest.Mock) = jest.fn().mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  describe('constructor', () => {
    it('should initialize with all provided options', () => {
      const instance = new VersionedTemplateCustomization(mockOptions);

      expect(instance.affiliationId).toBe('affil-123');
      expect(instance.templateCustomizationId).toBe(10);
      expect(instance.currentVersionedTemplateId).toBe(20);
      expect(instance.active).toBe(true);
    });

    it('should default active to false when not provided', () => {
      delete mockOptions.active;
      const instance = new VersionedTemplateCustomization(mockOptions);

      expect(instance.active).toBe(false);
    });

    it('should handle active as false explicitly', () => {
      mockOptions.active = false;
      const instance = new VersionedTemplateCustomization(mockOptions);

      expect(instance.active).toBe(false);
    });
  });

  describe('isValid', () => {
    it('should return true when all required fields are present', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      const result = await instance.isValid();

      expect(result).toBe(true);
      expect(MySqlModel.prototype.isValid).toHaveBeenCalled();
    });

    it('should add error when affiliationId is missing', async () => {
      mockOptions.affiliationId = undefined;
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      await instance.isValid();

      expect(instance.addError).toHaveBeenCalledWith('affiliationId', "Affiliation can't be blank");
    });

    it('should add error when templateCustomizationId is null', async () => {
      mockOptions.templateCustomizationId = null;
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      await instance.isValid();

      expect(instance.addError).toHaveBeenCalledWith('templateCustomizationId', "Template customization can't be blank");
    });

    it('should add error when currentVersionedTemplateId is missing', async () => {
      mockOptions.currentVersionedTemplateId = null;
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      await instance.isValid();

      expect(instance.addError).toHaveBeenCalledWith('currentVersionedTemplateId', "Funder template can't be blank");
    });

    it('should return false when there are errors', async () => {
      mockOptions.affiliationId = '';
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = { affiliationId: "Affiliation can't be blank" };

      const result = await instance.isValid();

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new version successfully', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      const mockNewVersion = new VersionedTemplateCustomization({
        ...mockOptions,
        id: 2
      });
      const createdInstance = new VersionedTemplateCustomization(mockNewVersion);

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'findByCustomizationAndTemplate').mockResolvedValue(undefined);
      jest.spyOn(VersionedTemplateCustomization, 'insert').mockResolvedValue(2);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(createdInstance);
      jest.spyOn(createdInstance, 'unpublishOtherVersions').mockResolvedValue(true);

      const result = await instance.create(mockContext);

      expect(instance.active).toBe(true);
      expect(VersionedTemplateCustomization.insert).toHaveBeenCalledWith(
        mockContext,
        'versionedTemplateCustomizations',
        instance,
        'VersionedTemplateCustomization.create'
      );
      expect(createdInstance.unpublishOtherVersions).toHaveBeenCalled();
      expect(result).toBe(createdInstance);
    });

    it('should add error when insert fails', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'findByCustomizationAndTemplate').mockResolvedValue(undefined);
      jest.spyOn(VersionedTemplateCustomization, 'insert').mockResolvedValue(null);

      await instance.create(mockContext);

      expect(instance.addError).toHaveBeenCalledWith('general', 'Unable to create version');
    });

    it('should return instance with errors when validation fails', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;
      instance.errors = { test: 'error' };

      jest.spyOn(instance, 'isValid').mockResolvedValue(false);

      const result = await instance.create(mockContext);

      expect(result).toBeInstanceOf(VersionedTemplateCustomization);
    });
  });

  describe('update', () => {
    it('should update an existing version successfully', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;
      instance.errors = {};

      const mockUpdated = new VersionedTemplateCustomization(mockOptions);
      const mockFetched = new VersionedTemplateCustomization({
        ...mockOptions,
        modified: '2024-01-03'
      });

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'update').mockResolvedValue({affectedRows: 1} as unknown as VersionedTemplateCustomization);
      jest.spyOn(mockUpdated, 'hasErrors').mockReturnValue(false);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockFetched);

      const result = await instance.update(mockContext, false);

      expect(VersionedTemplateCustomization.update).toHaveBeenCalledWith(
        mockContext,
        'versionedTemplateCustomizations',
        instance,
        'VersionedTemplateCustomization.update',
        [],
        false
      );
      expect(result).toBe(mockFetched);
    });

    it('should pass noTouch parameter correctly', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;
      instance.errors = {};

      const mockUpdated = new VersionedTemplateCustomization(mockOptions);
      const mockFetched = new VersionedTemplateCustomization(mockOptions);

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'update').mockResolvedValue(mockUpdated);
      jest.spyOn(mockUpdated, 'hasErrors').mockReturnValue(false);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockFetched);

      await instance.update(mockContext, true);

      expect(VersionedTemplateCustomization.update).toHaveBeenCalledWith(
        mockContext,
        'versionedTemplateCustomizations',
        instance,
        'VersionedTemplateCustomization.update',
        [],
        true
      );
    });

    it('should add error when id is not set', async () => {
      mockOptions.id = undefined;
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      await instance.update(mockContext);

      expect(instance.addError).toHaveBeenCalledWith('general', 'Version has never been saved');
    });

    it('should add error when update returns null', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.errors = {};

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'update').mockResolvedValue(null);

      await instance.update(mockContext);

      expect(instance.addError).toHaveBeenCalledWith('general', 'Unable to update version');
    });

    it('should add error when updated has errors', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;
      instance.errors = {};

      const mockUpdated = new VersionedTemplateCustomization(mockOptions);

      jest.spyOn(instance, 'isValid').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'update').mockResolvedValue(mockUpdated);
      jest.spyOn(mockUpdated, 'hasErrors').mockReturnValue(true);

      await instance.update(mockContext);

      expect(instance.addError).toHaveBeenCalledWith('general', 'Unable to update version');
    });
  });

  describe('unpublishOtherVersions', () => {
    it('should unpublish other versions successfully', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;

      const mockResults = [{ affectedRows: 2 }];
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(mockResults);

      const result = await instance.unpublishOtherVersions('test-ref', mockContext);

      expect(VersionedTemplateCustomization.query).toHaveBeenCalledWith(
        mockContext,
        expect.stringContaining('UPDATE versionedTemplateCustomizations SET active = 0'),
        ['1', '10'],
        'test-ref'
      );
      expect(result).toBe(true);
    });

    it('should return false when query returns no results', async () => {
      const instance = new VersionedTemplateCustomization(mockOptions);
      instance.id = 1;

      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(null);

      const result = await instance.unpublishOtherVersions('test-ref', mockContext);

      expect(result).toBe(false);
    });
  });

  describe('findById', () => {
    it('should find and return a version by id', async () => {
      const mockResults = [mockOptions];
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(mockResults);

      const result = await VersionedTemplateCustomization.findById('test-ref', mockContext, 1);

      expect(VersionedTemplateCustomization.query).toHaveBeenCalledWith(
        mockContext,
        'SELECT * FROM versionedTemplateCustomizations WHERE id = ?',
        ['1'],
        'test-ref'
      );

      expect(result).toBeInstanceOf(VersionedTemplateCustomization);
    });

    it('should return undefined when no results found', async () => {
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue([]);

      const result = await VersionedTemplateCustomization.findById('test-ref', mockContext, 999);

      expect(result).toBeUndefined();
    });

    it('should return undefined when query returns null', async () => {
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(null);

      const result = await VersionedTemplateCustomization.findById('test-ref', mockContext, 999);

      expect(result).toBeUndefined();
    });

    it('should handle undefined versionedTemplateCustomizationId', async () => {
      const mockResults = [mockOptions];
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(mockResults);

      await VersionedTemplateCustomization.findById('test-ref', mockContext, undefined);

      expect(VersionedTemplateCustomization.query).toHaveBeenCalledWith(
        mockContext,
        expect.any(String),
        [undefined],
        'test-ref'
      );
    });
  });

  describe('findByCustomizationAndTemplate', () => {
    it('should find and return a version by customization and template ids', async () => {
      const mockResults = [mockOptions];
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(mockResults);

      const result = await VersionedTemplateCustomization.findByCustomizationAndTemplate(
        'test-ref',
        mockContext,
        10,
        20
      );

      expect(VersionedTemplateCustomization.query).toHaveBeenCalledWith(
        mockContext,
        expect.stringContaining('SELECT * FROM versionedTemplateCustomizations'),
        ['10', '20'],
        'test-ref'
      );
      expect(result).toBeInstanceOf(VersionedTemplateCustomization);
      expect(result.templateCustomizationId).toBe(10);
      expect(result.currentVersionedTemplateId).toBe(20);
    });

    it('should return undefined when no results found', async () => {
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue([]);

      const result = await VersionedTemplateCustomization.findByCustomizationAndTemplate(
        'test-ref',
        mockContext,
        999,
        999
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined when query returns null', async () => {
      jest.spyOn(VersionedTemplateCustomization, 'query').mockResolvedValue(null);

      const result = await VersionedTemplateCustomization.findByCustomizationAndTemplate(
        'test-ref',
        mockContext,
        999,
        999
      );

      expect(result).toBeUndefined();
    });
  });

  describe('tableName', () => {
    it('should have correct table name', () => {
      expect(VersionedTemplateCustomization.tableName).toBe('versionedTemplateCustomizations');
    });
  });
});
