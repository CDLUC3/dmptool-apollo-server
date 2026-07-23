import casual from 'casual';
import { AffiliationDepartment } from '../AffiliationDepartments';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from '../../logger';
import { getCurrentDate } from '../../utils/helpers';

jest.mock('../../context.ts');

describe('AffiliationDepartment', () => {
  let department;
  let context;

  const departmentData = {
    id: casual.integer(1, 999),
    affiliationId: casual.url,
    name: 'School of Engineering',
    abbreviation: 'SOE',
    created: getCurrentDate(),
    createdById: casual.integer(1, 999),
    modified: getCurrentDate(),
    modifiedById: casual.integer(1, 999),
    errors: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    context = await buildMockContextWithToken(logger);
    department = new AffiliationDepartment({ ...departmentData, errors: {} });
  });

  describe('Constructor', () => {
    it('should initialize options as expected', () => {
      expect(department.id).toEqual(departmentData.id);
      expect(department.affiliationId).toEqual(departmentData.affiliationId);
      expect(department.name).toEqual(departmentData.name);
      expect(department.abbreviation).toEqual(departmentData.abbreviation);
      expect(department.createdById).toEqual(departmentData.createdById);
      expect(department.modifiedById).toEqual(departmentData.modifiedById);
    });

    it('should handle optional abbreviation', () => {
      const data = {
        ...departmentData,
        abbreviation: undefined,
      };
      const dept = new AffiliationDepartment(data);
      expect(dept.abbreviation).toBeUndefined();
    });
  });

  describe('isValid', () => {
    it('should return true when all required fields are present', async () => {
      const result = await department.isValid();
      expect(result).toBe(true);
      expect(Object.keys(department.errors).length).toBe(0);
    });

    it('should add error when affiliationId is null', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        affiliationId: null,
      });
      const result = await invalidDept.isValid();
      expect(result).toBe(false);
      expect(invalidDept.errors.affiliationId).toBeTruthy();
    });

    it('should add error when affiliationId is undefined', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        affiliationId: undefined,
      });
      const result = await invalidDept.isValid();
      expect(result).toBe(false);
      expect(invalidDept.errors.affiliationId).toBeTruthy();
    });

    it('should add error when name is null', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        name: null,
      });
      const result = await invalidDept.isValid();
      expect(result).toBe(false);
      expect(invalidDept.errors.name).toBeTruthy();
    });

    it('should add error when name is undefined', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        name: undefined,
      });
      const result = await invalidDept.isValid();
      expect(result).toBe(false);
      expect(invalidDept.errors.name).toBeTruthy();
    });

    it('should add multiple errors when multiple required fields are missing',
      async () => {
        const invalidDept = new AffiliationDepartment({
          ...departmentData,
          affiliationId: null,
          name: null,
        });
        const result = await invalidDept.isValid();
        expect(result).toBe(false);
        expect(invalidDept.errors.affiliationId).toBeTruthy();
        expect(invalidDept.errors.name).toBeTruthy();
      }
    );
  });

  describe('create', () => {
    const originalInsert = AffiliationDepartment.insert;
    const originalFindById = AffiliationDepartment.findById;
    const originalFindByAffiliationAndName =
      AffiliationDepartment.findByAffiliationAndName;

    let insertQuery;
    let mockFindByAffiliationAndName;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      insertQuery = jest.fn();
      mockFindByAffiliationAndName = jest.fn();
      mockFindById = jest.fn();
      (AffiliationDepartment.insert as jest.Mock) = insertQuery;
      (AffiliationDepartment.findByAffiliationAndName as jest.Mock) =
        mockFindByAffiliationAndName;
      (AffiliationDepartment.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.insert = originalInsert;
      AffiliationDepartment.findById = originalFindById;
      AffiliationDepartment.findByAffiliationAndName =
        originalFindByAffiliationAndName;
    });

    it('should create a new department successfully', async () => {
      mockFindByAffiliationAndName.mockResolvedValue(null);
      mockFindById.mockResolvedValueOnce(department);
      insertQuery.mockResolvedValueOnce(department.id);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (department.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await department.create(context);
      expect(mockFindByAffiliationAndName).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(department);
    });

    it('should return error if department already exists', async () => {
      const existingDept = new AffiliationDepartment(departmentData);
      mockFindByAffiliationAndName.mockResolvedValue(existingDept);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (department.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await department.create(context);
      expect(result.errors.general).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors if department is invalid', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        name: null,
      });

      const result = await invalidDept.create(context);
      expect(result.errors.name).toBeTruthy();
      expect(insertQuery).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const originalUpdate = AffiliationDepartment.update;
    const originalFindById = AffiliationDepartment.findById;

    let updateQuery;
    let mockFindById;

    beforeEach(() => {
      jest.resetAllMocks();
      updateQuery = jest.fn();
      mockFindById = jest.fn();
      (AffiliationDepartment.update as jest.Mock) = updateQuery;
      (AffiliationDepartment.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.update = originalUpdate;
      AffiliationDepartment.findById = originalFindById;
    });

    it('should update department successfully', async () => {
      mockFindById.mockResolvedValueOnce(department);
      updateQuery.mockResolvedValueOnce(true);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (department.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await department.update(context);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should return error if department has no id', async () => {
      const noDept = new AffiliationDepartment({
        ...departmentData,
        id: null,
      });

      const result = await noDept.update(context);
      expect(result.errors.general).toBeTruthy();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return validation errors if update data is invalid', async () => {
      const invalidDept = new AffiliationDepartment({
        ...departmentData,
        name: null,
      });

      const result = await invalidDept.update(context);
      expect(result.errors.name).toBeTruthy();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('should return department with errors if update fails', async () => {
      updateQuery.mockResolvedValueOnce(false);
      // Mock isValid to return true
      const localValidator = jest.fn();
      (department.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const result = await department.update(context);
      expect(result).toEqual(expect.any(AffiliationDepartment));
    });
  });

  describe('delete', () => {
    const originalDelete = AffiliationDepartment.delete;
    let deleteQuery;

    beforeEach(() => {
      jest.resetAllMocks();
      deleteQuery = jest.fn();
      (AffiliationDepartment.delete as jest.Mock) = deleteQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.delete = originalDelete;
    });

    it('should delete department successfully', async () => {
      deleteQuery.mockResolvedValueOnce(true);

      const result = await department.delete(context);
      expect(deleteQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationDepartment));
    });

    it('should return null if department has no id', async () => {
      const noDept = new AffiliationDepartment({
        ...departmentData,
        id: null,
      });

      const result = await noDept.delete(context);
      expect(result).toBe(null);
      expect(deleteQuery).not.toHaveBeenCalled();
    });

    it('should return null if delete fails', async () => {
      deleteQuery.mockResolvedValueOnce(false);

      const result = await department.delete(context);
      expect(result).toBe(null);
    });
  });

  describe('addToUser', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should add department to user successfully', async () => {
      query.mockResolvedValueOnce([{ id: 1 }]);

      const userId = casual.integer(1, 999);
      const result = await department.addToUser(context, userId);

      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false if add to user fails', async () => {
      query.mockResolvedValueOnce(null);

      const userId = casual.integer(1, 999);
      const result = await department.addToUser(context, userId);

      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  describe('removeFromUser', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should remove department from user successfully', async () => {
      query.mockResolvedValueOnce([]);

      const userId = casual.integer(1, 999);
      const result = await department.removeFromUser(context, userId);

      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false if remove from user fails', async () => {
      query.mockResolvedValueOnce(null);

      const userId = casual.integer(1, 999);
      const result = await department.removeFromUser(context, userId);

      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  describe('findById', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should return department when findById gets a result', async () => {
      query.mockResolvedValueOnce([departmentData]);

      const result = await AffiliationDepartment.findById('Test', context, department.id);
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.any(AffiliationDepartment));
    });

    it('should return null when findById has no results', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationDepartment.findById('Test', context, department.id);
      expect(result).toBe(null);
    });
  });

  describe('findByAffiliationAndName', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should return department when findByAffiliationAndName gets a result',
      async () => {
        query.mockResolvedValueOnce([departmentData]);

        const result = await AffiliationDepartment.findByAffiliationAndName(
          'Test',
          context,
          department.affiliationId,
          department.name
        );
        expect(query).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expect.any(AffiliationDepartment));
      }
    );

    it('should return null when findByAffiliationAndName has no results',
      async () => {
        query.mockResolvedValueOnce([]);

        const result = await AffiliationDepartment.findByAffiliationAndName(
          'Test',
          context,
          department.affiliationId,
          department.name
        );
        expect(result).toBe(null);
      }
    );

    it('should normalize name for comparison', async () => {
      query.mockResolvedValueOnce([departmentData]);

      const nameWithSpaces = '  School Of Engineering  ';
      await AffiliationDepartment.findByAffiliationAndName(
        'Test',
        context,
        department.affiliationId,
        nameWithSpaces
      );

      expect(query).toHaveBeenCalledWith(
        context,
        expect.any(String),
        [department.affiliationId, nameWithSpaces.trim().toLowerCase()],
        'Test'
      );
    });
  });

  describe('findByAffiliationId', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should return all departments for affiliation', async () => {
      const departments = [
        new AffiliationDepartment(departmentData),
        new AffiliationDepartment({
          ...departmentData,
          id: casual.integer(1, 999),
          name: 'School of Medicine',
        }),
      ];
      query.mockResolvedValueOnce(departments);

      const result = await AffiliationDepartment.findByAffiliationId(
        'Test',
        context,
        departmentData.affiliationId
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no departments found', async () => {
      query.mockResolvedValueOnce([]);

      const result = await AffiliationDepartment.findByAffiliationId(
        'Test',
        context,
        departmentData.affiliationId
      );
      expect(result).toEqual([]);
    });
  });

  describe('findByUserId', () => {
    const originalQuery = AffiliationDepartment.query;
    let query;

    beforeEach(() => {
      jest.resetAllMocks();
      query = jest.fn();
      (AffiliationDepartment.query as jest.Mock) = query;
    });

    afterEach(() => {
      jest.clearAllMocks();
      AffiliationDepartment.query = originalQuery;
    });

    it('should return all departments for user', async () => {
      const departments = [
        new AffiliationDepartment(departmentData),
        new AffiliationDepartment({
          ...departmentData,
          id: casual.integer(1, 999),
          name: 'School of Medicine',
        }),
      ];
      query.mockResolvedValueOnce(departments);

      const userId = casual.integer(1, 999);
      const result = await AffiliationDepartment.findByUserId(
        'Test',
        context,
        userId.toString()
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no departments found for user', async () => {
      query.mockResolvedValueOnce([]);

      const userId = casual.integer(1, 999);
      const result = await AffiliationDepartment.findByUserId(
        'Test',
        context,
        userId.toString()
      );
      expect(result).toEqual([]);
    });
  });
});












