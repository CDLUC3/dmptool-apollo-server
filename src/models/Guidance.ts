import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";

export class Guidance extends MySqlModel {
  public guidanceGroupId: number;
  public guidanceText?: string;
  public tagId: number;

  private static tableName = 'guidance';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.guidanceGroupId = options.guidanceGroupId;
    this.guidanceText = options.guidanceText;
    this.tagId = options.tagId;
  }

  // Check that the Guidance data contains the required fields
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.guidanceGroupId) this.addError('guidanceGroupId', 'GuidanceGroup ID can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.guidanceText = this.guidanceText?.trim();
  }

  // Create a new Guidance
  async create(context: MyContext): Promise<Guidance> {
    // First make sure the record is valid
    if (await this.isValid()) {
      this.prepForSave();

      // Save the record and then fetch it
      const newId = await Guidance.insert(context, Guidance.tableName, this, 'Guidance.create');
      const response = await Guidance.findById('Guidance.create', context, newId);
      return response;
    }
    // Otherwise return as-is with all the errors
    return new Guidance(this);
  }

  // Update an existing Guidance
  async update(context: MyContext, noTouch = false): Promise<Guidance> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave();

        await Guidance.update(context, Guidance.tableName, this, 'Guidance.update', [], noTouch);
        return await Guidance.findById('Guidance.update', context, id);
      }
      // This guidance has never been saved before so we cannot update it!
      this.addError('general', 'Guidance has never been saved');
    }
    return new Guidance(this);
  }

  // Delete Guidance based on the Guidance object's id
  async delete(context: MyContext): Promise<Guidance> {
    if (this.id) {
      // First get the guidance to be deleted so we can return this info to the user
      const deletedGuidance = await Guidance.findById('Guidance.delete', context, this.id);

      const successfullyDeleted = await Guidance.delete(context, Guidance.tableName, this.id, 'Guidance.delete');
      if (successfullyDeleted) {
        return deletedGuidance;
      } else {
        return null;
      }
    }
    return null;
  }

  // Find all Guidance items for a specific GuidanceGroup
  static async findByGuidanceGroupId(reference: string, context: MyContext, guidanceGroupId: number): Promise<Guidance[]> {
    const sql = `SELECT * FROM ${Guidance.tableName} WHERE guidanceGroupId = ? ORDER BY id ASC`;
    const results = await Guidance.query(context, sql, [guidanceGroupId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new Guidance(entry)) : [];
  }

  // Find a specific Guidance by id
  static async findById(reference: string, context: MyContext, guidanceId: number): Promise<Guidance> {
    const sql = `SELECT * FROM ${Guidance.tableName} WHERE id = ?`;
    const result = await Guidance.query(context, sql, [guidanceId?.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new Guidance(result[0]) : null;
  }
}


// Represents guidance associated with a plan and user
export class PlanGuidance extends MySqlModel {
  public planId: number;
  public affiliationId: string;
  public userId: number;
  public static tableName = 'planGuidance';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.affiliationId = options.affiliationId;
    this.userId = options.userId;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();
    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');
    if (!this.affiliationId) this.addError('affiliationId', 'Affiliation can\'t be blank');
    if (!this.userId) this.addError('userId', 'User can\'t be blank');
    return Object.keys(this.errors).length === 0;
  }

  //Create a new PlanGuidance
  async create(context: MyContext): Promise<PlanGuidance> {
    const reference = 'PlanGuidance.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await PlanGuidance.findByPlanUserAndAffiliation(
        reference,
        context,
        this.planId,
        this.userId,
        this.affiliationId);

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'PlanGuidance already has an entry for this member');
      } else {
        // Save the record and then fetch it
        const newId = await PlanGuidance.insert(
          context,
          PlanGuidance.tableName,
          this,
          reference,
          [],
        );

        const response = await PlanGuidance.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new PlanGuidance(this);
  }

  //Update an existing plan guidance
  async update(context: MyContext, noTouch = false): Promise<PlanGuidance> {
    if (await this.isValid()) {
      if (this.id) {
        await PlanGuidance.update(
          context,
          PlanGuidance.tableName,
          this,
          'PlanGuidance.update',
          [],
          noTouch
        );
        return await PlanGuidance.findById('PlanGuidance.update', context, this.id);
      }
      // This has never been saved before so we cannot update it!
      this.addError('general', 'PlanGuidance has never been saved');
    }
    return new PlanGuidance(this);
  }

  //Delete PlanGuidance
  async delete(context: MyContext): Promise<PlanGuidance | null> {
    if (this.id) {
      const deleted = await PlanGuidance.findById('PlanGuidance.delete', context, this.id);

      const successfullyDeleted = await PlanGuidance.delete(
        context,
        PlanGuidance.tableName,
        this.id,
        'PlanGuidance.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null;
      }
    }
    return null;
  }

  // Find the plan guidance by its id
  static async findById(
    reference: string,
    context: MyContext,
    id: number
  ): Promise<PlanGuidance | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await PlanGuidance.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanGuidance(results[0]) : null;
  }

  // Fetch a guidance by the Plan and Affiliation
  static async findByPlanAndAffiliation(
    reference: string,
    context: MyContext,
    planId: number,
    affiliationId: string
  ): Promise<PlanGuidance | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND affiliationId = ?`;
    const results = await PlanGuidance.query(context, sql, [planId?.toString(), affiliationId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanGuidance(results[0]) : null;
  }

  // Fetch a guidance by the Plan and User ID
  static async findByPlanAndUserId(
    reference: string,
    context: MyContext,
    planId: number,
    userId: number
  ): Promise<PlanGuidance[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND userId = ?`;
    const results = await PlanGuidance.query(context, sql, [planId?.toString(), userId?.toString()], reference);
    return Array.isArray(results) ? results.map((result) => new PlanGuidance(result)) : [];
  }


  // Find a specific plan guidance by planID, userId and affiliationId
  static async findByPlanUserAndAffiliation(
    reference: string,
    context: MyContext,
    planId: number,
    userId: number,
    affiliationId: string
  ): Promise<PlanGuidance | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND userId = ? AND affiliationId = ?`;
    const results = await PlanGuidance.query(
      context,
      sql,
      [planId?.toString(), userId?.toString(), affiliationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new PlanGuidance(results[0]) : null;
  }
}