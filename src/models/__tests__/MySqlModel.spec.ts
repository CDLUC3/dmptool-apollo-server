import casual from 'casual';
import { MySqlModel } from "../MySqlModel";
import { buildMockContextWithToken } from '../../__mocks__/context';
import { getCurrentDate } from '../../utils/helpers';
import { generalConfig } from '../../config/generalConfig';
import {
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from '../../types/general';
import { logger } from "../../logger";

jest.mock('../../datasources/mysql', () => {
  return {
    __esModule: true,
    MySQLConnection: {
      getInstance: jest.fn().mockReturnValue({
        query: jest.fn(), // Initialize the query mock function
      }),
    },
  };
});

class TestImplementation extends MySqlModel {
  public name: string;
  public testA: string;
  public testB: number;
  public testC: string[];
  public testD: boolean;

  protected testZ: string;

  constructor(opts) {
    super(opts.id, opts.created, opts.createdById, opts.modified, opts.modifiedById);

    this.name = opts.name ?? casual.sentence;
    this.testA = opts.testA;
    this.testB = opts.testB;
    this.testC = opts.testC;
    this.testD = opts.testD;
    this.testZ = opts.testZ;
  }
}

describe('MySqlModel abstract class', () => {
  it('constructor should initialize as expected if it is a new record', () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    expect(model.id).toBeFalsy();
    expect(model.createdById).toEqual(createdById);
    expect(model.modifiedById).toEqual(createdById);
    expect(model.created).toEqual(formattedDate);
    expect(model.modified).toEqual(formattedDate);
  });

  it('constructor should initialize as expected if it is an existing record', () => {
    const id = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const created = formattedDate;
    const createdById = casual.integer(1, 999);
    const modified = formattedDate;
    const modifiedById = casual.integer(1, 999);

    const model = new MySqlModel(id, created, createdById, modified, modifiedById);

    expect(model.id).toEqual(id);
    expect(model.createdById).toEqual(createdById);
    expect(model.modifiedById).toEqual(modifiedById);
    expect(model.created).toEqual(formattedDate);
    expect(model.modified).toEqual(formattedDate);
  });

  it('isValid should return false when the modified date is not a Date', async () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    model.modified = '2456247dgerg';
    expect(await model.isValid()).toBe(false);
    expect(Object.keys(model.errors).length).toBe(1);
    expect(model.errors['modified'].includes('Modified date')).toBe(true);
  });

  it('isValid should return false when the created date is not a Date', async () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    model.created = '2456247dgerg';
    expect(await model.isValid()).toBe(false);
    expect(Object.keys(model.errors).length).toBe(1);
    expect(model.errors['created'].includes('Created date')).toBe(true);
  });

  it('isValid should return false when the createdById is null', async () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    model.createdById = null;
    expect(await model.isValid()).toBe(false);
    expect(Object.keys(model.errors).length).toBe(1);
    expect(model.errors['createdById'].includes('Created by')).toBe(true);
  });

  it('isValid should return false when the modifiedById is null', async () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    model.modifiedById = null;
    expect(await model.isValid()).toBe(false);
    expect(Object.keys(model.errors).length).toBe(1);
    expect(model.errors['modifiedById'].includes('Modified by')).toBe(true);
  });

  it('isValid should return true when the id is null', async () => {
    const createdById = casual.integer(1, 999);
    const formattedDate = getCurrentDate();
    const model = new MySqlModel(null, formattedDate, createdById);

    model.id = null;
    expect(await model.isValid()).toBe(true);
  });

  describe('getPaginationLimit', () => {
    it('returns the provided limit if it is greater than or equal to 1 and less than the maximum limit', () => {
      const limit = 10;
      const result = MySqlModel.getPaginationLimit(limit);
      expect(result).toEqual(limit);
    });

    it('returns the defaultSearchLimit if the provided limit is undefined', () => {
      const result = MySqlModel.getPaginationLimit(undefined);
      expect(result).toEqual(generalConfig.defaultSearchLimit);
    });

    it('returns the defaultSearchLimit if the provided limit is less than 1', () => {
      const limit = 0;
      const result = MySqlModel.getPaginationLimit(limit);
      expect(result).toEqual(generalConfig.defaultSearchLimit);
    });

    it('returns the maximumSearchLimit if the provided limit exceeds the maximum limit', () => {
      const limit = generalConfig.maximumSearchLimit + 10;
      const result = MySqlModel.getPaginationLimit(limit);
      expect(result).toEqual(generalConfig.maximumSearchLimit);
    });

    it('returns the defaultSearchLimit if the provided limit is null', () => {
      const result = MySqlModel.getPaginationLimit(null as unknown as number);
      expect(result).toEqual(generalConfig.defaultSearchLimit);
    });
  });

  describe('getTotalCountForPagination', () => {
    const originalQuery = MySqlModel.query;
    let localQuery;
    let context;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (MySqlModel.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);
    });

    afterEach(() => {
      jest.clearAllMocks();
      MySqlModel.query = originalQuery;
    });

    it('returns the total count when the query succeeds', async () => {
      const sqlStatement = 'SELECT * FROM tests';
      const whereClause = 'WHERE field = ?';
      const groupByClause = 'GROUP BY field';
      const countField = 'id';
      const values = ['value'];
      const reference = 'Testing';
      const mockResponse = [{ total: 4 }, { total: 3 }, { total: 4 }];

      localQuery.mockResolvedValueOnce(mockResponse);

      const result = await MySqlModel.getTotalCountForPagination(
        context,
        sqlStatement,
        whereClause,
        groupByClause,
        countField,
        values,
        reference
      );

      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        'SELECT COUNT(id) total FROM tests WHERE field = ? GROUP BY field',
        values,
        reference
      );
      expect(result).toEqual(3);
    });

    it('returns 0 when the query returns an empty array', async () => {
      const sqlStatement = 'SELECT * FROM tests';
      const whereClause = 'WHERE field = ?';
      const groupByClause = 'GROUP BY field';
      const countField = 'id';
      const values = ['value'];
      const reference = 'Testing';

      localQuery.mockResolvedValueOnce([]);

      const result = await MySqlModel.getTotalCountForPagination(
        context,
        sqlStatement,
        whereClause,
        groupByClause,
        countField,
        values,
        reference
      );

      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        'SELECT COUNT(id) total FROM tests WHERE field = ? GROUP BY field',
        values,
        reference
      );
      expect(result).toEqual(0);
    });

    it('returns 0 when the query fails', async () => {
      const sqlStatement = 'SELECT * FROM tests';
      const whereClause = 'WHERE field = ?';
      const groupByClause = 'GROUP BY field';
      const countField = 'id';
      const values = ['value'];
      const reference = 'Testing';

      localQuery.mockRejectedValueOnce(new Error('Query failed'));

      const result = await MySqlModel.getTotalCountForPagination(
        context,
        sqlStatement,
        whereClause,
        groupByClause,
        countField,
        values,
        reference
      );

      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        'SELECT COUNT(id) total FROM tests WHERE field = ? GROUP BY field',
        values,
        reference
      );
      expect(result).toEqual(0);
    });

    it('handles SQL statements with multiple FROM clauses correctly', async () => {
      const sqlStatement = 'SELECT t1.id, t2.name FROM table1 t1 JOIN table2 t2 ON t1.id = t2.id';
      const whereClause = 'WHERE t1.field = ?';
      const groupByClause = 'GROUP BY t1.field';
      const countField = 't1.id';
      const values = ['value'];
      const reference = 'Testing';
      const mockResponse = [{ total: 10 }, { total: 3 }, { total: 5 }];

      localQuery.mockResolvedValueOnce(mockResponse);

      const result = await MySqlModel.getTotalCountForPagination(
        context,
        sqlStatement,
        whereClause,
        groupByClause,
        countField,
        values,
        reference
      );

      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        'SELECT COUNT(t1.id) total FROM table1 t1 JOIN table2 t2 ON t1.id = t2.id WHERE t1.field = ? GROUP BY t1.field',
        values,
        reference
      );
      expect(result).toEqual(3);
    });
  });
});

