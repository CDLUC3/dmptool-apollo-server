import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { DatabaseTransactionClient } from "../datasources/mysql";

export enum ProjectFundingStatus {
  PLANNED = 'PLANNED', // The project has not yet applied for the grant
  GRANTED = 'GRANTED', // The project received the grant funding
  DENIED = 'DENIED', // The project did not receive the grant funding
}

export class ProjectFunding extends MySqlModel {
  public projectId: number;
  public affiliationId: string;
  public status: ProjectFundingStatus;
  public funderProjectNumber?: string;
  public grantId?: string;
  public funderOpportunityNumber?: string;

  private static tableName = 'projectFundings';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.id = options.id;
    this.projectId = options.projectId;
    this.affiliationId = options.affiliationId;
    this.status = options.status ?? ProjectFundingStatus.PLANNED;
    this.funderOpportunityNumber = options.funderOpportunityNumber;
    this.funderProjectNumber = options.funderProjectNumber;
    this.grantId = options.grantId;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.projectId) this.addError('projectId', 'Project can\'t be blank');
    if (!this.affiliationId) this.addError('affiliationId', 'Affiliation can\'t be blank');
    if (!this.status) this.addError('status', 'Funding status can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  //Create a new ProjectFunding
  async create(context: MyContext, projectId: number, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<ProjectFunding> {
    const reference = 'ProjectFunding.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await ProjectFunding.findByProjectAndAffiliation(
        reference,
        context,
        projectId,
        this.affiliationId
      );

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Project already has an entry for this funding');
      } else {
        // Save the record and then fetch it
        const newId = await ProjectFunding.insert(context, ProjectFunding.tableName, this, reference, [], transactionClient);
        const response = await ProjectFunding.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new ProjectFunding(this);
  }

  //Update an existing ProjectFunding
  async update(context: MyContext, noTouch = false, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<ProjectFunding> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        await ProjectFunding.update(context, ProjectFunding.tableName, this, 'ProjectFunding.update', [], noTouch, transactionClient);
        return await ProjectFunding.findById('ProjectFunding.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'ProjectFunding has never been saved');
    }
    return new ProjectFunding(this);
  }

  //Delete the ProjectFunding
  async delete(context: MyContext, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<ProjectFunding> {
    if (this.id) {
      const ref = 'ProjectFunding.delete';
      const deleted = await ProjectFunding.findById(ref, context, this.id);

      const successfullyDeleted = await ProjectFunding.delete(context, ProjectFunding.tableName, this.id, ref, transactionClient);
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Return all of the fundings for the Project
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<ProjectFunding[]> {
    const sql = `SELECT * FROM ${ProjectFunding.tableName} WHERE projectId = ? ORDER BY created DESC`;
    const results = await ProjectFunding.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new ProjectFunding(item)) : [];
  }

  // Return all of the project fundings for the Affiliation
  static async findByAffiliation(reference: string, context: MyContext, affiliationId: string): Promise<ProjectFunding[]> {
    const sql = `SELECT * FROM ${ProjectFunding.tableName} WHERE affiliationId = ? ORDER BY created DESC`;
    const results = await ProjectFunding.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((item) => new ProjectFunding(item)) : [];
  }

  // Return all of the funding for a project and affiliation
  static async findByProjectAndAffiliation(
    reference: string,
    context: MyContext,
    projectId: number,
    affiliationId: string,
  ): Promise<ProjectFunding> {
    const sql = `SELECT * FROM ${ProjectFunding.tableName} WHERE projectId = ? AND affiliationId = ?`;
    const results = await ProjectFunding.query(context, sql, [projectId?.toString(), affiliationId], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectFunding(results[0]) : null;
  }

  // Fetch project fundings by their ids
  static async findByIds(reference: string, context: MyContext, projectFundingIds: number[]): Promise<ProjectFunding[]> {
    if (!projectFundingIds || projectFundingIds.length === 0) return [];
    const placeholders = projectFundingIds.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${ProjectFunding.tableName} WHERE id IN (${placeholders})`;
    const results = await ProjectFunding.query(context, sql, projectFundingIds.map(id => id?.toString()), reference);
    return Array.isArray(results) ? results.map((item) => new ProjectFunding(item)) : [];
  }

// Fetch a project funding by its id
  static async findById(reference: string, context: MyContext, projectFundingId: number): Promise<ProjectFunding> {
    const sql = `SELECT * FROM ${ProjectFunding.tableName} WHERE id = ?`;
    const results = await ProjectFunding.query(context, sql, [projectFundingId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectFunding(results[0]) : null;
  }
}

// A funding for the plan
export class PlanFunding extends MySqlModel {
  public planId: number;
  public projectFundingId: number;

  private static tableName = 'planFundings';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.projectFundingId = options.projectFundingId;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');
    if (!this.projectFundingId) this.addError('projectFundingId', 'ProjectFunding can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  //Create a new PlanFunding
  async create(context: MyContext, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<PlanFunding> {
    const reference = 'PlanFunding.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await PlanFunding.findByPlanAndProjectFundingId(reference, context, this.planId, this.projectFundingId);

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Plan already has an entry for this funding');
      } else {
        // Save the record and then fetch it
        const newId = await PlanFunding.insert(context, PlanFunding.tableName, this, reference, [], transactionClient);
        const response = await PlanFunding.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new PlanFunding(this);
  }

  //Update an existing PlanFunding
  async update(context: MyContext, noTouch = false, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<PlanFunding> {
    if (await this.isValid()) {
      if (this.id) {
        await PlanFunding.update(context, PlanFunding.tableName, this, 'PlanFunding.update', [], noTouch, transactionClient);
        return await PlanFunding.findById('PlanFunding.update', context, this.id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'PlanFunding has never been saved');
    }
    return new PlanFunding(this);
  }

  //Delete the PlanFunding
  async delete(context: MyContext, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<PlanFunding> {
    if (this.id) {
      const ref = 'PlanFunding.delete';
      const deleted = await PlanFunding.findById(ref, context, this.id);

      const successfullyDeleted = await PlanFunding.delete(context, PlanFunding.tableName, this.id, ref, transactionClient);
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Find the project funding by its id
  static async findById(reference: string, context: MyContext, projectFundingId: number): Promise<PlanFunding> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await PlanFunding.query(context, sql, [projectFundingId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanFunding(results[0]) : null;
  }

  // Find the plan funding for the given plan and projectFundingId
  static async findByPlanAndProjectFundingId(
    reference: string,
    context: MyContext,
    planId: number,
    projectFundingId: number
  ): Promise<PlanFunding> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND projectFundingId = ?`;
    const vals = [planId?.toString(), projectFundingId?.toString()];
    const results = await PlanFunding.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new PlanFunding(results[0]) : null;
  }

  // Find all the funding for the plan using the planId
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<PlanFunding[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ?`;
    const results = await PlanFunding.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new PlanFunding(item)) : [];
  }

  // Find all the funding for the given projectFundingId
  static async findByProjectFundingId(reference: string, context: MyContext, projectFundingId: number): Promise<PlanFunding[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectFundingId = ?`;
    const results = await PlanFunding.query(context, sql, [projectFundingId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new PlanFunding(item)) : [];
  }
}
