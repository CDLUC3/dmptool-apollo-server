// Represents an entry from the projectPlans table
import { generalConfig } from "../config/generalConfig";
import { MyContext } from "../context";
import { getCurrentDate, isNullOrUndefined, randomHex, valueIsEmpty } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { PlanGuidance } from "./Guidance";
import { VersionedTemplate } from "./VersionedTemplate";
import { Project } from "./Project";
import { Tag } from "./Tag";

export const DEFAULT_TEMPORARY_DMP_ID_PREFIX = 'temp-dmpId-';

/**
 * Possible statuses for a plan.
 */
export enum PlanStatus {
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
  COMPLETE = 'COMPLETE',
}

/**
 * Plan visibility options
 */
export enum PlanVisibility {
  ORGANIZATIONAL = 'ORGANIZATIONAL',
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

/**
 * Class that represents a high-level overview of a plan.
 */
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
  public versionedTemplateId: number;

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
    this.versionedTemplateId = options.versionedTemplateId;

    this.dmpId = options.dmpId;
    this.registeredBy = options.registeredBy;
    this.registered = options.registered;
  }

  /**
   * Find high-level details about the plans for a project. This information is
   * meant to supply an overview of the plans.
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param projectId The ID of the project to return plans for
   * @returns An array of PlanSearchResult objects
   */
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

export enum PlanSectionType {
  BASE = 'BASE',
  CUSTOM = 'CUSTOM',
}


/**
 * Class that represents the progress of a plan section.
 * This includes the total number of questions and the percentage of questions
 * answered across all sections of the template.
 */
export class PlanSectionProgress {
  public sectionType: PlanSectionType;
  public versionedSectionId: number | null;  // null for CUSTOM sections
  public customSectionId?: number | null;      // null for BASE sections
  public title: string;
  public displayOrder: number;
  public totalQuestions: number;
  public answeredQuestions: number;
  public tags?: Tag[];

  constructor(options) {
    this.sectionType = options.sectionType ?? PlanSectionType.BASE;
    this.versionedSectionId = options.versionedSectionId ?? null;
    this.customSectionId = options.customSectionId ?? null;
    this.title = options.title;
    this.displayOrder = options.displayOrder;
    this.totalQuestions = options.totalQuestions;
    this.answeredQuestions = options.answeredQuestions;
    this.tags = options.tags ?? [];
  }

  /**
  * Look up the templateCustomizationId for a given versionedTemplateId, if one exists.
  * A template may not have been customized, in which case this returns undefined.
  */
  private static async findTemplateCustomizationId(
    reference: string,
    context: MyContext,
    versionedTemplateId: number,
    affiliationId: string,
  ): Promise<number | undefined> {
    const sql = `
      SELECT templateCustomizationId
      FROM versionedTemplateCustomizations
      WHERE currentVersionedTemplateId = ?
      AND affiliationId = ?
      LIMIT 1
    `;
    const rows = await Plan.query(context, sql, [versionedTemplateId.toString(), affiliationId], reference);
    return Array.isArray(rows) && rows.length > 0
      ? rows[0].templateCustomizationId
      : undefined;
  }