describe('preparePaginationOptions', () => {
  it('returns offset pagination options when type is OFFSET', () => {
    const options = {
      type: PaginationType.OFFSET,
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      availableSortFields: ['id', 'name']
    };

    const result = MySqlModel.preparePaginationOptions(options);
    expect(result).toEqual(options);
  });

  it('returns cursor pagination options with default cursor field when no cursor field is provided', () => {
    const options = {
      type: PaginationType.CURSOR,
      limit: 10,
      sortField: 'name',
      sortDir: 'ASC',
      availableSortFields: ['id', 'name']
    };

    const result = MySqlModel.preparePaginationOptions(options);
    expect(result).toEqual({
      ...options,
      cursorField: "LOWER(REPLACE(CONCAT(COALESCE(name, ''), COALESCE(id, '')), ' ', '_'))",
    });
  });

  it('returns cursor pagination options with custom cursor field when provided', () => {
    const options = {
      type: PaginationType.CURSOR,
      limit: 10,
      cursorField: 'custom_field',
      sortField: 'name',
      sortDir: 'ASC',
      availableSortFields: ['id', 'name']
    };

    const result = MySqlModel.preparePaginationOptions(options);
    expect(result).toEqual({
      ...options,
      cursorField: "LOWER(REPLACE(CONCAT(COALESCE(name, ''), COALESCE(custom_field, '')), ' ', '_'))"
    });
  });

  it('handles undefined availableSortFields', () => {
    const options = {
      type: PaginationType.CURSOR,
      limit: 10,
      cursorField: 'custom_field',
      sortField: 'name',
      sortDir: 'ASC'
    };

    const result = MySqlModel.preparePaginationOptions(options);
    expect(result).toEqual({
      ...options,
      availableSortFields: [],
      cursorField: "LOWER(REPLACE(CONCAT(COALESCE(custom_field, '')), ' ', '_'))",
    });
  });
});

