import { prepareObjectForLogs } from "../logger";
import { MyContext } from '../context';
import { isNullOrUndefined, validateDate } from "../utils/helpers";
import { getCurrentDate } from "../utils/helpers";
import { formatISO9075, isDate } from "date-fns";
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType,
  SortDirection
} from "../types/general";
import { generalConfig } from "../config/generalConfig";

type MixedArray<T> = T[];

export class MySqlModel {
  // Initialize with fields common to all MySQL DB tables
  constructor(
    public id?: number,
    public created: string = getCurrentDate(),
    public createdById?: number,
    public modified?: string,
    public modifiedById?: number,
    public errors: Record<string, string> = {},
  ) {
    // If no modifier was designated and this is a new record then use the creator's id
    if (!this.id && !this.modifiedById) {
      this.modifiedById = this.createdById;
    }
    if (!this.modified) {
      this.modified = this.id ? getCurrentDate() : this.created;
    }
    // Only initialize the errors object if it is not already set
    if (!this.errors) {
      this.errors = {};
    }
  };

  // Check to see if the object has errors
  hasErrors(): boolean {
    return this.errors
      && Array.isArray(Object.keys(this.errors))
      && Object.keys(this.errors).length > 0;
  }

  // Add an error to the errors array
  addError(property: string, error: string): void {
    this.errors[property] = error;
  }

