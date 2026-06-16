import { MyContext } from "../context";
import { validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";

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
  async create(context: MyContext): Promise<AffiliationLink> {
    // First make sure the record doesn't already exist
    const currentDomain = await AffiliationLink.findByAffiliationAndURL(
      'AffiliationLink.create',
      context,
      this.affiliationId,
      this.url,
    );

    // Then make sure it doesn't already exist
    if(await this.isValid()) {
      if (currentDomain) {
        const assoc = currentDomain.affiliationId == this.affiliationId ? 'this Affiliation' : 'another Affiliation';
        this.addError('general', `That email domain is already associated with ${assoc}`);
      } else {
      // Save the record and then fetch it
        const newId = await AffiliationLink.insert(context, AffiliationLink.tableName, this, 'AffiliationLink.create');
        return await AffiliationLink.findById('AffiliationLink.create', context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new AffiliationLink(this);
  }

  // Update the link
  async update(context: MyContext): Promise<AffiliationLink> {
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
        reference
      );

      if (updated) {
        return await AffiliationLink.findById(reference, context, this.id);
      }

      this.addError('general', 'Unable to update the link');
    }

    // Otherwise return it with all of its errors
    return new AffiliationLink(this);
  }

  // Archive this record
  async delete(context: MyContext): Promise<AffiliationLink> {
    if (this.id) {
      const result = await AffiliationLink.delete(context, AffiliationLink.tableName, this.id, 'AffiliationLink.delete');
      if (result) {
        return new AffiliationLink(this);
      }
    }
    return null;
  }

  // Return the specified AffiliationLink
  static async findById(reference: string, context: MyContext, id: number): Promise<AffiliationLink> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE id = ?`;
    const results = await AffiliationLink.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new AffiliationLink(results[0]) : null;
  }

  // Return the specified AffiliationLink
  static async findByAffiliationAndURL(reference: string, context: MyContext, affiliationId: string, url: string): Promise<AffiliationLink> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE affiliationId = ? AND url = ?`;
    const results = await AffiliationLink.query(context, sql, [affiliationId, url], reference);
    return Array.isArray(results) && results.length > 0 ? new AffiliationLink(results[0]) : null;
  }

  // Return all of the AffiliationLinks for the Affiliation
  static async findByAffiliationId(reference: string, context: MyContext, affiliationId: string): Promise<AffiliationLink[]> {
    const sql = `SELECT * FROM ${AffiliationLink.tableName} WHERE affiliationId = ?`;
    const results = await AffiliationLink.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((entry) => new AffiliationLink(entry)) : [];
  }
}
