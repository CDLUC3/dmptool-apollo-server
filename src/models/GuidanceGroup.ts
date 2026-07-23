import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { Guidance } from "./Guidance";

export class GuidanceGroup extends MySqlModel {
  public affiliationId: string;
  public name: string;
  public description?: string;
  public isDirty: boolean;
  public bestPractice: boolean;
  public optionalSubset: boolean;
  public latestPublishedVersion?: string;
  public latestPublishedDate?: string;
  public guidance?: Guidance[];

  private static tableName = 'guidanceGroups';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.name = options.name;
    this.description = options.description;
    this.isDirty = options.isDirty ?? false;
    this.bestPractice = options.bestPractice ?? false;
    this.optionalSubset = options.optionalSubset ?? false;
    this.latestPublishedVersion = options.latestPublishedVersion;
    this.latestPublishedDate = options.latestPublishedDate;
    this.guidance = options.guidance;
  }

  // Check that the GuidanceGroup data contains the required fields
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.affiliationId) this.addError('affiliationId', 'Affiliation ID can\'t be blank');
    if (!this.name) this.addError('name', 'Name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
  }

  // Create a new GuidanceGroup
  async create(context: MyContext): Promise<GuidanceGroup> {
    // Check for existing guidance group with same affiliationId + name
    const existing = await GuidanceGroup.findByName('GuidanceGroup.create', context, this.name, this.affiliationId);

    if (existing) {
      this.addError('general', 'A guidance group with this name already exists for this organization');
      return new GuidanceGroup(this);
    }

    // First make sure the record is valid
    if (await this.isValid()) {
      this.prepForSave();

      // Save the record and then fetch it
      const newId = await GuidanceGroup.insert(context, GuidanceGroup.tableName, this, 'GuidanceGroup.create', ['guidance']);
      const response = await GuidanceGroup.findById('GuidanceGroup.create', context, newId);
      return response;
    }
    // Otherwise return as-is with all the errors
    return new GuidanceGroup(this);
  }

  // Update an existing GuidanceGroup
  async update(context: MyContext, noTouch = false): Promise<GuidanceGroup> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave();

        await GuidanceGroup.update(context, GuidanceGroup.tableName, this, 'GuidanceGroup.update', ['guidance'], noTouch);
        return await GuidanceGroup.findById('GuidanceGroup.update', context, id);
      }
      // This guidance group has never been saved before so we cannot update it!
      this.addError('general', 'GuidanceGroup has never been saved');
    }
    return new GuidanceGroup(this);
  }

  // Delete GuidanceGroup based on the GuidanceGroup object's id
  async delete(context: MyContext): Promise<GuidanceGroup> {
    if (this.id) {
      // First get the guidance group to be deleted so we can return this info to the user
      const deletedGuidanceGroup = await GuidanceGroup.findById('GuidanceGroup.delete', context, this.id);

      const successfullyDeleted = await GuidanceGroup.delete(context, GuidanceGroup.tableName, this.id, 'GuidanceGroup.delete');
      if (successfullyDeleted) {
        return deletedGuidanceGroup;
      } else {
        return null;
      }
    }
    return null;
  }

  // Find all GuidanceGroups for the specified affiliationId
  static async findByAffiliationId(reference: string, context: MyContext, affiliationId: string): Promise<GuidanceGroup[]> {
    const sql = `SELECT * FROM ${GuidanceGroup.tableName} WHERE affiliationId = ? ORDER BY name ASC`;
    const results = await GuidanceGroup.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((entry) => new GuidanceGroup(entry)) : [];
  }

  // Find a specific GuidanceGroup by id
  static async findById(reference: string, context: MyContext, guidanceGroupId: number): Promise<GuidanceGroup> {
    const sql = `SELECT * FROM ${GuidanceGroup.tableName} WHERE id = ?`;
    const result = await GuidanceGroup.query(context, sql, [guidanceGroupId?.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new GuidanceGroup(result[0]) : null;
  }

  // Find GuidanceGroup by name and affiliationId
  static async findByName(
    reference: string,
    context: MyContext,
    name: string,
    affiliationId: string
  ): Promise<GuidanceGroup> {
    const sql = `SELECT * FROM ${GuidanceGroup.tableName} WHERE LOWER(name) = ? AND affiliationId = ?`;
    const searchTerm = (name ?? '');
    const vals = [searchTerm?.toLowerCase()?.trim(), affiliationId];
    const results = await GuidanceGroup.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new GuidanceGroup(results[0]) : null;
  }
}
