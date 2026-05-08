import { MyContext } from "../context";
import { validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";

// Identifiers defined outside the DMP Tool that help identify a DMP/Plan
export class AlternateIdentifier extends MySqlModel {
  public planId!: number;
  public alternateIdentifier!: string;

  private static tableName = 'alternateIdentifiers';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.alternateIdentifier = options.alternateIdentifier;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');
    if (!validateURL(this.alternateIdentifier)) this.addError('alternateIdentifier', 'Alternate identifier can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<AlternateIdentifier> {
    // First make sure the record doesn't already exist
    const current = await AlternateIdentifier.findByAlternateIdentifier(
      'AlternateIdentifier.create',
      context,
      this.alternateIdentifier,
    );

    // Then make sure it doesn't already exist
    if(await this.isValid()) {
      if (current) {
        const assoc = current.planId == this.planId ? 'this Plan' : 'another Plan';
        this.addError(
          'general',
          `That identifier is already associated with ${assoc}. Consider using a domain namespace to make it unique.`
        );
      } else {
        // Save the record and then fetch it
        const newId = await AlternateIdentifier.insert(context, AlternateIdentifier.tableName, this, 'AlternateIdentifier.create');
        return await AlternateIdentifier.findById('AlternateIdentifier.create', context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new AlternateIdentifier(this);
  }

  // Delete this record
  async delete(context: MyContext): Promise<AlternateIdentifier> {
    if (this.id) {
      const result = await AlternateIdentifier.delete(context, AlternateIdentifier.tableName, this.id, 'AlternateIdentifier.delete');
      if (result) {
        return new AlternateIdentifier(this);
      }
    }
    return null;
  }

  // Return the specified AlternateIdentifier
  static async findById(reference: string, context: MyContext, id: number): Promise<AlternateIdentifier> {
    const sql = `SELECT * FROM ${AlternateIdentifier.tableName} WHERE id = ?`;
    const results = await AlternateIdentifier.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new AlternateIdentifier(results[0]) : null;
  }

  // Return the entry for the specified AlternateIdentifier
  static async findByAlternateIdentifier(reference: string, context: MyContext, alternateIdentifier: string): Promise<AlternateIdentifier> {
    const sql = `SELECT * FROM ${AlternateIdentifier.tableName} WHERE alternateIdentifier = ?`;
    const results = await AlternateIdentifier.query(context, sql, [alternateIdentifier], reference);
    return Array.isArray(results) && results.length > 0 ? new AlternateIdentifier(results[0]) : null;
  }

  // Return the AlternateIdentifiers for a given Plan
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<AlternateIdentifier[]> {
    const sql = `SELECT * FROM ${AlternateIdentifier.tableName} WHERE planId = ?`;
    const results = await AlternateIdentifier.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new AlternateIdentifier(entry)) : [];
  }
}
