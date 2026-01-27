// Represents an entry from the projectPlans table

import { generalConfig } from "../config/generalConfig";
import { MyContext } from "../context";
import {
  getCurrentDate,
  isNullOrUndefined,
  randomHex,
  valueIsEmpty
} from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { addVersion, removeVersions, updateVersion } from "./PlanVersion";
import { Project } from "./Project";
import { Tag } from "./Tag";

export const DEFAULT_TEMPORARY_DMP_ID_PREFIX = 'temp-dmpId-';

export enum PlanStatus {
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
  COMPLETE = 'COMPLETE',
}

export enum PlanVisibility {
  ORGANIZATIONAL = 'ORGANIZATIONAL',
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

// A high level overview of a plan
export class PlanSearchResult {
  public id: number;
  public createdBy: string;
  public created: string;
  public modifiedBy: string;
  public modified: string;
  public title: string;
  public status: PlanStatus;
  public visibility: PlanVisibility;
  public featured: boolean;
  public funding: string;
  public members: string;
  public templateTitle: string;

  // The following fields will only be set when the plan is published!
  public dmpId: string;
  public registeredBy: string;
  public registered: string;

  constructor(options) {
    this.id = options.id;
    this.createdBy = options.createdBy;
    this.created = options.created;
    this.modifiedBy = options.modifiedBy;
    this.modified = options.modified;
    this.title = options.title;
    this.status = options.status ?? PlanStatus.DRAFT;
    this.visibility = options.visibility ?? PlanVisibility.PRIVATE;
    this.featured = options.featured ?? false;
    this.funding = options.funding;
    this.members = options.members;
    this.templateTitle = options.title;

    this.dmpId = options.dmpId;
    this.registeredBy = options.registeredBy;
    this.registered = options.registered;
  }

  // Find all of the high level details about the plans for a project
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<PlanSearchResult[]> {
    const sql = 'SELECT p.id, ' +
                'CONCAT(cu.givenName, CONCAT(\' \', cu.surName)) createdBy, p.created, ' +
                'CONCAT(cm.givenName, CONCAT(\' \', cm.surName)) modifiedBy, p.modified, ' +
                'p.versionedTemplateId, p.title, p.status, p.visibility, p.dmpId, ' +
                'CONCAT(cr.givenName, CONCAT(\' \', cr.surName)) registeredBy, p.registered, p.featured, ' +
                'GROUP_CONCAT(DISTINCT CONCAT(prc.givenName, CONCAT(\' \', prc.surName, ' +
                  'CONCAT(\' (\', CONCAT(r.label, \')\'))))) members, ' +
                'GROUP_CONCAT(DISTINCT fundings.name) funding ' +
              'FROM plans p ' +
                'LEFT JOIN users cu ON cu.id = p.createdById ' +
                'LEFT JOIN users cm ON cm.id = p.modifiedById ' +
                'LEFT JOIN users cr ON cr.id = p.registeredById ' +
                'LEFT JOIN planMembers plc ON plc.planId = p.id ' +
                  'LEFT JOIN projectMembers prc ON prc.id = plc.projectMemberId ' +
                  'LEFT JOIN planMemberRoles plcr ON plc.id = plcr.planMemberId ' +
                    'LEFT JOIN memberRoles r ON plcr.memberRoleId = r.id ' +
                'LEFT JOIN planFundings ON planFundings.planId = p.id ' +
                  'LEFT JOIN projectFundings ON projectFundings.id = planFundings.projectFundingId ' +
                    'LEFT JOIN affiliations fundings ON projectFundings.affiliationId = fundings.uri ' +
              'WHERE p.projectId = ? ' +
              'GROUP BY p.id, cu.givenName, cu.surName, cm.givenName, cm.surName, ' +
                'p.title, p.status, p.visibility, ' +
                'p.dmpId, cr.givenName, cr.surName, p.registered, p.featured ' +
              'ORDER BY p.created DESC;';
    const results = await Plan.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new PlanSearchResult(entry)) : [];
  }
}

// Represents a high level snapshot of the progress that has been made on a section of the plan
export class PlanSectionProgress {
  public versionedSectionId: number;
  public title: string;
  public displayOrder: number;
  public totalQuestions: number;
  public answeredQuestions: number;
  public tags?: Tag[];

  constructor(options) {
    this.versionedSectionId = options.versionedSectionId;
    this.title = options.title;
    this.displayOrder = options.displayOrder;
    this.totalQuestions = options.totalQuestions;
    this.answeredQuestions = options.answeredQuestions;
    this.tags = options.tags ?? [];
  }

