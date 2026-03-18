import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";

// An email domain associated with this affiliation. For use with SSO
export class AffiliationEmailDomain extends MySqlModel {
  public affiliationId!: string;
  public emailDomain!: string;

  private tableName = 'affiliationEmailDomains';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId
    this.emailDomain = options.emailDomain;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.affiliationId) this.addError('affiliationId', 'Affiliation can\'t be blank');
    if (!this.emailDomain) this.addError('emailDomain', 'Domain can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<AffiliationEmailDomain> {
    // First make sure the record doesn't already exist
    const currentDomain = await AffiliationEmailDomain.findByDomain(
      'AffiliationEmailDomain.create',
      context,
      this.emailDomain,
    );

    if (await this.isValid()) {
      // Then make sure it doesn't already exist
      if (currentDomain) {
        this.addError('general', 'The AffiliationEmailDomain already exists');
      } else {
      // Save the record and then fetch it
        const newId = await AffiliationEmailDomain.insert(context, this.tableName, this, 'AffiliationEmailDomain.create');
        return await AffiliationEmailDomain.findById('AffiliationEmailDomain.create', context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new AffiliationEmailDomain(this);
  }

  // Archive this record
  async delete(context: MyContext): Promise<AffiliationEmailDomain> {
    if (this.id) {
      const result = await AffiliationEmailDomain.delete(context, this.tableName, this.id, 'AffiliationEmailDomain.delete');
      if (result) {
        return new AffiliationEmailDomain(this);
      }
    }
    return null;
  }

  // Return the specified AffiliationEmailDomain
  static async findById(reference: string, context: MyContext, id: number): Promise<AffiliationEmailDomain> {
    const sql = `SELECT * FROM affiliationEmailDomains WHERE id = ?`;
    const results = await AffiliationEmailDomain.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new AffiliationEmailDomain(results[0]) : null;
  }

  // Search by the domain
  static async findByDomain(reference: string, context: MyContext, domain: string): Promise<AffiliationEmailDomain> {
    const sql = `SELECT * FROM affiliationEmailDomains WHERE emailDomain LIKE ?`;
    const results = await AffiliationEmailDomain.query(context, sql, [domain], reference);
    return Array.isArray(results) && results.length > 0 ? new AffiliationEmailDomain(results[0]) : null;
  }

  // Return all of the AffiliationEmailDomains for the Affiliation
  static async findByAffiliationId(reference: string, context: MyContext, affiliationId: string): Promise<AffiliationEmailDomain[]> {
    const sql = `SELECT * FROM affiliationEmailDomains WHERE affiliationId = ?`;
    const results = await AffiliationEmailDomain.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((entry) => new AffiliationEmailDomain(entry)) : [];
  }
}
