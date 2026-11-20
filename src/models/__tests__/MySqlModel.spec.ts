import { jest } from '@jest/globals';
import casual from "casual";
import { formatISO9075 } from 'date-fns';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

jest.unstable_mockModule('../../datasources/mysql.js', () => ({
  MySQLConnection: {
    getInstance: jest.fn().mockReturnValue({
      query: jest.fn(),
    }),
  },
}));



import type { MyContext } from '../../context.js';


//Dynamic imports AFTER all mocks are registered
const { MySqlModel } = await import('../MySqlModel.js');
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { generalConfig } = await import('../../config/generalConfig.js');
const { getCurrentDate } = await import('../../utils/helpers.js');
const { PaginationType } = await import('../../types/general.js');

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
  describe('queryWithOptimizedPagination', () => {
    const originalQuery = MySqlModel.query;

    afterEach(() => {
      MySqlModel.query = originalQuery;
    });

    it('selects a page of IDs and hydrates only those rows in page order', async () => {
      const query = jest.fn<(context: MyContext, sql: string, values: unknown[], reference: string) => Promise<unknown[]>>()
        .mockResolvedValueOnce([{ id: 7, totalCount: 3 }, { id: 9, totalCount: 3 }, { id: 12, totalCount: 3 }])
        .mockResolvedValueOnce([{ id: 9, name: 'second' }, { id: 7, name: 'first' }]);
      (MySqlModel.query as jest.Mock) = query;

      const result = await MySqlModel.queryWithOptimizedPagination<{ id: number; name: string }>(
        await buildMockContextWithToken(logger),
        'SELECT p.id, p.created FROM plans p WHERE p.createdById = ?',
        ['44'],
        'SELECT p.id, p.title AS name FROM plans p WHERE p.id IN (/* PAGE_IDS */)',
        { type: PaginationType.OFFSET, limit: 2, offset: 4, sortField: 'p.created', sortDir: 'DESC' },
        'test pagination',
      );

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenNthCalledWith(1, expect.anything(), expect.stringContaining('ORDER BY p.created DESC, id DESC LIMIT ? OFFSET ?'), ['44', '3', '4'], 'test pagination');
      expect(query).toHaveBeenNthCalledWith(2, expect.anything(), expect.stringContaining('IN (?, ?)'), ['7', '9'], 'test pagination');
      expect(result.items.map((item) => item.id)).toEqual([7, 9]);
      expect(result.totalCount).toBeNull();
      expect(result.hasNextPage).toBe(true);
      expect(result.currentOffset).toBe(4);
    });

    it('does not hydrate when the selected page is empty', async () => {
      const query = jest.fn<(context: MyContext, sql: string, values: unknown[], reference: string) => Promise<unknown[]>>().mockResolvedValueOnce([]);
      (MySqlModel.query as jest.Mock) = query;

      const result = await MySqlModel.queryWithOptimizedPagination(
        await buildMockContextWithToken(logger),
        'SELECT p.id FROM plans p WHERE p.createdById = ?',
        ['44'],
        'SELECT p.id FROM plans p WHERE p.id IN (/* PAGE_IDS */)',
        { type: PaginationType.OFFSET, limit: 10, offset: 0 },
        'test pagination',
      );

      expect(query).toHaveBeenCalledTimes(1);
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBeNull();
      expect(result.hasNextPage).toBe(false);
    });

    it('applies cursor filtering and returns the next cursor while hydrating the current page', async () => {
      const query = jest.fn<(context: MyContext, sql: string, values: unknown[], reference: string) => Promise<unknown[]>>()
        .mockResolvedValueOnce([
          { id: 8, cursorId: 'b8' },
          { id: 9, cursorId: 'b9' },
          { id: 10, cursorId: 'c10' },
        ])
        .mockResolvedValueOnce([{ id: 8 }, { id: 9 }]);
      (MySqlModel.query as jest.Mock) = query;

      const result = await MySqlModel.queryWithOptimizedPagination<{ id: number }>(
        await buildMockContextWithToken(logger),
        'SELECT u.id, CONCAT(ue.email, u.id) AS cursorId FROM users u WHERE u.isArchived = 0',
        [],
        'SELECT u.id FROM users u WHERE u.id IN (/* PAGE_IDS */)',
        { type: PaginationType.CURSOR, cursor: 'b7', cursorField: 'CONCAT(ue.email, u.id)', limit: 2, sortDir: 'ASC' },
        'cursor pagination test',
      );

      expect(query).toHaveBeenNthCalledWith(1, expect.anything(), expect.stringContaining('CONCAT(ue.email, u.id) >= ?'), ['b7', '3'], 'cursor pagination test');
      expect(query).toHaveBeenNthCalledWith(2, expect.anything(), expect.stringContaining('IN (?, ?)'), ['8', '9'], 'cursor pagination test');
      expect(result.items.map((item) => item.id)).toEqual([8, 9]);
      expect(result.nextCursor).toBe('b9');
      expect(result.hasNextPage).toBe(true);
      expect(result.currentOffset).toBeUndefined();
    });
  });

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

  it('constructor should initialize the errors object when null is provided', () => {
    const model = new MySqlModel(
      null,
      getCurrentDate(),
      casual.integer(1, 999),
      undefined,
      undefined,
      null as unknown as Record<string, string>
    );

    expect(model.errors).toEqual({});
  });

  describe('error helpers', () => {
    it('hasErrors returns false when no errors are present and true after addError', () => {
      const model = new MySqlModel(null, getCurrentDate(), casual.integer(1, 999));

      expect(model.hasErrors()).toBe(false);

      model.addError('name', 'Name is required');

      expect(model.hasErrors()).toBe(true);
      expect(model.errors.name).toEqual('Name is required');
    });

    it('errorsToString excludes __typename and empty values', () => {
      const model = new MySqlModel(null, getCurrentDate(), casual.integer(1, 999));
      model.errors = {
        __typename: 'Error',
        name: 'Name is required',
        description: '',
      };

      expect(model.errorsToString()).toEqual('name: Name is required');
    });
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

  describe('getDefaultPaginationOptions', () => {
    it('returns the configured default cursor pagination settings', () => {
      expect(MySqlModel.getDefaultPaginationOptions()).toEqual({
        limit: generalConfig.defaultSearchLimit,
        cursor: null,
      });
    });
  });
});

