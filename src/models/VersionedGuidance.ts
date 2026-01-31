import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";

export class VersionedGuidance extends MySqlModel {
  public versionedGuidanceGroupId: number;
  public guidanceId?: number;
  public guidanceText?: string;
  public tagId: number;

  private static tableName = 'versionedGuidance';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedGuidanceGroupId = options.versionedGuidanceGroupId;
    this.guidanceId = options.guidanceId;
    this.guidanceText = options.guidanceText;
    this.tagId = options.tagId;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.versionedGuidanceGroupId) this.addError('versionedGuidanceGroupId', 'VersionedGuidanceGroup ID can\'t be blank');
    if (!this.tagId) this.addError('tagId', 'Tag ID can\'t be blank');
    if (!this.guidanceText) this.addError('guidanceText', 'Guidance text can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.guidanceText = this.guidanceText?.trim();
  }

  // Insert the new record
  async create(context: MyContext): Promise<VersionedGuidance> {
    // First make sure the record is valid
    if (await this.isValid()) {
      this.prepForSave();

      // Save the record and then fetch it
      const newId = await VersionedGuidance.insert(context, VersionedGuidance.tableName, this, 'VersionedGuidance.create');
      return await VersionedGuidance.findById('VersionedGuidance.create', context, newId);
    }
    // Otherwise return as-is with all the errors
    return new VersionedGuidance(this);
  }

  // Find the VersionedGuidance by id
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedGuidance> {
    const sql = `SELECT * FROM ${VersionedGuidance.tableName} WHERE id = ?`;
    const results = await VersionedGuidance.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedGuidance(results[0]) : null;
  }

  // Find the VersionedGuidance items by guidanceId
  static async findByGuidanceId(reference: string, context: MyContext, guidanceId: number): Promise<VersionedGuidance[]> {
    const sql = `SELECT * FROM ${VersionedGuidance.tableName} WHERE guidanceId = ?`;
    const results = await VersionedGuidance.query(context, sql, [guidanceId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((entry) => new VersionedGuidance(entry)) : [];
  }

  // Find the VersionedGuidance items by versionedGuidanceGroupId
  static async findByVersionedGuidanceGroupId(reference: string, context: MyContext, versionedGuidanceGroupId: number): Promise<VersionedGuidance[]> {
    const sql = `SELECT * FROM ${VersionedGuidance.tableName} WHERE versionedGuidanceGroupId = ? ORDER BY tagId ASC`;
    const results = await VersionedGuidance.query(context, sql, [versionedGuidanceGroupId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((entry) => new VersionedGuidance(entry)) : [];
  }

  // Find best practice VersionedGuidance for specific tags
  static async findBestPracticeByTagIds(reference: string, context: MyContext, tagIds: number[]): Promise<VersionedGuidance[]> {
    if (!tagIds || tagIds.length === 0) {
      return [];
    }

    const placeholders = tagIds.map(() => '?').join(', ');
    const sql = `
      SELECT DISTINCT vg.*
      FROM ${VersionedGuidance.tableName} vg
      INNER JOIN versionedGuidanceGroups vgg ON vg.versionedGuidanceGroupId = vgg.id
      WHERE vg.tagId IN (${placeholders}) AND vgg.bestPractice = 1 AND vgg.active = 1
      ORDER BY vg.id ASC
    `;
    const results = await VersionedGuidance.query(context, sql, tagIds.map(id => id.toString()), reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedGuidance(entry)) : [];
  }

  // Find VersionedGuidance for a specific affiliation and tags
  static async findByAffiliationAndTagIds(
    reference: string,
    context: MyContext,
    affiliationId: string,
    tagIds: number[]
  ): Promise<VersionedGuidance[]> {
    if (!tagIds || tagIds.length === 0) {
      return [];
    }

    const placeholders = tagIds.map(() => '?').join(', ');
    const sql = `
      SELECT DISTINCT vg.*
      FROM ${VersionedGuidance.tableName} vg
      INNER JOIN versionedGuidanceGroups vgg ON vg.versionedGuidanceGroupId = vgg.id
      INNER JOIN guidanceGroups gg ON vgg.guidanceGroupId = gg.id
      WHERE gg.affiliationId = ? AND vg.tagId IN (${placeholders}) AND vgg.active = 1
      ORDER BY vg.id ASC
    `;
    const results = await VersionedGuidance.query(
      context,
      sql,
      [affiliationId, ...tagIds.map(id => id.toString())],
      reference
    );

    return Array.isArray(results) ? results.map((entry) => new VersionedGuidance(entry)) : [];
  }
}
