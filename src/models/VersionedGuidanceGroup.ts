import { MyContext } from "../context.js";
import { MySqlModel } from "./MySqlModel.js";
import { VersionedGuidance } from "./VersionedGuidance.js";

export class VersionedGuidanceGroup extends MySqlModel {
  public guidanceGroupId: number;
  public version?: number;
  public bestPractice: boolean;
  public optionalSubset: boolean;
  public active: boolean;
  public name: string;
  public description?: string;
  public versionedGuidance?: VersionedGuidance[];

  private static tableName = 'versionedGuidanceGroups';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.guidanceGroupId = options.guidanceGroupId;
    this.version = options.version;
    this.bestPractice = options.bestPractice ?? false;
    this.optionalSubset = options.optionalSubset ?? false;
    this.active = options.active ?? false;
    this.name = options.name;
    this.description = options.description;
    this.versionedGuidance = options.versionedGuidance;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.guidanceGroupId) this.addError('guidanceGroupId', 'GuidanceGroup ID can\'t be blank');
    if (!this.name) this.addError('name', 'Name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
  }

  // Insert the new record
  async create(context: MyContext): Promise<VersionedGuidanceGroup> {
    // First make sure the record is valid
    if (await this.isValid()) {
      this.prepForSave();

      // Save the record and then fetch it
      const newId = await VersionedGuidanceGroup.insert(context, VersionedGuidanceGroup.tableName, this, 'VersionedGuidanceGroup.create', ['versionedGuidance']);
      return await VersionedGuidanceGroup.findById('VersionedGuidanceGroup.create', context, newId);
    }
    // Otherwise return as-is with all the errors
    return new VersionedGuidanceGroup(this);
  }

  // Update an existing VersionedGuidanceGroup (mainly for setting active flag)
  async update(context: MyContext, noTouch = false): Promise<VersionedGuidanceGroup> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave();

        await VersionedGuidanceGroup.update(context, VersionedGuidanceGroup.tableName, this, 'VersionedGuidanceGroup.update', ['versionedGuidance'], noTouch);
        return await VersionedGuidanceGroup.findById('VersionedGuidanceGroup.update', context, id);
      }
      this.addError('general', 'VersionedGuidanceGroup has never been saved');
    }
    return new VersionedGuidanceGroup(this);
  }

  // Find the VersionedGuidanceGroup by id
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedGuidanceGroup> {
    const sql = `SELECT * FROM ${VersionedGuidanceGroup.tableName} WHERE id = ?`;
    const results = await VersionedGuidanceGroup.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedGuidanceGroup(results[0]) : null;
  }

  // Find the VersionedGuidanceGroups by guidanceGroupId
  static async findByGuidanceGroupId(reference: string, context: MyContext, guidanceGroupId: number): Promise<VersionedGuidanceGroup[]> {
    const sql = `SELECT * FROM ${VersionedGuidanceGroup.tableName} WHERE guidanceGroupId = ? ORDER BY version DESC`;
    const results = await VersionedGuidanceGroup.query(context, sql, [guidanceGroupId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((entry) => new VersionedGuidanceGroup(entry)) : [];
  }

  // Find the active VersionedGuidanceGroup for a given guidanceGroupId
  static async findActiveByGuidanceGroupId(reference: string, context: MyContext, guidanceGroupId: number): Promise<VersionedGuidanceGroup> {
    const sql = `SELECT * FROM ${VersionedGuidanceGroup.tableName} WHERE guidanceGroupId = ? AND active = 1 LIMIT 1`;
    const results = await VersionedGuidanceGroup.query(context, sql, [guidanceGroupId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedGuidanceGroup(results[0]) : null;
  }

  // Find active best practice VersionedGuidanceGroups
  static async findActiveBestPractice(reference: string, context: MyContext): Promise<VersionedGuidanceGroup[]> {
    const sql = `SELECT * FROM ${VersionedGuidanceGroup.tableName} WHERE bestPractice = 1 AND active = 1 ORDER BY name ASC`;
    const results = await VersionedGuidanceGroup.query(context, sql, [], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedGuidanceGroup(entry)) : [];
  }

  // Find active VersionedGuidanceGroups for a specific affiliation
  static async findActiveByAffiliationId(reference: string, context: MyContext, affiliationId: string): Promise<VersionedGuidanceGroup[]> {
    const sql = `
      SELECT vgg.*
      FROM ${VersionedGuidanceGroup.tableName} vgg
      INNER JOIN guidanceGroups gg ON vgg.guidanceGroupId = gg.id
      WHERE gg.affiliationId = ? AND vgg.active = 1
      ORDER BY vgg.name ASC
    `;
    const results = await VersionedGuidanceGroup.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedGuidanceGroup(entry)) : [];
  }

  // Deactivate all versions for a given guidanceGroupId
  static async deactivateAll(reference: string, context: MyContext, guidanceGroupId: number): Promise<boolean> {
    const sql = `UPDATE ${VersionedGuidanceGroup.tableName} SET active = 0 WHERE guidanceGroupId = ?`;
    const result = await VersionedGuidanceGroup.query(context, sql, [guidanceGroupId?.toString()], reference);
    return result !== null;
  }
}