describe('prepareValue', () => {
  it('returns null for null and undefined values', () => {
    expect(MySqlModel.prepareValue(null, String)).toBeNull();
    expect(MySqlModel.prepareValue(undefined, String)).toBeNull();
  });

  it('returns buffers unchanged', () => {
    const val = Buffer.from('test');
    expect(MySqlModel.prepareValue(val, String)).toBe(val);
  });

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

  it('can handle json, object, and Date values', () => {
    const val = { enabled: true };
    const date = new Date('2026-01-02T03:04:05.000Z');

    expect(MySqlModel.prepareValue(val, 'json')).toEqual('{"enabled":true}');
    expect(MySqlModel.prepareValue(val, 'object')).toEqual('{"enabled":true}');
    expect(MySqlModel.prepareValue(date, String)).toEqual(formatISO9075(date.toISOString()));
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
  let mockQuery: jest.Mock<() => Promise<unknown[]>>;
  let context: MyContext;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockQuery = jest.fn<() => Promise<unknown[]>>();

    // Create a mock datasource with the query function
    context.dataSources.sqlDataSource = {
      query: mockQuery
    } as unknown as MyContext['dataSources']['sqlDataSource'];
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
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, usingTransaction: false, values: ["1"] }, "Testing");
    expect(result).toEqual(['test']);
  });

  it('query can be called without a values array or reference string', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql,);
    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, usingTransaction: false, values: [] }, "undefined caller");
    expect(result).toEqual([]);
  });

  it('query uses the active transaction connection when one is present', async () => {
    const transactionQuery = jest.fn<() => Promise<[unknown[], unknown[]]>>().mockResolvedValueOnce([
      ['inside transaction'],
      [{ name: 'field' }],
    ]);
    context.activeTransaction = {
      connection: {
        query: transactionQuery,
      },
    } as unknown as MyContext['activeTransaction'];

    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql, ['1234'], 'transaction query');

    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith(
      { sql, usingTransaction: true, values: ['1*4'] },
      'transaction query'
    );
    expect(transactionQuery).toHaveBeenCalledTimes(1);
    expect(transactionQuery).toHaveBeenCalledWith(sql, ['1234']);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result).toEqual(['inside transaction']);
  });

  it('query returns an empty array when the active transaction query fails', async () => {
    const transactionQuery = jest.fn().mockImplementation(() => {
      throw new Error('Transaction query failed');
    });
    context.activeTransaction = {
      connection: {
        query: transactionQuery,
      },
    } as unknown as MyContext['activeTransaction'];

    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql, ['9999'], 'transaction failure');

    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith(
      { sql, usingTransaction: true, values: ['9*9'] },
      'transaction failure'
    );
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('query returns an empty array if an error occurs and logs the error', async () => {
    const mockError = new Error('Testing error handler');
    mockQuery.mockImplementation(() => { throw mockError });
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query(context, sql, ['123'], 'testing failure');
    expect(context.logger.debug).toHaveBeenCalledTimes(1);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
    expect(context.logger.debug).toHaveBeenCalledWith({ sql, usingTransaction: false, values: ["123"] }, "testing failure");
    expect(context.logger.error).toHaveBeenCalledWith(mockError, "testing failure, ERROR: Testing error handler");
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

  it('query logs to the console when neither a datasource nor logger is available', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const sql = 'SELECT * FROM tests WHERE field = ?';
    const result = await MySqlModel.query({
      ...context,
      dataSources: null,
      logger: null,
    } as unknown as MyContext, sql, ['123'], 'testing failure');

    expect(logSpy).toHaveBeenCalledWith(
      'testing failure, ERROR: apolloContext and sqlStatement are required. - SELECT * FROM tests WHERE field = ?'
    );
    expect(result).toEqual([]);
    logSpy.mockRestore();
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

  it('returns false and logs the error if the query throws', async () => {
    localQuery.mockRejectedValueOnce(new Error('Lookup failed'));

    const result = await MySqlModel.exists(context, 'tests', 1, 'Testing');

    expect(context.logger.error).toHaveBeenCalledTimes(1);
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

  it('insert defaults createdById and modifiedById from the token when missing', async () => {
    const table = casual.word;
    const obj = new TestImplementation({
      ...options,
      createdById: undefined,
    });
    obj.modifiedById = undefined;
    localQuery.mockResolvedValueOnce([{ insertId: 1 }]);

    await MySqlModel.insert(context, table, obj, 'Testing');

    expect(obj.createdById).toEqual(context.token.id);
    expect(obj.modifiedById).toEqual(context.token.id);
  });

  it('insert defaults createdById and modifiedById from userId when there is no token', async () => {
    const table = casual.word;
    const obj = new TestImplementation({
      ...options,
      createdById: undefined,
    }) as TestImplementation & { userId?: number };
    obj.modifiedById = undefined;
    obj.userId = casual.integer(1, 99);
    context.token = null;
    localQuery.mockResolvedValueOnce([{ insertId: 1 }]);

    await MySqlModel.insert(context, table, obj, 'Testing');

    expect(obj.createdById).toEqual(obj.userId);
    expect(obj.modifiedById).toEqual(obj.userId);
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

  it('update returns null and logs an error when the id is missing', async () => {
    const table = casual.word;
    const obj = new TestImplementation({
      ...options,
      id: undefined,
    });

    const result = await MySqlModel.update(context, table, obj, 'Testing');

    expect(localQuery).not.toHaveBeenCalled();
    expect(context.logger.error).toHaveBeenCalledWith(
      `Testing, ERROR: Cannot update record in ${table} because id is not set.`
    );
    expect(result).toBeNull();
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
