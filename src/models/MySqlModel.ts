import { prepareObjectForLogs } from "../logger.js";
import { MyContext } from '../context.js';
import { validateDate } from "../utils/helpers.js";
import { getCurrentDate } from "../utils/helpers.js";
import { formatISO9075, isDate } from "date-fns";
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType,
  SortDirection
} from "../types/general.js";
import { generalConfig } from "../config/generalConfig.js";

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

  /**
   * Helper function to concatenate all errors into a single string
   *
   * @returns a concatenated string
   */
  errorsToString(): string {
    const errs = Object.keys(this.errors)
      .filter(k => k !== '__typename' && !!this.errors[k])
      .map(key => `${key}: ${this.errors[key]}`)

    // Cast to a Set to remove any duplicates and then join the array
    return Array.from(new Set([...errs])).join(', ');
  }

  // Indicates whether the standard fields on the record are valid
  //   - created and modified should be dates
  //   - createdById and modifiedById should be numbers
  //   - id should be a number or null if its a new record
  async isValid(): Promise<boolean> {
    if (!validateDate(this.created)) this.addError('created', 'Created date can\'t be blank');

    if (!validateDate(this.modified ?? '')) this.addError('modified', 'Modified date can\'t be blank');

    if (this.createdById === null) this.addError('createdById', 'Created by can\'t be blank');

    if (this.modifiedById === null) this.addError('modifiedById', 'Modified by can\'t be blank');

    return Object.keys(this.errors).length === 0;
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

  // Fetches all of the property info for the object to facilitate inserts and updates
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
      const msg = `${reference}, ERROR: ${err instanceof Error ? err.message : String(err)}`;
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

  /** Return the requested sort expression only when the caller has allowlisted it. */
  static getSafePaginationSortField(options: PaginationOptions, fallback: string): string {
    return options.sortField && options.availableSortFields?.includes(options.sortField)
      ? options.sortField
      : fallback;
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
    const { activeTransaction, dataSources, logger } = apolloContext;

    // The dataSource, logger and sqlStatement are required so bail if they are not provided
    if (dataSources && logger && dataSources.sqlDataSource && sqlStatement) {
      const sql = sqlStatement.split(/[\s\t\n]+/).join(' ');
      const vals = values.map((entry) => this.prepareValue(entry, typeof (entry)));

      try {
        // Mask all the values like 'a***e' before logging
        const maskedValues = vals.map((val) => {
          if (typeof val === 'string' && val.length > 3) {
            const mask = val.slice(1, val.length - 2).replace(/./g, '*');
            return `${val[0]}${mask.slice(0, 10)}${val[val.length - 1]}`;
          }
          return val;
        });
        apolloContext.logger.debug(
          prepareObjectForLogs({ sql, values: maskedValues, usingTransaction: !!activeTransaction }),
          reference
        );

        let resp: unknown;
        if (activeTransaction) {
          // Transaction queries return a [rows, fields] tuple, so normalize it to rows before returning
          const transactionResponse = await activeTransaction.connection.query(sql, vals);
          resp = Array.isArray(transactionResponse) ? transactionResponse[0] : transactionResponse;
        } else {
          resp = await dataSources.sqlDataSource.query(apolloContext, sql, vals);
        }

        return Array.isArray(resp) ? resp : [resp];
      } catch (err) {
        const msg = `${reference}, ERROR: ${err instanceof Error ? err.message : String(err)}`;
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

  /**
   * Paginate a lightweight query first, then hydrate only the selected rows.
   * The lightweight query must select `id` and may select additional sort keys;
   * the hydration query is expected to return the full records for those IDs.
   */
  // The hydration query must include a placeholder for the IDs, e.g. WHERE id IN (/* PAGE_IDS */).
  // Sort expressions must be supplied by trusted application code.
  static async queryWithOptimizedPagination<T>(
    apolloContext: MyContext,
    selectionSql: string,
    selectionValues: MixedArray<string | boolean | Buffer>,
    hydrateSql: string,
    options: PaginationOptions,
    reference = 'undefined caller',
    hydrateValues: MixedArray<string | boolean | Buffer> = [],
  ): Promise<PaginatedQueryResults<T>> {
    // Determine if the caller requested cursor-based pagination or offset-based pagination
    const isCursor = options.type === PaginationType.CURSOR;
    const offsetOptions: PaginationOptionsForOffsets = isCursor
      ? { ...options, type: PaginationType.OFFSET, offset: 0 }
      : options as PaginationOptionsForOffsets;
    const limit = this.getPaginationLimit(offsetOptions.limit);
    const offset = Math.max(0, offsetOptions.offset ?? 0);

    // Determine the sort field and direction, defaulting to the first available sort field or 'id'
    const availableSortFields = offsetOptions.availableSortFields ?? [];
    const requestedSortField = options.sortField;
    const sortField = requestedSortField && (!availableSortFields.length || availableSortFields.includes(requestedSortField))
      ? requestedSortField
      : availableSortFields[0] ?? 'id';
    const sortDir = (options.sortDir ?? SortDirection.ASC).toUpperCase();

    // Cast the options to PaginationOptionsForCursors to access cursor-specific properties
    const cursorOptions = options as PaginationOptionsForCursors;
    const cursorField = cursorOptions.cursorField ?? (isCursor ? 'id' : undefined);
    if (!['ASC', 'DESC'].includes(sortDir)) {
      throw new Error(`Invalid pagination sort direction: ${sortDir}`);
    }

    try {
      // Count matching IDs from the lightweight query, without cursor or page limits.
      const baseSelection = selectionSql.trim().replace(/;$/, '');
      const countRows = await MySqlModel.query(
        apolloContext,
        `SELECT COUNT(*) AS totalCount FROM (${baseSelection}) AS paginationResults`,
        selectionValues,
        reference,
      );
      const totalCount = Number(countRows?.[0]?.totalCount ?? 0);

      // Prepare the page query, including cursor filtering when requested.
      let selection = baseSelection;
      const values = [...selectionValues];
      if (isCursor && cursorOptions.cursor && cursorField) {
        const cursorOperator = sortDir === SortDirection.DESC ? '<=' : '>=';
        selection += ` ${selection.includes('WHERE') ? 'AND' : 'WHERE'} ${cursorField} ${cursorOperator} ?`;
        values.push(cursorOptions.cursor);
      }
      // If the selection SQL does not already include a cursorId alias, add it to the selection
      if (isCursor && cursorField && !/\bAS\s+cursorId\b/i.test(selection)) {
        selection = selection.replace(/^SELECT\s+/i, `SELECT ${cursorField} AS cursorId, `);
        selection = selection.replace(
          /^\s*SELECT(?:\s+(?:DISTINCT|ALL))?\s+/i,
          (match) => `${match}${cursorField} AS cursorId, `
        );
      }
      const orderField = isCursor && cursorField
        ? 'cursorId'
        : /\bAS\s+sortValue\b/i.test(selection)
          ? 'sortValue'
          : sortField;

      // Execute the selection query to get the IDs of the rows to hydrate
      const selectionRows = await MySqlModel.query(
        apolloContext,
        `${selection} ORDER BY ${orderField} ${sortDir}, id ${sortDir} LIMIT ?${isCursor ? '' : ' OFFSET ?'}`,
        [...values, (limit + 1).toString(), ...(isCursor ? [] : [offset.toString()])],
        reference,
      );
      const rows = Array.isArray(selectionRows) ? selectionRows : [];
      const hasNextPage = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const ids = pageRows.map((row) => row.id);

      let items: T[] = [];
      if (ids.length) {
        // Hydrate the selected rows using the provided hydration SQL, which must include a placeholder for the IDs
        const placeholders = ids.map(() => '?').join(', ');
        const hydrated = await MySqlModel.query(
          apolloContext,
          hydrateSql.replace('/* PAGE_IDS */', placeholders),
          [...hydrateValues, ...ids.map((id) => String(id))],
          reference,
        );
        const hydratedById = new Map(hydrated.map((item) => [String(item.id), item]));
        items = ids.map((id) => hydratedById.get(String(id))).filter((item): item is T => !!item);
      }

      return {
        items,
        limit,
        totalCount,
        ...(isCursor ? { nextCursor: hasNextPage ? rows[rows.length - 1]?.cursorId : null } : { currentOffset: offset }),
        hasNextPage,
        ...(!isCursor ? { hasPreviousPage: offset > 0, availableSortFields: offsetOptions.availableSortFields ?? [] } : {}),
      };
    } catch (err) {
      const msg = `${reference}, ERROR: ${err instanceof Error ? err.message : String(err)}`;
      apolloContext.logger.error(prepareObjectForLogs(err), msg);
      return {
        items: [],
        limit,
        totalCount: null,
        ...(isCursor ? { nextCursor: null } : { currentOffset: offset }),
        hasNextPage: false,
        ...(!isCursor ? { hasPreviousPage: offset > 0, availableSortFields: offsetOptions.availableSortFields ?? [] } : {}),
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
  ): Promise<number | null> {
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

    // Fetch all the data from the object
    const props = this.propertyInfo(obj, skipKeys);
    const sql = `INSERT INTO ${table} \
                  (${props.map((entry) => entry.name).join(', ')}) \
                 VALUES (${Array(props.length).fill('?').join(', ')})`
    const vals = props.map((entry) => this.prepareValue(entry.value, typeof (entry.value)));

    // Send the calculated INSERT statement to the query function
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
  ): Promise<MySqlModel | null> {
    // Update the modifier info
    if (noTouch !== true) {
      // Only update the modifiedById if we have a token otherwise leave it as is
      if (apolloContext?.token?.id) {
        obj.modifiedById = apolloContext?.token?.id;
      }
      obj.modified = getCurrentDate();
    }

    // Fetch all the data from the object
    let props = this.propertyInfo(obj, skipKeys);
    // We are updating, so remove the created info
    props = props.filter((entry) => { return !['created', 'createdById'].includes(entry.name) });

    props.map((entry) => `${entry.name} = ?`)

    const sql = `UPDATE ${table} \
                 SET ${props.map((entry) => `${entry.name} = ?`).join(', ')} \
                 WHERE id = ?`;

    const vals = props.map((entry) => this.prepareValue(entry.value, typeof (entry.value)));
    if (!obj.id) {
      const msg = `${reference}, ERROR: Cannot update record in ${table} because id is not set.`;
      apolloContext.logger.error(msg);
      return null;
    }
    // Make sure the record id is the last value
    vals.push(obj.id.toString());

    // Send the calculated UPDATE statement to the query function
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

  // A helper function that can be used when updating an Object that has a many-to-many relationship.
  // You pass in an array of the current ids for the relationship and another containing the desired
  // ids for the relationship.
  //     - idsOnCurrentRecord:  The foreign key ids that are in the DB now
  //     - idsOnNewRecord:      The foreign key ids we want
  // Return a list of the ids to delete, idsToBeRemoved,  and a list of ids to add idsToBeSaved
  static reconcileAssociationIds(
    idsOnCurrentRecord: (number | string)[],
    idsOnNewRecord?: (number | string)[]
  ): { idsToBeRemoved: (number | string)[], idsToBeSaved: (number | string)[] | undefined } {
    const current = new Set<number | string>(idsOnCurrentRecord);
    const wanted = new Set<number | string>(idsOnNewRecord);

    return {
      idsToBeRemoved: idsOnCurrentRecord.filter((id) => !wanted.has(id)),
      idsToBeSaved: idsOnNewRecord ? idsOnNewRecord.filter((id) => !current.has(id)) : []
    }
  }
}
