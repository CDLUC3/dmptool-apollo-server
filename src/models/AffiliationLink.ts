import { MyContext } from "../context";
import { validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { DatabaseTransactionClient } from "../datasources/mysql";

// A link that can be displayed to the affiliation's users within the context of the DMPTool
export class AffiliationLink extends MySqlModel {
  public affiliationId!: string;
  public url!: string;
  public text: string;

  private static tableName = 'affiliationLinks';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.url = options.url;
    this.text = options.text;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.affiliationId) this.addError('affiliationId', 'Affiliation can\'t be blank');
    if (!validateURL(this.url)) this.addError('url', 'Invalid URL');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink> {
    // First make sure the record doesn't already exist
    const currentDomain = await AffiliationLink.findByAffiliationAndURL(
      'AffiliationLink.create',
      context,
      this.affiliationId,
      this.url,
      transactionClient
    );

    // Then make sure it doesn't already exist
    if(await this.isValid()) {
      if (currentDomain) {
        const assoc = currentDomain.affiliationId == this.affiliationId ? 'this Affiliation' : 'another Affiliation';
        this.addError('general', `That email domain is already associated with ${assoc}`);
      } else {
      // Save the record and then fetch it
        const newId = await AffiliationLink.insert(context, AffiliationLink.tableName, this, 'AffiliationLink.create', [], transactionClient);
        return await AffiliationLink.findById('AffiliationLink.create', context, newId as number, transactionClient);
      }
    }
    // Otherwise return as-is with all the errors
    return new AffiliationLink(this);
  }

  // Update the link
  async update(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink> {
    const reference = 'AffiliationLink.update';
    if (!this.id) {
      this.addError('general', 'The link does not exist');
      return new AffiliationLink(this);
    }

    if (await this.isValid()) {
      const updated = await AffiliationLink.update(
        context,
        AffiliationLink.tableName,
        this,
        reference,
        [],
        false,
        transactionClient
      );

      if (updated) {
        return await AffiliationLink.findById(reference, context, this.id, transactionClient);
      }

      this.addError('general', 'Unable to update the link');
    }

    // Otherwise return it with all of its errors
    return new AffiliationLink(this);
  }

  // Archive this record
  async delete(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink> {
    if (this.id) {
      const result = await AffiliationLink.delete(context, AffiliationLink.tableName, this.id, 'AffiliationLink.delete', transactionClient);
      if (result) {
        return new AffiliationLink(this);
      }
    }
    return null;
  }

  // Return the specified AffiliationLink
  static async findById(reference: string, context: MyContext, id: number, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE id = ?`;
    const results = await AffiliationLink.query(context, sql, [id?.toString()], reference, transactionClient);
    return Array.isArray(results) && results.length > 0 ? new AffiliationLink(results[0]) : null;
  }

  // Return the specified AffiliationLink
  static async findByAffiliationAndURL(reference: string, context: MyContext, affiliationId: string, url: string, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE affiliationId = ? AND url = ?`;
    const results = await AffiliationLink.query(context, sql, [affiliationId, url], reference, transactionClient);
    return Array.isArray(results) && results.length > 0 ? new AffiliationLink(results[0]) : null;
  }

  // Return all of the AffiliationLinks for the Affiliation
  static async findByAffiliationId(reference: string, context: MyContext, affiliationId: string, transactionClient?: DatabaseTransactionClient): Promise<AffiliationLink[]> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE affiliationId = ?`;
    const results = await AffiliationLink.query(context, sql, [affiliationId], reference, transactionClient);
    return Array.isArray(results) ? results.map((entry) => new AffiliationLink(entry)) : [];
  }
}