  /**
   * Fetch custom sections for a given templateCustomizationId, including
   * how many custom questions belong to each one.
   */
  private static async fetchCustomSections(
    reference: string,
    context: MyContext,
    templateCustomizationId: number,
  ): Promise<{ id: number; name: string; pinnedSectionType: string; pinnedSectionId: number; totalQuestions: number }[]> {
    const sql = `
    SELECT
      vcs.customSectionId AS id,
      vcs.name,
      vcs.pinnedVersionedSectionType AS pinnedSectionType,
      vcs.pinnedVersionedSectionId AS pinnedSectionId,
      COUNT(vcq.id) AS totalQuestions
    FROM versionedCustomSections vcs
    JOIN versionedTemplateCustomizations vtc ON vtc.id = vcs.versionedTemplateCustomizationId
    LEFT JOIN versionedCustomQuestions vcq
      ON vcq.versionedSectionId = vcs.customSectionId
      AND vcq.versionedSectionType = 'CUSTOM'
      AND vcq.versionedTemplateCustomizationId = vtc.id
    WHERE vtc.templateCustomizationId = ?
    GROUP BY vcs.customSectionId, vcs.name, vcs.pinnedVersionedSectionType, vcs.pinnedVersionedSectionId
  `;
    const rows = await Plan.query(context, sql, [templateCustomizationId.toString()], reference);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * Fetch the count of custom questions added to a BASE section for a given templateCustomizationId.
   * This allows us to adjust the total question count for base sections that have extra custom questions added to them.
   */
  private static async fetchExtraQuestionsForBaseSections(
    reference: string,
    context: MyContext,
    templateCustomizationId: number
  ): Promise<{ versionedSectionId: number; extraCount: number }[]> {
    // sectionId on a BASE custom question points directly to versionedSections.id
    const sql = `
      SELECT
        cq.sectionId AS versionedSectionId,
        COUNT(cq.id) AS extraCount
      FROM customQuestions cq
      JOIN versionedSections vs ON vs.id = cq.sectionId
      WHERE cq.templateCustomizationId = ?
      GROUP BY cq.sectionId
  `;
    const rows = await Plan.query(
      context,
      sql,
      [templateCustomizationId.toString()],
      reference
    );
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * Return the progress information for the plan by section, including any
   * custom sections or custom questions added via a template customization
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param planId The ID of the plan to return progress information for
   * @returns The progress information for the section or an empty array if the section does not exist
   */
  static async findByPlanId(reference: string, context: MyContext, planId: number, versionedTemplateId?: number): Promise<PlanSectionProgress[]> {
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
    const baseSections: PlanSectionProgress[] = Array.isArray(results)
      ? results.map((entry) => {
        if (entry.tags && typeof entry.tags === 'string') {
          try { entry.tags = JSON.parse(entry.tags); } catch { entry.tags = []; }
        }
        return new PlanSectionProgress({ ...entry, sectionType: PlanSectionType.BASE });
      })
      : [];

    // If there are no base sections the plan is in a bad state — return early
    if (!baseSections.length) return baseSections;

    const affiliationId = context.token?.affiliationId;
    if (!affiliationId) return baseSections;

    const templateCustomizationId = await this.findTemplateCustomizationId(
      reference,
      context,
      versionedTemplateId,
      affiliationId
    );

    // No customization exists for this template — return base sections as-is
    if (!templateCustomizationId) return baseSections;

    // Fetch custom sections and extra question counts in parallel
    const [customSectionRows, extraQuestionRows] = await Promise.all([
      this.fetchCustomSections(reference, context, templateCustomizationId),
      this.fetchExtraQuestionsForBaseSections(reference, context, templateCustomizationId),
    ]);

    // Bump totalQuestions on base sections that have extra custom questions
    if (extraQuestionRows.length) {
      const extraBySection = new Map<number, number>(
        extraQuestionRows.map((r) => [r.versionedSectionId, Number(r.extraCount)])
      );
      for (const section of baseSections) {
        const extra = extraBySection.get(section.versionedSectionId) ?? 0;
        if (extra > 0) section.totalQuestions += extra;
      }
    }

    // Build a map: pinnedId → custom sections pinned to it
    const pinnedToMap = new Map<number, typeof customSectionRows>();
    for (const cs of customSectionRows) {
      const existing = pinnedToMap.get(cs.pinnedSectionId) ?? [];
      existing.push(cs);
      pinnedToMap.set(cs.pinnedSectionId, existing);
    }

    // Recursively collect custom sections inserted after a given target id
    function collectAfter(targetId: number, result: typeof customSectionRows, visited = new Set<number>()) {
      if (visited.has(targetId)) return;
      visited.add(targetId);
      const pinned = (pinnedToMap.get(targetId) ?? []).sort((a, b) => a.id - b.id);
      for (const cs of pinned) {
        result.push(cs);
        collectAfter(cs.id, result, visited);
      }
    }

    // Walk base sections in order, inserting custom section chains after each one
    const orderedSections: PlanSectionProgress[] = [];
    let displayOrder = 0;

    for (const base of baseSections) {
      orderedSections.push(new PlanSectionProgress({ ...base, displayOrder: displayOrder++ }));

      const chain: typeof customSectionRows = [];
      collectAfter(base.versionedSectionId, chain);

      for (const cs of chain) {
        orderedSections.push(new PlanSectionProgress({
          sectionType: PlanSectionType.CUSTOM,
          customSectionId: cs.id,
          versionedSectionId: null,
          title: cs.name,
          displayOrder: displayOrder++,
          totalQuestions: Number(cs.totalQuestions),
          answeredQuestions: 0,
          tags: [],
        }));
      }
    }

    return orderedSections;
  }
}

/**
 * Class that represents the overall progress of a plan.
 * This includes the total number of questions and the percentage of questions
 * answered across all sections of the template.
 */
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

  /**
   * Return the overall progress information for a plan
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param planId The ID of the plan to return progress information for
   * @returns The overall progress information for the plan or null if the plan does not exist
   */
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

/**
 * Class that represents a Plan/DMP
 */
export class Plan extends MySqlModel {
  public projectId: number;
  public dmpId: string;
  public versionedTemplateId: number;
  public title: string;
  public status: PlanStatus;
  public visibility: PlanVisibility;
  public languageId: string;
  public featured: boolean;

  // The following fields should only be set when the plan is published!
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

  /**
   * Generate a new DMP ID for the plan.
   *
   * @param context The Apollo context object
   * @returns The new DMP ID
   */
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

    context.logger.error('Unable to generate a unique DMP ID for the plan.');
    return `${DEFAULT_TEMPORARY_DMP_ID_PREFIX}${id}`;
  }

  // Helper function to determine if the plan has been published
  isPublished(): boolean {
    return !isNullOrUndefined(this.registered) || !isNullOrUndefined(this.registeredById);
  }

  /**
   * Check if the plan is valid. If it is not valid, add errors to the object.
   */
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

  /**
   * Prepare the plan for saving.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.title = this.title?.trim();
  }

  /**
   * Process the result of a query to the database.
   *
   * @param context The Apollo context object
   * @param plan The Plan object to process
   * @returns The processed Plan object
   */
  static async processResult(context: MyContext, plan: Plan): Promise<Plan> {
    // Check to see it the plan has a `dmpId`. If not, it was probably recently
    // migrated, so we need to assign a `dmpId` and send a request to generate the
    // maDMP record.
    if (isNullOrUndefined(plan.dmpId)) {
      // Generate a new DMP ID
      plan.dmpId = await plan.generateDMPId(context);
      return await plan.update(context, true);
    }

    return new Plan(plan);
  }

  /**
   * Publish the plan (register its DMP id with EZID/DataCite making it a DOI)
   *
   * @param context The Apollo context object
   * @param visibility The visibility of the plan. Defaults to PRIVATE.
   * @returns The updated Plan or the original Plan if something went wrong
   */
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
          const updated = await this.update(context);
          if (updated && !updated.hasErrors()) {
            return new Plan(updated);
          }
        } else {
          this.addError('general', 'The plan is already registered');
        }
      }
    }
    // Otherwise return as-is with all the errors
    return new Plan(this);
  }

  /**
   * Create a new Plan and its initial maDMP record.
   *
   * @param context The Apollo context object
   * @returns The new Plan or the original Plan if something went wrong
   */
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

      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        // Create the new Plan
        const newId = await Plan.insert(context, Plan.tableName, this, reference);

        // Create the original version snapshot of the DMP
        if (newId) {
          const newPlan = await Plan.findById(reference, context, newId);
          if (newPlan) {
            // Auto-populate planGuidance with default affiliations
            await this.initializePlanGuidance(context, newId, this.versionedTemplateId);

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

  /**
   * Initialize plan guidance with default affiliations (template owner and user affiliation)
   *
   * @param context The Apollo context object
   * @param planId The ID of the newly created plan
   * @param versionedTemplateId The ID of the associated versioned template
   */
  private async initializePlanGuidance(
    context: MyContext,
    planId: number,
    versionedTemplateId: number
  ): Promise<void> {
    const reference = 'Plan.initializePlanGuidance';

    try {
      // Get the user ID from token
      const userId = context.token?.id;
      if (!userId) {
        context.logger.warn({ planId }, 'No userId found in token, skipping planGuidance initialization');
        return;
      }

      // Get template owner URI
      const versionedTemplate = await VersionedTemplate.findById(reference, context, versionedTemplateId);
      const templateOwnerUri = versionedTemplate?.ownerId;

      // Get user's affiliation URI
      const userAffiliationUri = context.token?.affiliationId;

      const affiliationsToAdd = new Set<string>();

      // Add template owner if exists
      if (templateOwnerUri) {
        affiliationsToAdd.add(templateOwnerUri);
      }

      // Add user affiliation if exists (Set automatically handles duplicates)
      if (userAffiliationUri) {
        affiliationsToAdd.add(userAffiliationUri);
      }

      // Create PlanGuidance records for each unique affiliation
      for (const affiliationId of affiliationsToAdd) {
        try {
          const planGuidance = new PlanGuidance({
            planId,
            affiliationId,
            userId
          });
          await planGuidance.create(context);
        } catch (err) {
          // Log but don't fail plan creation if guidance initialization fails
          context.logger.error(
            { err, planId, affiliationId, userId },
            'Failed to create planGuidance record'
          );
        }
      }
    } catch (err) {
      // Log but don't fail plan creation if guidance initialization fails
      context.logger.error({ err, planId }, 'Failed to initialize plan guidance');
    }
  }

  /**
   * Update the Plan and if appropriate, update the maDMP record.
   *
   * @param context The Apollo context object
   * @param noTouch If true, do not update fields like modified timestamp and also
   * skip updating the maDMP record
   * @returns The updated Plan or the original Plan if something went wrong
   */
  async update(context: MyContext, noTouch = false): Promise<Plan> {
    const reference = 'Plan.update';

    if (this.id) {
      if (await this.isValid()) {
        this.prepForSave();

        // Update the plan
        let updated = await Plan.update(context, Plan.tableName, this, reference, [], noTouch) as Plan;
        if (updated) {
          updated = new Plan(updated);
          if (updated && !updated.hasErrors()) {
            return new Plan(updated);
          }
        }
      }
    } else {
      // This plan has never been saved before so we cannot update it!
      this.addError('general', 'Plan has never been saved');
    }
    return new Plan(this);
  }

  /**
   * Delete the Plan and all maDMP versions.
   *
   * @param context The Apollo context object
   * @returns The deleted Plan or null if something went wrong
   */
  async delete(context: MyContext): Promise<Plan | null> {
    const reference = 'Plan.delete';
    if (this.id) {
      const toDelete = await Plan.findById(reference, context, this.id);

      if (toDelete) {
        // Delete the plan
        const successfullyDeleted = await Plan.delete(context, Plan.tableName, this.id, reference);
        if (successfullyDeleted) {
          return toDelete;
        }
      }
    }
    return null;
  }

  /**
   * Fetch the Plan by its id.
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param planId The id of the Plan to fetch
   * @returns The Plan object or null if it does not exist
   */
  static async findById(reference: string, context: MyContext, planId: number): Promise<Plan | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await Plan.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? await Plan.processResult(context, results[0]) : null;
  }

  /**
   * Fetch the Plan by its DMP id.
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param dmpId The DMP id of the Plan to fetch
   * @returns The Plan object or null if it does not exist
   */
  static async findByDMPId(reference: string, context: MyContext, dmpId: string): Promise<Plan | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE dmpId = ?`;
    const results = await Plan.query(context, sql, [dmpId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? await Plan.processResult(context, results[0]) : null;
  }

  /**
   * Fetch the Plans associated with a Project.
   *
   * @param reference The caller's reference string for logging purposes'
   * @param context The Apollo context object
   * @param projectId The id of the Project whose Plans we want to fetch
   * @returns The Plan object or null if it does not exist
   */
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<Plan[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectId = ?`;
    const results = await Plan.query(context, sql, [projectId?.toString()], reference);

    return Array.isArray(results)
      ? await Promise.all(results.map(async (result) =>
        await Plan.processResult(context, result)
      ))
      : [];
  }
}