  // Indicates whether or not the standard fields on the record are valid
  //   - created and modified should be dates
  //   - createdById and modifiedById should be numbers
  //   - id should be a number or null if its a new record
  async isValid(): Promise<boolean> {
    if (!validateDate(this.created)) this.addError('created', 'Created date can\'t be blank');

    if (!validateDate(this.modified)) this.addError('modified', 'Modified date can\'t be blank');

    if (this.createdById === null) this.addError('createdById', 'Created by can\'t be blank');

    if (this.modifiedById === null) this.addError('modifiedById', 'Modified by can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Check whether or not the value is a Date
  static valueIsDate(val: string): boolean {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }

  /**
   * Convert incoming value to appropriate type for insertion into a SQL query
   * @param val
   * @param type
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static prepareValue(val: any, type: any): any {
    // TODO: See if we need to do any checks here for SQL injection or if the MySQL package
    //       does this already.
    if (val === null || val === undefined) {
      return null;
    }

    if (Buffer.isBuffer(val)) {
      return val;
    }

    switch (type) {
      case 'number':
        return Number(val);
      case 'json':
        return JSON.stringify(val);
      case Object:
      case Array:
        return JSON.stringify(val);
      case 'boolean':
        return Boolean(val);
      default:
        if (isDate(val)) {
          const date = new Date(val).toISOString();
          return formatISO9075(date);

        } else if (Array.isArray(val)) {
          return JSON.stringify(val);

        } else if (type === 'object') {
          return JSON.stringify(val);

        } else {
          return String(val);
        }
    }
  }

  // Fetches all of the property info for the object to faciliate inserts and updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static propertyInfo(obj: Record<string, any>, skipKeys: string[] = []): { name: string, value: string }[] {
    const excludedKeys = ['id', 'errors', 'tableName'];

    return Object.keys(obj)
      .filter((key) => ![...excludedKeys, ...skipKeys]
        .includes(key)).map((key) => ({
          name: key,
          value: obj[key]
        }));
  }

  // Run a query to check for the existence of a record in the database. Typically used to verify that
  // a foreign key relationship exists. (e.g. TemplateCollaborator runs a check to make sure the
  // templateId exists before creating a new record)
  //    - apolloContext:   The Apollo server context
  //    - tableName:       The name of the tabe to query
  //    - id:              The id of the record we are looking for
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  static async exists(
    apolloContext: MyContext,
    tableName: string,
    id: number,
    reference = 'undefined caller'
  ): Promise<boolean> {
    try {
      const sql = `SELECT id FROM ${tableName} WHERE id = ?`;
      const results = await MySqlModel.query(apolloContext, sql, [id.toString()], reference);
      return results && results.length === 1;
    } catch (err) {
      const msg = `${reference}, ERROR: ${err.message}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return false;
    }
  }

  // Get the default pagination options
  static getDefaultPaginationOptions(): PaginationOptionsForCursors {
    return {
      limit: generalConfig.defaultSearchLimit,
      cursor: null,
    } as PaginationOptionsForCursors;
  }

  // Determine the pagination limit base on the provided limit or the default
  //    - limit:           The number of records to return
  static getPaginationLimit(limit: number | undefined): number {
    return Math.min(
      (limit && limit >= 1) ? limit : generalConfig.defaultSearchLimit,
      generalConfig.maximumSearchLimit
    );
  }

  // Run a query to get the total number of records for the given SQL statement and where clause
  //    - apolloContext:   The Apollo server context
  //    - sqlStatement:    The SQL statement to perform e.g. `SELECT * FROM table WHERE id = ?`
  //    - whereClause:     The WHERE clause to append to the SQL statement e.g. `WHERE id = ?`
  //    - countField:      The field to count e.g. `id` or `t.name`
  //    - values:          The values to inject into the SQL statement e.g. `[id.toString()]`
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  static async getTotalCountForPagination(
    apolloContext: MyContext,
    sqlStatement: string,
    whereClause: string,
    groupByClause: string,
    countField: string,
    values: string[],
    reference = 'undefined caller'
  ): Promise<number> {
    try {
      const sqlParts = sqlStatement.split(' FROM ');
      const fromClause = sqlParts[sqlParts.length - 1];

      const countSql = `SELECT COUNT(${countField}) total FROM ${fromClause} ${whereClause} ${groupByClause}`;

      const countResponse = await MySqlModel.query(apolloContext, countSql, values, reference);

      if (groupByClause.trim() && Array.isArray(countResponse)) {
        // When using GROUP BY, count the number of rows returned (each row = one project)
        return countResponse.length;
      } else {
        // No GROUP BY, return the count value
        return Array.isArray(countResponse) && countResponse.length > 0 ? countResponse?.[0]?.total : 0;
      }
    } catch (err) {
      const msg = `${reference}, ERROR: ${err.message}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return 0;
    }
  }

  // Prepare the pagination options for use in a paginated query
  static preparePaginationOptions(options: PaginationOptions): PaginationOptions {
    const sortFields = options?.availableSortFields ?? [];

    // Determine the type of pagination being used
    let opts;
    const paginationOptions = {
      ...options,
      availableSortFields: sortFields,
    } as PaginationOptions;

    // If pagination type is cursor, cast the opts as PaginationOptionsForCursors
    // and add the cursorField.
    if (options.type === PaginationType.OFFSET) {
      return paginationOptions as PaginationOptionsForOffsets;

    } else {
      opts = paginationOptions as PaginationOptionsForCursors;
      const cursorFields = isNullOrUndefined(opts.cursorField) ? ['id'] : [opts.cursorField];

      // If a sort field was provided and its in the list of available sort fields
      if (!isNullOrUndefined(paginationOptions.sortField) && sortFields.includes(paginationOptions.sortField)) {
        cursorFields.unshift(paginationOptions.sortField);
      }

      return {
        ...paginationOptions,
        cursorField: `LOWER(REPLACE(CONCAT(${cursorFields.join(', ')}), ' ', '_'))`
      };
    }
  }

  // Execute a SQL query
  //    - apolloContext:   The Apollo server context
  //    - sqlStatement:    The SQL statement to perform e.g. `SELECT * FROM table WHERE id = ?`
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  //    - values:          The values to inject into the SQL statement e.g. `[id.toString()]`
  static async query(
    apolloContext: MyContext,
    sqlStatement: string,
    values: MixedArray<string | boolean | Buffer> = [],
    reference = 'undefined caller',
  ): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { logger, dataSources } = apolloContext;

    // The dataSource, logger and sqlStatement are required so bail if they are not provided
    if (dataSources && logger && dataSources.sqlDataSource && sqlStatement) {
      const sql = sqlStatement.split(/[\s\t\n]+/).join(' ');
      const vals = values.map((entry) => this.prepareValue(entry, typeof (entry)));

      try {
        // Mask all of the values like 'a***e' before logging
        const maskedValues = vals.map((val) => {
          if (typeof val === 'string' && val.length > 3) {
            const mask = val.slice(1, val.length - 2).replace(/./g, '*');
            return `${val[0]}${mask.slice(0, 10)}${val[val.length - 1]}`;
          }
          return val;
        });
        apolloContext.logger.debug(prepareObjectForLogs({ sql, values: maskedValues }), reference);
        const resp = await dataSources.sqlDataSource.query(apolloContext, sql, vals);
        return Array.isArray(resp) ? resp : [resp];
      } catch (err) {
        const msg = `${reference}, ERROR: ${err.message}`;
        apolloContext.logger.error(prepareObjectForLogs(err), msg);
        return [];
      }
    }
    const errMsg = `${reference}, ERROR: apolloContext and sqlStatement are required.`;
    if (logger) {
      apolloContext.logger.error(`${errMsg} - ${sqlStatement}`);
    } else {
      // In the event that there was no logger!
      console.log(`${errMsg} - ${sqlStatement}`);
    }
    return [];
  }

  // Execute a SQL query and sort and paginate the results
  //    - apolloContext:   The Apollo server context
  //    - sqlStatement:    The SQL statement to perform e.g. `SELECT * FROM table WHERE id = ?`
  //    - whereFilters:    The WHERE clause to append to the SQL statement e.g. `WHERE id = ?`
  //    - values:          The values to inject into the SQL statement e.g. `[id.toString()]`
  //    - options:         The pagination options to use (see PaginationOptionsForOffsets
  //                                                      and PaginationOptionsForCursors)
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  static async queryWithPagination<T>(
    apolloContext: MyContext,
    sqlStatement: string,
    whereFilters: string[],
    groupByClause: string,
    values: string[],
    options: PaginationOptions,
    reference = 'undefined caller',
  ): Promise<PaginatedQueryResults<T>> {
    const paginationOptions = this.preparePaginationOptions(options);
    try {
      // If the options contain a cursorField then this is a cursor-based query
      if (options.type === 'CURSOR') {
        return await this.paginatedQueryByCursor(
          apolloContext,
          sqlStatement,
          whereFilters,
          groupByClause ?? '',
          values,
          paginationOptions,
          reference
        );

      } else {
        // Otherwise this is an offset-based query
        return await this.paginatedQueryByOffset(
          apolloContext,
          sqlStatement,
          whereFilters,
          groupByClause ?? '',
          values,
          paginationOptions,
          reference
        );
      }
    } catch (err) {
      const msg = `${reference}, ERROR: ${err.message}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return {
        limit: generalConfig.defaultSearchLimit,
        totalCount: 0,
        hasNextPage: false,
        items: []
      };
    }
  }

  // Execute a SQL query and return the results in a paginated format using offsets
  //    - apolloContext:   The Apollo server context
  //    - sqlStatement:    The SQL statement to perform e.g. `SELECT * FROM table WHERE id = ?`
  //    - whereFilters:    The WHERE clause to append to the SQL statement e.g. `WHERE id = ?`
  //    - values:          The values to inject into the SQL statement e.g. `[id.toString()]`
  //    - options:         The pagination options to use
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  static async paginatedQueryByOffset<T>(
    apolloContext: MyContext,
    sqlStatement: string,
    whereFilters: string[],
    groupByClause: string,
    values: string[],
    options: PaginationOptionsForOffsets,
    reference = 'undefined caller',
  ): Promise<PaginatedQueryResults<T>> {
    try {
      // Determine the maximum number of results to return
      const limit = this.getPaginationLimit(options.limit);
      // We don't want to attach the limit and offset for the count query
      const vals = [...values];

      // Add the limit and offset
      vals.push(limit.toString(), options?.offset?.toString() ?? '0');

      const whereClause = whereFilters.length ? `WHERE ${whereFilters.join(' AND ')}` : '';
      const orderByClause = `ORDER BY ${options.sortField} ${options.sortDir ?? 'ASC'}`;
      const limitClause = 'LIMIT ? OFFSET ?';
      const sql = `${sqlStatement} ${whereClause} ${groupByClause} ${orderByClause} ${limitClause}`;
      const rows = await MySqlModel.query(apolloContext, sql, vals, reference);

      const items = Array.isArray(rows) ? rows : [];

      const totalCount = await this.getTotalCountForPagination(
        apolloContext,
        sqlStatement,
        whereClause,
        groupByClause,
        options.countField ?? 'id',
        values,
        reference
      );

      const currentOffset = options.offset ?? 0;
      const hasNextPage = items.length === limit && (!totalCount || currentOffset + limit < totalCount);
      const hasPreviousPage = currentOffset > 0;

      return {
        items,
        limit,
        totalCount,
        currentOffset,
        hasNextPage,
        hasPreviousPage,
        availableSortFields: options.availableSortFields ?? [],
      };
    } catch (err) {
      const msg = `${reference}, ERROR: ${err.message}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return {
        limit: generalConfig.defaultSearchLimit,
        currentOffset: null,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: [],
        items: []
      };
    }
  }

  // Execute a SQL query and return the results in a paginated format using cursors
  //    - apolloContext:   The Apollo server context
  //    - sqlStatement:    The SQL statement to perform e.g. `SELECT * FROM table WHERE id = ?`
  //    - whereFilters:    The WHERE clause to append to the SQL statement e.g. `WHERE id = ?`
  //    - orderByClause:   The ORDER BY clause to append to the SQL statement e.g. `ORDER BY id ASC`
  //    - values:          The values to inject into the SQL statement e.g. `[id.toString()]`
  //    - options:         The pagination options to use
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  static async paginatedQueryByCursor<T>(
    apolloContext: MyContext,
    sqlStatement: string,
    whereFilters: string[],
    groupByClause: string,
    values: string[],
    options: PaginationOptionsForCursors,
    reference = 'undefined caller',
  ): Promise<PaginatedQueryResults<T>> {
    try {
      // Determine the maximum number of results to return
      const limit = this.getPaginationLimit(options.limit);

      const filters = [...whereFilters];
      const vals = [...values];

      // Add the cursor to the where clause if one is provided
      const cursorSortDir = options.sortDir ?? SortDirection.ASC;
      if (!isNullOrUndefined(options.cursor)) {
        filters.push(`${options.cursorField} ${cursorSortDir === SortDirection.DESC ? '<=' : '>='} ?`);
        vals.push(options.cursor ?? '');
      }
      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      // Create WHERE clause WITHOUT cursor for total count
      const originalWhereClause = whereFilters.length ? `WHERE ${whereFilters.join(' AND ')}` : '';

      // Add the limit
      const limitClause = 'LIMIT ?';
      const extendedLimit = limit + 1;
      vals.push(extendedLimit.toString());

      const orderByClause = `ORDER BY cursorId ${cursorSortDir.toString()}`;
      let sql = `${sqlStatement.replace('SELECT ', `SELECT ${options.cursorField} cursorId, `)} `
      sql += `${whereClause} ${groupByClause} ${orderByClause} ${limitClause}`;

      const rows = await MySqlModel.query(apolloContext, sql, vals, reference);
      const items = Array.isArray(rows) ? rows : [];

      // Use original WHERE clause and original values for total count
      const totalCount = await this.getTotalCountForPagination(
        apolloContext,
        sqlStatement,
        originalWhereClause,
        groupByClause,
        options.countField ?? 'id',
        values,
        reference
      );

      const nextCursor = items.length > 0 ? items[items.length - 1]?.cursorId : undefined;
      const hasNextPage = nextCursor !== undefined && options.cursor !== nextCursor && items.length > limit;

      return {
        items: items.slice(0, limit), // Return only the first 'limit' items
        limit,
        totalCount,
        nextCursor: hasNextPage ? nextCursor : null,
        hasNextPage,
        availableSortFields: options.availableSortFields ?? [],
      };
    } catch (err) {
      const msg = `${reference}, ERROR: ${err.message}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return {
        limit: generalConfig.defaultSearchLimit,
        nextCursor: null,
        totalCount: 0,
        hasNextPage: false,
        items: []
      };
    }
  }

  // Execute a SQL insert
  //    - apolloContext:   The Apollo server context
  //    - table:           The SQL table name
  //    - obj:             The MysqlModel instance
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  // returns the newly inserted record's id
  static async insert(
    apolloContext: MyContext,
    table: string,
    obj: MySqlModel & { userId?: number },
    reference = 'undefined caller',
    skipKeys?: string[]
  ): Promise<number> {
    // If the createdById and modifiedById have not alredy been set, use the value in the token or the userId
    if (!obj.createdById) {
      obj.createdById = apolloContext?.token?.id ?? obj.userId;
    }
    if (!obj.modifiedById) {
      obj.modifiedById = apolloContext?.token?.id ?? obj.userId;
    }

    // Update the created/modified dates
    const currentDate = getCurrentDate();
    obj.created = currentDate;
    obj.modified = currentDate;

    // Fetch all of the data from the object
    const props = this.propertyInfo(obj, skipKeys);
    const sql = `INSERT INTO ${table} \
                  (${props.map((entry) => entry.name).join(', ')}) \
                 VALUES (${Array(props.length).fill('?').join(', ')})`
    const vals = props.map((entry) => this.prepareValue(entry.value, typeof (entry.value)));

    // Send the calcuated INSERT statement to the query function
    const result = await this.query(apolloContext, sql, vals, reference);
    return Array.isArray(result) ? result[0]?.insertId : null;
  }

  // Execute a SQL update
  //    - apolloContext:   The Apollo server context
  //    - table:           The SQL table name
  //    - obj:             The MysqlModel instance
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  // returns the newly inserted record's id
  static async update(
    apolloContext: MyContext,
    table: string,
    obj: MySqlModel,
    reference = 'undefined caller',
    skipKeys?: string[],
    noTouch?: boolean,
  ): Promise<MySqlModel> {
    // Update the modifier info
    if (noTouch !== true) {
      // Only update the modifiedById if we have a token otherwise leave it as is
      if (apolloContext?.token?.id) {
        obj.modifiedById = apolloContext?.token?.id;
      }
      const currentDate = getCurrentDate();
      obj.modified = currentDate;
    }

    // Fetch all of the data from the object
    let props = this.propertyInfo(obj, skipKeys);
    // We are updating, so remove the created info
    props = props.filter((entry) => { return !['created', 'createdById'].includes(entry.name) });

    props.map((entry) => `${entry.name} = ?`)

    const sql = `UPDATE ${table} \
                 SET ${props.map((entry) => `${entry.name} = ?`).join(', ')} \
                 WHERE id = ?`;

    const vals = props.map((entry) => this.prepareValue(entry.value, typeof (entry.value)));
    // Make sure the record id is the last value
    vals.push(obj.id.toString());

    // Send the calcuated UPDATE statement to the query function
    const result = await this.query(apolloContext, sql, vals, reference);
    return Array.isArray(result) ? result[0] : null;
  }


  // Execute a SQL delete
  //    - apolloContext:   The Apollo server context
  //    - table:           The SQL table name
  //    - id:              The record id
  //    - reference:       A reference to contextualize log messages e.g. `users resolver`
  // returns the newly inserted record's id
  static async delete(
    apolloContext: MyContext,
    table: string,
    id: number,
    reference = 'undefined caller',
  ): Promise<boolean> {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const result = await this.query(apolloContext, sql, [id.toString()], reference);
    return Array.isArray(result) && result[0].affectedRows ? true : false;
  }

  // A helper function that can be used when updating an Object that has a many to many relationship.
  // You pass in an array of the current ids for the relationship and another containing the desired
  // ids for the relationship.
  //     - idsOnCurrentRecord:  The foreign key ids that are in the DB now
  //     - idsOnNewRecord:      The foreign key ids we want
  // Return a list of the ids to delete, idsToBeRemoved,  and a list of ids to add idsToBeSaved
  static reconcileAssociationIds(
    idsOnCurrentRecord: number[],
    idsOnNewRecord?: number[]
  ): { idsToBeRemoved: number[], idsToBeSaved: number[] | undefined } {
    const current = new Set<number>(idsOnCurrentRecord);
    const wanted = new Set<number>(idsOnNewRecord);

    return {
      idsToBeRemoved: idsOnCurrentRecord.filter((id) => !wanted.has(id)),
      idsToBeSaved: idsOnNewRecord ? idsOnNewRecord.filter((id) => !current.has(id)) : []
    }
  }
}