  // Return the progress information for sections of the plan
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<PlanSectionProgress[]> {
    const sql = `SELECT
      vs.id AS versionedSectionId,
      vs.displayOrder,
      vs.name AS title,
      COUNT(DISTINCT vq.id) AS totalQuestions,
      COUNT(DISTINCT CASE
          WHEN a.id IS NOT NULL AND NULLIF(TRIM(a.json), '') IS NOT NULL
          THEN vq.id
        END) AS answeredQuestions,
      COALESCE(tagAgg.tags, JSON_ARRAY()) AS tags
    FROM plans p
      JOIN versionedTemplates vt ON p.versionedTemplateId = vt.id
      JOIN versionedSections vs ON vt.id = vs.versionedTemplateId
      LEFT JOIN (
        SELECT
          vst.versionedSectionId,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', t.id,
              'slug', t.slug,
              'name', t.name,
              'description', t.description
            )
          ) AS tags
        FROM versionedSectionTags vst
          JOIN tags t ON t.id = vst.tagId
        GROUP BY vst.versionedSectionId
      ) tagAgg ON tagAgg.versionedSectionId = vs.id
      LEFT JOIN versionedQuestions vq ON vs.id = vq.versionedSectionId
      LEFT JOIN answers a
        ON a.planId = p.id
        AND a.versionedQuestionId = vq.id
    WHERE p.id = ?
    GROUP BY vs.id, vs.displayOrder, vs.name, tagAgg.tags
    ORDER BY vs.displayOrder;
`

    const results = await Plan.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results)
      ? results.map((entry) => {
          if (entry.tags && typeof entry.tags === 'string') {
            try { entry.tags = JSON.parse(entry.tags); } catch { entry.tags = []; }
          }
          return new PlanSectionProgress(entry);
        })
      : [];
  }
}

export class PlanProgress {
  public totalQuestions: number;
  public answeredQuestions: number;
  public percentComplete: number;

  constructor(options) {
    this.totalQuestions = options.totalQuestions;
    this.answeredQuestions = options.answeredQuestions;
    this.percentComplete = this.totalQuestions > 0
      ? Number(((this.answeredQuestions / this.totalQuestions) * 100).toFixed(1))
      : 0;
  }

  // Return the overall progress information for a plan
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<PlanProgress> {
    const sql = `SELECT COUNT(DISTINCT vq.id) AS totalQuestions,
        COUNT(DISTINCT CASE
            WHEN a.id IS NOT NULL AND NULLIF(TRIM(a.json), '') IS NOT NULL
            THEN vq.id
        END) AS answeredQuestions
        FROM plans p
            JOIN versionedTemplates vt ON vt.id = p.versionedTemplateId
            JOIN versionedSections  vs ON vs.versionedTemplateId = vt.id
            JOIN versionedQuestions vq ON vq.versionedSectionId = vs.id
            LEFT JOIN answers a
                ON a.planId = p.id
                AND a.versionedQuestionId = vq.id
        WHERE p.id = ?;
`

    const results = await Plan.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanProgress(results[0]) : null;
  }
}

// A Data management plan
export class Plan extends MySqlModel {
  public projectId: number;
  public versionedTemplateId: number;
  public title: string;
  public status: PlanStatus;
  public visibility: PlanVisibility;
  public languageId: string;
  public featured: boolean;

  // The following fields should only be set when the plan is published!
  public dmpId: string;
  public registeredById: number;
  public registered: string;

  private static tableName = 'plans';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.projectId = options.projectId;
    this.versionedTemplateId = options.versionedTemplateId;

    this.title = options.title;
    this.status = options.status ?? PlanStatus.DRAFT;
    this.visibility = options.visibility ?? PlanVisibility.PRIVATE;
    this.languageId = options.languageId ?? 'en-US';
    this.featured = options.featured ?? false;

