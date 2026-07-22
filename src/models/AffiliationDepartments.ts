import { MyContext } from "../context";
import { isNullOrUndefined } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { prepareObjectForLogs } from "../logger";
import { DatabaseTransactionClient } from "../datasources/mysql";

// A department for an affiliation
export class AffiliationDepartment extends MySqlModel {
  public affiliationId!: string;
  public name!: string;
  public abbreviation: string;

  private static tableName = 'affiliationDepartments';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.name = options.name;
    this.abbreviation = options.abbreviation;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.affiliationId)) this.addError('affiliationId', 'Affiliation can\'t be blank');
    if (isNullOrUndefined(this.name)) this.addError('name', 'Name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment> {
    const reference = 'AffiliationDepartment.create';
    // First make sure the record doesn't already exist
    const current = await AffiliationDepartment.findByAffiliationAndName(
      reference,
      context,
      this.affiliationId,
      this.name,
      transactionClient
    );

    // Then make sure it doesn't already exist
    if(await this.isValid()) {
      if (!isNullOrUndefined(current)) {
        this.addError('general', `That school/department is already associated with this Affiliation`);
      } else {
        // Save the record and then fetch it
        const newId = await AffiliationDepartment.insert(
          context,
          AffiliationDepartment.tableName,
          this,
          reference,
          [],
          transactionClient
        );
        return await AffiliationDepartment.findById(reference, context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new AffiliationDepartment(this);
  }

  // Update the record
  async update(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment> {
    const reference = 'AffiliationDepartment.update';
    if (!this.id) {
      this.addError('general', 'The school/department does not exist');
      return new AffiliationDepartment(this);
    }

    if (await this.isValid()) {
      const updated = await AffiliationDepartment.update(
        context,
        AffiliationDepartment.tableName,
        this,
        reference,
        [],
        false,
        transactionClient
      );

      if (updated) {
        return await AffiliationDepartment.findById(reference, context, this.id, transactionClient);
      }

      this.addError('general', 'Unable to update the school/department');
    }

    // Otherwise return this with all of its errors
    return new AffiliationDepartment(this);
  }

  // Archive this record
  async delete(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment> {
    if (this.id) {
      const result = await AffiliationDepartment.delete(
        context,
        AffiliationDepartment.tableName,
        this.id,
        'AffiliationDepartment.delete',
        transactionClient
      );
      if (result) {
        return new AffiliationDepartment(this);
      }
    }
    return null;
  }

  // Add this AffiliationDepartment to a User
  async addToUser(context: MyContext, userId: number, transactionClient?: DatabaseTransactionClient): Promise<boolean> {
    const reference = 'AffiliationDepartment.addToUser';
    let sql = 'INSERT INTO userDepartments (userId, affiliationDepartmentId, ';
    sql += 'createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const currentUserId = context.token?.id?.toString();
    const vals = [userId?.toString(), this.id?.toString(), currentUserId, currentUserId];
    const results = await AffiliationDepartment.query(context, sql, vals, reference, transactionClient);

    if (!results) {
      const payload = { affiliationDepartmentId: this.id, userId };
      const msg = 'Unable to add the affiliationDepartment to the user';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Remove this AffiliationDepartment from a User
  async removeFromUser(context: MyContext, userId: number, transactionClient?: DatabaseTransactionClient): Promise<boolean> {
    const reference = 'AffiliationDepartment.removeFromUser';
    const sql = 'DELETE FROM userDepartments WHERE affiliationDepartmentId = ? AND userId = ?';
    const vals = [this.id?.toString(), userId?.toString()];
    const results = await AffiliationDepartment.query(context, sql, vals, reference, transactionClient);

    if (!results) {
      const payload = { affiliationDepartmentId: this.id, userId };
      const msg = 'Unable to remove the affiliationDepartment from the user';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Return the specified AffiliationDepartment
  static async findById(reference: string, context: MyContext, id: number, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment> {
    const sql = `SELECT * FROM ${AffiliationDepartment.tableName} WHERE id = ?`;
    const results = await AffiliationDepartment.query(context, sql, [id?.toString()], reference, transactionClient);
    return Array.isArray(results) && results.length > 0 ? new AffiliationDepartment(results[0]) : null;
  }

  // Return the specified AffiliationDepartment
  static async findByAffiliationAndName(reference: string, context: MyContext, affiliationId: string, name: string, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment> {
    const sql = `SELECT * FROM ${AffiliationDepartment.tableName} WHERE affiliationId = ? AND LOWER(TRIM(name)) = ?`;
    const results = await AffiliationDepartment.query(context, sql, [affiliationId, name.trim().toLowerCase()], reference, transactionClient);
    return Array.isArray(results) && results.length > 0 ? new AffiliationDepartment(results[0]) : null;
  }

  // Return all AffiliationDepartments for the Affiliaiton
  static async findByAffiliationId(reference: string, context: MyContext, affiliationId: string, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment[]> {
    const sql = `SELECT * FROM ${AffiliationDepartment.tableName} WHERE affiliationId = ?`;
    const results = await AffiliationDepartment.query(context, sql, [affiliationId], reference, transactionClient);
    return Array.isArray(results) ? results.map((entry) => new AffiliationDepartment(entry)) : [];
  }

  // Return all AffiliationDepartments for the User
  static async findByUserId(reference: string, context: MyContext, userId: string, transactionClient?: DatabaseTransactionClient): Promise<AffiliationDepartment[]> {
    const sql = `SELECT ad.* FROM userDepartments ud JOIN ${AffiliationDepartment.tableName} ad ON ud.affiliationDepartmentId = ad.id  WHERE ud.userId = ?`;
    const results = await AffiliationDepartment.query(context, sql, [userId.toString()], reference, transactionClient);
    return Array.isArray(results) ? results.map((entry) => new AffiliationDepartment(entry)) : [];
  }
}