describe('prepareValue', () => {
  it('can handle a string', () => {
    const val = 'test';
    expect(MySqlModel.prepareValue(val, String)).toEqual("test");
    const str = new String('test');
    expect(MySqlModel.prepareValue(str, String)).toEqual("test");
  });

  it('can handle a number', () => {
    const val = 12345;
    expect(MySqlModel.prepareValue(val, Number)).toEqual("12345");
    const flt = new String(123.45);
    expect(MySqlModel.prepareValue(flt, Number)).toEqual("123.45");
  });

  it('can handle a boolean', () => {
    const val = true;
    expect(MySqlModel.prepareValue(val, Boolean)).toEqual("true");
    const bool = new Boolean(0);
    expect(MySqlModel.prepareValue(bool, Boolean)).toEqual("false");
  });

  it('can handle an Array', () => {
    const val = ['test1', 'test2'];
    expect(MySqlModel.prepareValue(val, Array)).toEqual('["test1","test2"]');
    const nested = ['test1', 'test2', [12, 34]];
    expect(MySqlModel.prepareValue(nested, Array)).toEqual('["test1","test2",[12,34]]');
    // eslint-disable-next-line @typescript-eslint/no-array-constructor
    const arr = new Array('1', '2');
    expect(MySqlModel.prepareValue(arr, Array)).toEqual('["1","2"]');
  });

  it('can handle an Object', () => {
    const val = { test1: 'test1', test2: 2, test3: false };
    expect(MySqlModel.prepareValue(val, Object)).toEqual('{"test1":"test1","test2":2,"test3":false}');
    const nested = { test1: 'test1', test2: { subA: 2, subB: '3' }, test3: false };
    expect(MySqlModel.prepareValue(nested, Object)).toEqual('{"test1":"test1","test2":{"subA":2,"subB":"3"},"test3":false}');
  });
});

describe('propertyInfo', () => {
  const options = {
    id: casual.integer(1, 9999),
    createdById: casual.integer(1, 99),
    created: casual.date('YYYY-MM-DD'),
    modifiedById: casual.integer(1, 99),
    modifed: casual.date('YYYY-MM-DD'),

    testA: casual.sentence,
    testB: casual.integer(1, 999),
    testC: [casual.sentence, casual.word],
    testD: casual.boolean,
    testZ: casual.words(3),
  }

  it('returns all of the expected properties', () => {
    const obj = new TestImplementation(options);
    const props = MySqlModel.propertyInfo(obj, ['testZ']);

    expect(props.find(i => i.name === 'testA')?.value).toEqual(options.testA);
    expect(props.find(i => i.name === 'testB')?.value).toEqual(options.testB);
    expect(props.find(i => i.name === 'testC')?.value).toEqual(options.testC);
    expect(props.find(i => i.name === 'testD')?.value).toEqual(options.testD);

    expect(props.find(i => i.name === 'testZ')).toBeFalsy();
    expect(props.find(i => i.name === 'id')).toBeFalsy();
    expect(props.find(i => i.name === 'errors')).toBeFalsy();
  });
});