    this.dmpId = options.dmpId;
    this.registeredById = options.registeredById;
    this.registered = options.registered;
  }

  // Generate a new DMP ID
  async generateDMPId(context: MyContext): Promise<string> {
    // If the Plan already has a DMP ID, just return it
    if (!valueIsEmpty(this.dmpId)) return this.dmpId;

    const dmpIdPrefix = `${generalConfig.dmpIdBaseURL}${generalConfig.dmpIdShoulder}`;
    let id = randomHex(8);
    let i = 0;

    // Check if the ID already exists up to 5 times
    while (i < 5) {
      const dmpId = `${dmpIdPrefix}${id}`;
      const sql = `SELECT dmpId FROM ${Plan.tableName} WHERE dmpId = ?`;
      const results = await Plan.query(context, sql, [dmpId], 'Plan.generateDMPId');
      if (Array.isArray(results) && results.length <= 0) {
        return dmpId;
      }
      id = randomHex(16);
      i++;
    }
    return `${DEFAULT_TEMPORARY_DMP_ID_PREFIX}${id}`;
  }

  // Helper function to determine if the plan has been published
  isPublished(): boolean {
    return !isNullOrUndefined(this.registered) || !isNullOrUndefined(this.registeredById);
  }

  // Make sure the plan is valid
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.projectId) this.addError('projectId', 'Project can\'t be blank');
    if (!this.versionedTemplateId) this.addError('versionedTemplateId', 'Versioned template can\'t be blank');
    if (valueIsEmpty(this.title)) this.addError('title', 'Title can\'t be blank');
    if (valueIsEmpty(this.dmpId)) {
      this.addError('dmpId', 'A plan must have a DMP ID');
    }
    if (this.isPublished() && valueIsEmpty(this.registered)) {
      this.addError('registered', 'A published plan must have a registration date');
    }
    if (this.isPublished() && valueIsEmpty(this.registeredById)) {
      this.addError('registeredById', 'A published plan must have been registered by a user');
    }

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.title = this.title?.trim();
  }

  // Publish the plan (register a DOI)
  async publish(context: MyContext, visibility = PlanVisibility.PRIVATE): Promise<Plan> {
    if (this.id) {
      // Make sure the plan is valid
      if (await this.isValid()) {
        if (!this.isPublished()) {
          this.registered = getCurrentDate();
          this.registeredById = context.token.id;
          this.visibility = visibility;

          // Update the plan
          return await this.update(context);

          // TODO: Eventually make a asyncronous call to EZID to register the DMP ID (DOI)
        } else {
          this.addError('general', 'The plan is already registered');
        }
      }
    }
    // Otherwise return as-is with all the errors
    return new Plan(this);
  }

  //Create a new Plan
  async create(context: MyContext): Promise<Plan> {
    const reference = 'Plan.create';

    if (!this.id) {
      // Generate a new DMP ID
      this.dmpId = await this.generateDMPId(context);

      // If the title is blank use the title of the associated Project
      if (isNullOrUndefined(this.title)) {
        const project = await Project.findById(reference, context, this.projectId);
        this.title = project?.title;
      }

      // First make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        // Create the new Plan
        const newId = await Plan.insert(context, Plan.tableName, this, reference);

        // Create the original version snapshot of the DMP
        if (newId) {
          const newPlan = await Plan.findById(reference, context, newId);
          if (newPlan) {
            // Generate the version history of the DMP
            await addVersion(context, newPlan, reference);
            return new Plan(newPlan);
          } else {
            this.addError('general', 'Unable to create your plan.');
          }
        }
      }
    }
    // Otherwise return as-is with all the errors
    return new Plan(this);
  }

  //Update an existing Plan
  async update(context: MyContext, noTouch = false): Promise<Plan> {
    const reference = 'Plan.update';

    if (this.id) {
      if (await this.isValid()) {
        this.prepForSave();

        // Update the plan
        let updated = await Plan.update(context, Plan.tableName, this, reference, [], noTouch);
        if (updated) {
          updated = new Plan(updated);
          // Do not update any version info if the plan has not been modified or noTouch is true
          if (!noTouch && updated && !updated.hasErrors()) {
            // Update the version history of the DMP
            updated = await updateVersion(context, this, reference);
            if (updated && !updated.hasErrors()) {
              return new Plan(updated);
            }
          }
        }
      }
    } else {
      // This plan has never been saved before so we cannot update it!
      this.addError('general', 'Plan has never been saved');
    }
    return new Plan(this);
  }

  //Delete the Plan
  async delete(context: MyContext): Promise<Plan | null> {
    const reference = 'Plan.delete';
    if (this.id) {
      const toDelete = await Plan.findById(reference, context, this.id);

      if (toDelete) {
        // Delete the plan
        const successfullyDeleted = await Plan.delete(context, Plan.tableName, this.id, reference);
        if (successfullyDeleted) {
          return await removeVersions(context, this, reference);
        }
      }
    }
    return null;
  }

  // Find the plan by its id
  static async findById(reference: string, context: MyContext, planId: number): Promise<Plan | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await Plan.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Plan(results[0]) : null;
  }

  // Find the plan by its DMP ID
  static async findByDMPId(reference: string, context: MyContext, dmpId: string): Promise<Plan | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE dmpId = ?`;
    const results = await Plan.query(context, sql, [dmpId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Plan(results[0]) : null;
  }

  // Find all of the plans for a project
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<Plan[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectId = ?`;
    const results = await Plan.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) ? results.map((result) => new Plan(result)) : [];
  }
}
