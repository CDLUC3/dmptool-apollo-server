import { ResearchOutputType } from '../ResearchOutputType';
import { MyContext } from '../../context.js';
import casual from 'casual';
import { buildMockContextWithToken } from "../../__mocks__/context.js";

import { logger } from "../../logger.js";

describe('ResearchOutputType', () => {
  let context: MyContext;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  const mockData = {
    id: casual.integer(1, 1000),
    name: casual.title,
    value: casual.title.toLowerCase().replace(/\s+/g, '-'),
    description: casual.description,
    created: new Date(),
    createdById: casual.integer(1, 1000),
    modified: new Date(),
    modifiedById: casual.integer(1, 1000),
  };

  describe('constructor', () => {
    it('should create a new instance with valid data', () => {
      const type = new ResearchOutputType(mockData);
      expect(type.id).toBe(mockData.id);
      expect(type.name).toBe(mockData.name);
      expect(type.description).toBe(mockData.description);
    });

    it('should handle missing optional fields', () => {
      const data = { name: mockData.name, value: mockData.value }
      const type = new ResearchOutputType(data);
      expect(type.description).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const type = new ResearchOutputType(mockData);
      const isValid = await type.isValid();
      expect(isValid).toBeTruthy();
      expect(type.errors).toEqual({});
    });

    it('should fail validation with missing name', async () => {
      const type = new ResearchOutputType({ ...mockData, name: null });
      const isValid = await type.isValid();
      expect(isValid).toBeFalsy();
      expect(type.errors.name).toBeDefined();
    });
  });

  describe('prepForSave', () => {
    it('should adjust the fields for insertion into the database', () => {
      const data = {
        name: ' Test type    ',
        description: '   Test description  '
      };
      const typ = new ResearchOutputType(data);
      typ.prepForSave();
      expect(typ.name).toBe(data.name.trim());
      expect(typ.description).toBe(data.description.trim());
      expect(typ.value).toBe(data.name.trim().toLowerCase().replace(/\s+/g, '-'));
    });
  });

  describe('database operations', () => {
    it('should create a new record', async () => {
      const type = new ResearchOutputType(mockData);
      jest.spyOn(ResearchOutputType, 'insert').mockResolvedValueOnce(type.id);
      jest.spyOn(ResearchOutputType, 'findByValue').mockResolvedValueOnce(null);
      jest.spyOn(ResearchOutputType, 'findById').mockResolvedValueOnce(type);

      const result = await type.create(context);
      expect(result).toBeInstanceOf(ResearchOutputType);
      expect(result.id).toBe(mockData.id);
    });

    it('should update an existing record', async () => {
      const type = new ResearchOutputType(mockData);
      jest.spyOn(ResearchOutputType, 'update')
        .mockResolvedValueOnce(new ResearchOutputType(mockData));
      jest.spyOn(ResearchOutputType, 'findById').mockResolvedValueOnce(type);

      const result = await type.update(context);
      expect(result).toBeInstanceOf(ResearchOutputType);
      expect(result.id).toBe(mockData.id);
    });

    it('should find by id', async () => {
      jest.spyOn(ResearchOutputType, 'query').mockResolvedValueOnce([mockData]);

      const result = await ResearchOutputType.findById('test', context, mockData.id);
      expect(result).toBeInstanceOf(ResearchOutputType);
      expect(result.id).toBe(mockData.id);
    });

    it('should return null when finding non-existent id', async () => {
      jest.spyOn(ResearchOutputType, 'query').mockResolvedValueOnce([]);

      const result = await ResearchOutputType.findById('test', context, 999999);
      expect(result).toBeNull();
    });
  });
});