describe('query function', () => {
  const originalQuery = MySqlModel.query;
  let mockQuery;
  let context;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockQuery = jest.fn();
    const dataSource = context.dataSources.sqlDataSource;
    (dataSource.query as jest.Mock) = mockQuery;
  });

  afterEach(() => {
    jest.clearAllMocks();
    MySqlModel.query = originalQuery;
  });

  it('query returns an array and logs the event', async () => {
    mockQuery.mockResolvedValueOnce(['test']);
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql, ['1'], 'Testing');
    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, values: ["1"] }, "Testing");
    expect(result).toEqual(['test']);
  });

  it('query can be called without a values array or reference string', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql,);
    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, values: [] }, "undefined caller");
    expect(result).toEqual([]);
  });

  it('query returns an empty array if an error occurs and logs the error', async () => {
    const mockError = new Error('Testing error handler');
    mockQuery.mockImplementation(() => { throw mockError });
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql, ['123'], 'testing failure');
    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, values: ["123"] }, "testing failure");
    expect(context.logger.error).toHaveBeenCalledWith({}, "testing failure, ERROR: Testing error handler");
    expect(result).toEqual([]);
  });

  it('query returns an empty array if an error occurs and logs the error if no context is provided', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('Testing error handler');
    });
    const sql = 'SELECT * FROM tests WHERE field = ?';
    context.dataSources = null;
    const result = await MySqlModel.query(context, sql, ['123'], 'testing failure');
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    const msg = 'testing failure, ERROR: apolloContext and sqlStatement are required. - SELECT * FROM tests WHERE field = ?';
    expect(context.logger.error).toHaveBeenCalledWith(msg);
    expect(result).toEqual([]);
  });
});

describe('queryWithPagination', () => {
  const originalByOffset = MySqlModel.paginatedQueryByOffset;
  const originalByCursor = MySqlModel.paginatedQueryByCursor;
  let context;
  let localPaginatedQueryByCursor;
  let localPaginatedQueryByOffset;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    localPaginatedQueryByCursor = jest.fn();
    localPaginatedQueryByOffset = jest.fn();

    (MySqlModel.paginatedQueryByCursor as jest.Mock) = localPaginatedQueryByCursor;
    (MySqlModel.paginatedQueryByOffset as jest.Mock) = localPaginatedQueryByOffset;
  });

  afterEach(() => {
    jest.clearAllMocks();
    MySqlModel.paginatedQueryByOffset = originalByOffset;
    MySqlModel.paginatedQueryByCursor = originalByCursor;
  });

  it('calls paginatedQueryByCursor when cursorField is present in options', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      type: PaginationType.CURSOR,
      cursorField: 'id',
      limit: 10,
      cursor: '5',
      sortField: 'id',
      sortDir: 'ASC',
    };
    const reference = 'Testing';
    const mockResponse = { items: [], totalCount: 0 };

    localPaginatedQueryByCursor.mockResolvedValueOnce(mockResponse);

    const result = await MySqlModel.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options,
      reference,
      true
    );

    expect(localPaginatedQueryByCursor).toHaveBeenCalledTimes(1);
    expect(localPaginatedQueryByCursor).toHaveBeenCalledWith(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      {
        ...options,
        availableSortFields: [],
        cursorField: "LOWER(REPLACE(CONCAT(COALESCE(id, '')), ' ', '_'))",
      },
      reference,
      true
    );
    expect(result).toEqual(mockResponse);
  });

  it('calls paginatedQueryByOffset when cursorField is not present in options', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      type: PaginationType.OFFSET,
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
    };
    const reference = 'Testing';
    const mockResponse = { items: [], totalCount: 0 };

    localPaginatedQueryByOffset.mockResolvedValueOnce(mockResponse);

    const result = await MySqlModel.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options,
      reference
    );

    expect(localPaginatedQueryByOffset).toHaveBeenCalledTimes(1);
    expect(localPaginatedQueryByOffset).toHaveBeenCalledWith(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      {
        ...options,
        availableSortFields: []
      },
      reference,
      true
    );
    expect(result).toEqual(mockResponse);
  });

  it('returns an empty result if both paginatedQueryByCursor and paginatedQueryByOffset fail', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      type: PaginationType.OFFSET,
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      cursorField: 'id',
      availableSortFields: ['id', 'name'],
    };
    const reference = 'Testing';

    localPaginatedQueryByCursor.mockRejectedValueOnce(new Error('Cursor query failed'));
    localPaginatedQueryByOffset.mockRejectedValueOnce(new Error('Offset query failed'));

    const result = await MySqlModel.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options,
      reference
    );

    expect(localPaginatedQueryByCursor).not.toHaveBeenCalled();
    expect(localPaginatedQueryByOffset).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ "hasNextPage": false, "items": [], "limit": 5, "totalCount": 0 });
  });
});

describe('paginatedQueryByOffset', () => {
  const originalQuery = MySqlModel.query;
  const originalGetTotalCountForPagination = MySqlModel.getTotalCountForPagination;
  let context;
  let localQuery;
  let localGetTotalCountForPagination;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    localQuery = jest.fn();
    localGetTotalCountForPagination = jest.fn();

    (MySqlModel.query as jest.Mock) = localQuery;
    (MySqlModel.getTotalCountForPagination as jest.Mock) = localGetTotalCountForPagination;
  });

  afterEach(() => {
    jest.clearAllMocks();
    MySqlModel.query = originalQuery;
    MySqlModel.getTotalCountForPagination = originalGetTotalCountForPagination;
  });

  it('returns paginated results with correct metadata', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';
    const mockRows = [{ id: 1 }, { id: 2 }];
    const mockTotalCount = 20;

    localQuery.mockResolvedValueOnce(mockRows);
    localGetTotalCountForPagination.mockResolvedValueOnce(mockTotalCount);

    const result = await MySqlModel.paginatedQueryByOffset(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForOffsets,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(
      context,
      'SELECT * FROM tests WHERE field = ? GROUP BY field ORDER BY id ASC LIMIT ? OFFSET ?',
      ['value', '10', '0'],
      reference
    );
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledWith(
      context,
      sqlStatement,
      'WHERE field = ?',
      groupByClause,
      'id',
      values,
      reference
    );
    expect(result).toEqual({
      items: mockRows,
      limit: 10,
      totalCount: mockTotalCount,
      currentOffset: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      availableSortFields: [],
    });
  });

  it('handles empty results gracefully', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';

    localQuery.mockResolvedValueOnce([]);
    localGetTotalCountForPagination.mockResolvedValueOnce(0);

    const result = await MySqlModel.paginatedQueryByOffset(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForOffsets,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: 10,
      totalCount: 0,
      currentOffset: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      availableSortFields: [],
    });
  });

  it('handles errors during query execution', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';

    localQuery.mockRejectedValueOnce(new Error('Query failed'));

    const result = await MySqlModel.paginatedQueryByOffset(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForOffsets,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: generalConfig.defaultSearchLimit,
      totalCount: 0,
      currentOffset: null,
      hasNextPage: false,
      hasPreviousPage: false,
      availableSortFields: [],
    });
  });

  it('handles errors during total count retrieval', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      limit: 10,
      offset: 0,
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';
    const mockRows = [{ id: 1 }, { id: 2 }];

    localQuery.mockResolvedValueOnce(mockRows);
    localGetTotalCountForPagination.mockRejectedValueOnce(new Error('Count query failed'));

    const result = await MySqlModel.paginatedQueryByOffset(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForOffsets,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: generalConfig.defaultSearchLimit,
      totalCount: 0,
      currentOffset: null,
      hasNextPage: false,
      hasPreviousPage: false,
      availableSortFields: [],
    });
  });
});

describe('paginatedQueryByCursor', () => {
  const originalQuery = MySqlModel.query;
  const originalGetTotalCountForPagination = MySqlModel.getTotalCountForPagination;
  let context;
  let localQuery;
  let localGetTotalCountForPagination;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    localQuery = jest.fn();
    localGetTotalCountForPagination = jest.fn();

    (MySqlModel.query as jest.Mock) = localQuery;
    (MySqlModel.getTotalCountForPagination as jest.Mock) = localGetTotalCountForPagination;
  });

  afterEach(() => {
    jest.clearAllMocks();
    MySqlModel.query = originalQuery;
    MySqlModel.getTotalCountForPagination = originalGetTotalCountForPagination;
  });

  it('returns paginated results with correct metadata', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      cursorField: 'id',
      limit: 2,
      cursor: '5',
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';
    const mockRows = [{ id: 6, cursorId: 6 }, { id: 7, cursorId: 7 }, { id: 8, cursorId: 8 }];
    const mockTotalCount = 20;

    localQuery.mockResolvedValueOnce(mockRows);
    localGetTotalCountForPagination.mockResolvedValueOnce(mockTotalCount);

    const result = await MySqlModel.paginatedQueryByCursor(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForCursors,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(
      context,
      'SELECT id cursorId, * FROM tests WHERE field = ? AND id >= ? GROUP BY field ORDER BY cursorId ASC LIMIT ?',
      ['value', '5', '3'],
      reference
    );
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledWith(
      context,
      sqlStatement,
      'WHERE field = ?',
      groupByClause,
      'id',
      values,
      reference
    );
    expect(result).toEqual({
      items: mockRows.slice(0, 2), // Only return the first 2 items
      limit: 2,
      totalCount: mockTotalCount,
      nextCursor: 8,
      hasNextPage: true,
      availableSortFields: [],
    });
  });

  it('handles empty results gracefully', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      cursorField: 'id',
      limit: 10,
      cursor: '5',
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';

    localQuery.mockResolvedValueOnce([]);
    localGetTotalCountForPagination.mockResolvedValueOnce(0);

    const result = await MySqlModel.paginatedQueryByCursor(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForCursors,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: 10,
      totalCount: 0,
      nextCursor: null,
      hasNextPage: false,
      availableSortFields: []
    });
  });

  it('returns a null nextCursor if there are no further results', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      cursorField: 'id',
      limit: 10,
      cursor: null,
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';
    const mockRows = [{ id: 6, cursorId: 6 }, { id: 7, cursorId: 7 }];
    const mockTotalCount = 2;

    localQuery.mockResolvedValueOnce(mockRows);
    localGetTotalCountForPagination.mockResolvedValueOnce(mockTotalCount);

    const result = await MySqlModel.paginatedQueryByCursor(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForCursors,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: mockRows,
      limit: 10,
      totalCount: mockTotalCount,
      nextCursor: null,
      hasNextPage: false,
      availableSortFields: []
    });
  });

  it('handles errors during query execution', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      cursorField: 'id',
      limit: 10,
      cursor: '5',
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';

    localQuery.mockRejectedValueOnce(new Error('Query failed'));

    const result = await MySqlModel.paginatedQueryByCursor(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForCursors,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: generalConfig.defaultSearchLimit,
      totalCount: 0,
      nextCursor: null,
      hasNextPage: false,
    });
  });

  it('handles errors during total count retrieval', async () => {
    const sqlStatement = 'SELECT * FROM tests';
    const whereFilters = ['field = ?'];
    const groupByClause = 'GROUP BY field';
    const values = ['value'];
    const options = {
      cursorField: 'id',
      limit: 10,
      cursor: '5',
      sortField: 'id',
      sortDir: 'ASC',
      countField: 'id',
    };
    const reference = 'Testing';
    const mockRows = [{ id: 6, cursorId: 6 }, { id: 7, cursorId: 7 }];

    localQuery.mockResolvedValueOnce(mockRows);
    localGetTotalCountForPagination.mockRejectedValueOnce(new Error('Count query failed'));

    const result = await MySqlModel.paginatedQueryByCursor(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      options as PaginationOptionsForCursors,
      reference
    );

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localGetTotalCountForPagination).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [],
      limit: generalConfig.defaultSearchLimit,
      totalCount: 0,
      nextCursor: null,
      hasNextPage: false,
    });
  });
});

describe('exists', () => {
  let localQuery;
  let context;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (MySqlModel.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true if the record is found and logs the event', async () => {
    localQuery.mockResolvedValueOnce(['test']);
    const result = await MySqlModel.exists(context, 'tests', 1, 'Testing');
    expect(result).toEqual(true);
  });

  it('returns false if the record is NOT found and logs the event', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await MySqlModel.exists(context, 'tests', 1, 'Testing');
    expect(result).toEqual(false);
  });
});

describe('insert function', () => {
  let localQuery;
  let context;
  let options;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (MySqlModel.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    options = {
      createdById: casual.integer(1, 99),

      testA: casual.sentence,
      testB: casual.integer(1, 999),
      testC: [casual.sentence, casual.word],
      testD: casual.boolean,
      testZ: casual.words(3),
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('insert returns null if it fails', async () => {
    const table = casual.word;
    const obj = new TestImplementation(options);

    localQuery.mockResolvedValueOnce(null);

    const result = await MySqlModel.insert(context, table, obj, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(null);
  });

  it('insert returns the new item\'s id', async () => {
    const table = casual.word;
    const obj = new TestImplementation(options);

    const id = casual.integer(1, 9999);
    localQuery.mockResolvedValueOnce([{ insertId: id }]);

    const result = await MySqlModel.insert(context, table, obj, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(id);
  });
});

describe('update function', () => {
  let localQuery;
  let context;
  let options;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (MySqlModel.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    options = {
      id: casual.integer(1, 999),
      createdById: casual.integer(1, 99),

      testA: casual.sentence,
      testB: casual.integer(1, 999),
      testC: [casual.sentence, casual.word],
      testD: casual.boolean,
      testZ: casual.words(3),
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('update returns null if it fails', async () => {
    const table = casual.word;
    const obj = new TestImplementation(options);

    localQuery.mockResolvedValueOnce(null);

    const result = await MySqlModel.update(context, table, obj, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(null);
  });

  it('update returns the new item\'s id', async () => {
    const table = casual.word;
    const obj = new TestImplementation(options);

    localQuery.mockResolvedValueOnce([obj]);

    const result = await MySqlModel.update(context, table, obj, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(obj);
  });
});

describe('delete function', () => {
  let localQuery;
  let context;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (MySqlModel.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('update returns false if it fails', async () => {
    const table = casual.word;
    const deleteId = casual.integer(1, 99);
    localQuery.mockResolvedValueOnce(null);

    const result = await MySqlModel.delete(context, table, deleteId, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(false);
  });

  it('update returns the deleted item\'s id', async () => {
    const table = casual.word;
    const deleteId = 1;
    const response = {
      fieldCount: 0,
      affectedRows: 1,
      insertId: 0,
      info: '',
      serverStatus: 2,
      warningStatus: 0,
      changedRows: 0
    }
    localQuery.mockResolvedValueOnce([response]);

    const result = await MySqlModel.delete(context, table, deleteId, 'Testing');
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(true);
  });
});

describe('reconcileAssociationIds', () => {
  it('Works when both arrays are empty', () => {
    const expected = { idsToBeRemoved: [], idsToBeSaved: [] };
    expect(MySqlModel.reconcileAssociationIds([], [])).toEqual(expected);
  });

  it('Works when the arrays are the same', () => {
    const expected = { idsToBeRemoved: [], idsToBeSaved: [] };
    expect(MySqlModel.reconcileAssociationIds([1, 2, 3], [1, 2, 3])).toEqual(expected);
  });

  it('Works when we need to remove all ids', () => {
    const expected = { idsToBeRemoved: [1, 2, 3], idsToBeSaved: [] };
    expect(MySqlModel.reconcileAssociationIds([1, 2, 3], [])).toEqual(expected);
  });

  it('Works when we need to add all ids', () => {
    const expected = { idsToBeRemoved: [], idsToBeSaved: [1, 2, 3] };
    expect(MySqlModel.reconcileAssociationIds([], [1, 2, 3])).toEqual(expected);
  });

  it('Works when we need to remove some ids and add others', () => {
    const expected = { idsToBeRemoved: [4, 8], idsToBeSaved: [1, 5, 7] };
    expect(MySqlModel.reconcileAssociationIds([2, 4, 6, 8], [1, 2, 5, 6, 7])).toEqual(expected);
  });
});
