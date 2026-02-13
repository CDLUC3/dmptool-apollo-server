import { MySqlModel } from "./MySqlModel";
import { VersionedTemplateCustomization } from "./VersionedTemplateCustomization";
import { MyContext } from "../context";
import { isNullOrUndefined } from "../utils/helpers";

/**
 * The status of the customization.
 *  - DRAFT: The customization has not been published yet and is not available to users.
 *  - PUBLISHED: The customization has been published and is available to users.
 *  - ARCHIVED: The customization has been archived and is no longer available to users.
 */
export enum TemplateCustomizationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * The status of the customizations with regard to the base template.
 *  - OK: The funder template has not changed since the customization was created.
 *  - STALE: The funder has published a newer version of the template.
 *  - ORPHANED: The funder template is no longer available.
 */
export enum TemplateCustomizationMigrationStatus {
  OK = 'OK',
  STALE = 'STALE',
  ORPHANED = 'ORPHANED'
}

/**
 * The type of customization.
 *  - CUSTOMIZATION: Customizations to the funder section's guidance or question's
 *    guidance or sample answer.
 *  - ADDENDUM: A completely new section or question added to a funder template.
 */
export enum CustomizationType {
  CUSTOMIZATION = 'CUSTOMIZATION',
  ADDENDUM = 'ADDENDUM',
}

/**
 * Represents a summary of an organizations customizations to a funder
 * template section (guidance)
 */
export interface SectionCustomizationOverview {
  displayOrder: number;
  customizationType: CustomizationType.CUSTOMIZATION;
  migrationStatus: TemplateCustomizationMigrationStatus;
  questions: QuestionCustomizationOverview[] | CustomQuestionOverview[];

  versionedSectionId: number;
  versionedSectionName: string;
  sectionCustomizationId: number;
  hasCustomizedGuidance: boolean;
}

/**
 * Represents a summary of an organizations custom section attached to a
 * funder template
 */
export interface CustomSectionOverview {
  displayOrder: number;
  customizationType: CustomizationType.ADDENDUM;
  migrationStatus: TemplateCustomizationMigrationStatus;
  questions: CustomQuestionOverview

  customSectionId: number;
  customSectionName: string;
}

/**
 * Represents a summary of an organizations customizations to a funder
 * template question (guidance and sample answer)
 */
export interface QuestionCustomizationOverview {
  displayOrder: number;
  customizationType: CustomizationType.CUSTOMIZATION;
  migrationStatus: TemplateCustomizationMigrationStatus;

  versionedQuestionId: number;
  versionedQuestionText: string;
  questionCustomizationId: number;
  hasCustomizedGuidance: boolean;
  hasCustomizedSampleAnswer: boolean;
}

/**
 * Represents a summary of an organizations custom question attached to a
 * funder template
 */
export interface CustomQuestionOverview {
  displayOrder: number;
  customizationType: CustomizationType.ADDENDUM;
  migrationStatus: TemplateCustomizationMigrationStatus;

  customQuestionId: number;
  customQuestionText: string;
}

/**
 * Represents a summary of the funder template customization
 */
class TemplateCustomizationOverview {
  // Information about the funder template
  public versionedTemplateId: number;
  public versionedTemplateAffiliationId: string;
  public versionedTemplateAffiliationName: string;
  public versionedTemplateName: string;
  public versionedTemplateVersion: string;
  public versionedTemplateLastModified: string;

  // Information about the customization
  public customizationId: number;
  public customizationIsDirty: boolean;
  public customizationStatus: TemplateCustomizationStatus;
  public customizationMigrationStatus: TemplateCustomizationMigrationStatus;
  public customizationLastCustomizedById: number;
  public customizationLastCustomizedByName: string;
  public customizationLastCustomized: string;

  public sections: SectionCustomizationOverview[] | CustomSectionOverview[];

  static async findByVersionedTemplateId(
    reference: string,
    context: MyContext,
    versionedTemplateId: number
  ): Promise<TemplateCustomizationOverview> {
    /* TODO: Query to fetch all of the information for a given funder template customization.
     *       The query will need to collate the sections:
     *         - All funder template sections (regardless of whether they have been customized)
     *         - CustomSections added by the organization. CustomSections are pinned to a
     *           section of the base template (null means its the first section). They also
     *           have a displayOrder which allows them to be aligned in a series together
     *       _
     *       The query will need to collate the questions on a per section basis:
     *         - All funder template questions (regardless of whether they have been customized)
     *         - All customizations to those questions
     *         - CustomQuestions added by the organization are pinned to a question
     *           of the base template (null means its the first question). They also
     *           have a displayOrder which allows them to be aligned in a series together
     *       _
     *       Each section will need to include one of the following sets of identifiers:
     *         - the versionedSectionId and sectionCustomizationId
     *         - the customSectionId
     *       _
     *       Each question will need to include one of the following sets of identifiers:
     *         - the versionedQuestionId and questionCustomizationId
     *         - the customQuestionId and either customSectionId or versionedSectionId
     *           depending on which it is attached to.
     */
    const sql = `
      SELECT *
      FROM ${TemplateCustomization.tableName}
        JOIN affiliations ON affiliations.id = affiliationId
      WHERE currentVersionedTemplateId = ?
    `;

    return new TemplateCustomizationOverview();
  }
}

/**
 * An affiliation's customizations to a funder template
 *
 * When an affiliation ADMIN user customizes a funder template, this object is created
 * to track the customization.
 *
 * The customization is initially set to `status: DRAFT` and `migrationStatus: OK`.
 *
 * The ADMIN can then add SectionCustomizations, QuestionCustomizations, CustomSections
 * and CustomQuestions. This object acts as the parent to those objects.
 *
 *   - SectionCustomizations: Custom guidance added directly to a funder
 *     template's Section.
 *   - QuestionCustomizations: Custom guidance and sample answer added directly
 *     to a funder template's Question.
 *   - CustomSections: A new section created by the ADMIN and attached to the
 *     funder template.
 *   - CustomQuestions: A new question created by the ADMIN and attached to
 *     EITHER their own CustomSection or to a funder template's Section.
 *
 * As the ADMIN makes changes to the above child object, this object's `isDirty`
 * is set to true.
 *
 * When the ADMIN publishes the customization. New versioned copies of this object
 * and all child objects are created. Then the following changes are made to this
 * object: `status: PUBLISHED`, `migrationStatus: OK`, `isDirty: false`,
 * `latestPublishedVersionId: <id>`, `latestPublishedDate: <date>`.
 *
 * The templateCustomizationService is called in some resolvers to determine if
 * the base funder template has changed. If so, the `migrationStatus` is set to
 * `STALE` and each child object is examined to determine its own unique
 * `migrationStatus`. If the base funder template has been archived, then the
 * `migrationStatus` is set to `ORPHANED`. If it has not been republished, the
 * `migrationStatus` is set to `OK`.
 *
 * When this object is deleted, all child objects and related versions will also
 * be deleted due to the `ON DELETE CASCADE` constraints in the database.
 */
export class TemplateCustomization extends MySqlModel {
  // Pointer to the affiliation that owns this customization
  public affiliationId: string;
  // Pointer to the base (not versioned) template that this object tracks
  public templateId: number;
  // Pointer to the current published version of the funder template
  public currentVersionedTemplateId: number;
  // The status of the customization
  public status: TemplateCustomizationStatus;
  // The status of the customizations with regard to the base template
  public migrationStatus: TemplateCustomizationMigrationStatus;
  // Pointer to the current published version of this customization
  public latestPublishedVersionId: number;
  // The date this customization was last published
  public latestPublishedDate: string;
  // Whether the customization has been modified since it was last published
  public isDirty: boolean;

  static tableName = 'templateCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.templateId = options.templateId;
    this.currentVersionedTemplateId = options.currentVersionedTemplateId;
    this.status = options.status ?? TemplateCustomizationStatus.DRAFT;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;
    this.latestPublishedVersionId = options.latestPublishedVersionId;
    this.latestPublishedDate = options.latestPublishedDate;
    this.isDirty = options.isDirty ?? false;
  }

  /**
   * Make sure the customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the customization is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.affiliationId)) {
      this.addError('affiliationId', 'Affiliation can\'t be blank');
    }
    if (isNullOrUndefined(this.templateId)) {
      this.addError('templateId','Template can\'t be blank');
    }
    if (isNullOrUndefined(this.currentVersionedTemplateId)) {
      this.addError(
        'currentVersionedTemplateId',
        'Current template version can\'t be blank'
      );
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Publish the customization
   *
   * @param context The Apollo context.
   * @returns The published Template customization.
   */
  async publish(context: MyContext): Promise<TemplateCustomization> {
    if (!this.id) {
      // Cannot publish it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        // Create a new published version of the customization
        const newVersion = new VersionedTemplateCustomization(
          {
            affiliationId: this.affiliationId,
            templateCustomizationId: this.id,
            currentVersionedTemplateId: this.currentVersionedTemplateId,
            active: true
          }
        )

        const created: VersionedTemplateCustomization = await newVersion.create(context);

        if (!isNullOrUndefined(created) && !created.hasErrors() && created.id) {
          // Update the status of the customization to reflect the change
          this.status = TemplateCustomizationStatus.PUBLISHED;
          this.isDirty = false;
          this.latestPublishedVersionId = created.id;
          this.latestPublishedDate = created.created;
          const published: TemplateCustomization = await this.update(context);

          if (!published) {
            this.addError('general', 'Unable to publish');
          }
        } else {
          this.errors = created?.errors ?? this.errors;
        }
      }
    }
    return new TemplateCustomization(this);
  }

  /**
   * Unpublish the customization
   *
   * @param context The Apollo context.
   * @returns The unpublished Template customization.
   */
  async unpublish(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.unpublish';
    if (!this.id) {
      // Cannot unpublish it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        const ver: VersionedTemplateCustomization = await VersionedTemplateCustomization.findById(
          ref,
          context,
          this.latestPublishedVersionId
        );

        if (ver) {
          // Deactivate the published version of the customization
          ver.active = false;
          const updatedVer: VersionedTemplateCustomization = await ver.update(context, false);

          if (isNullOrUndefined(updatedVer)) {
            this.addError('general', 'Unable to unpublish');
          } else {
            // Update the status of the customization to reflect the change
            this.status = TemplateCustomizationStatus.DRAFT;
            this.isDirty = false;
            this.latestPublishedVersionId = undefined;
            this.latestPublishedDate = undefined;
            const published: TemplateCustomization = await this.update(context);

            if (published) {
              return published;
            }

            this.addError('general', 'Unable to unpublish the customization');
          }
        }
      }
    }
    return new TemplateCustomization(this);
  }

  /**
   * Save the current record
   *
   * @param context The Apollo context.
   * @returns The newly created Template customization.
   */
  async create(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: TemplateCustomization = await TemplateCustomization.findByAffiliationAndTemplate(
        ref,
        context,
        this.affiliationId,
        this.templateId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Template has already been customized');
      } else {
        // Save the record and then fetch it
        const newId: number = await TemplateCustomization.insert(
          context,
          TemplateCustomization.tableName,
          this,
          ref
        );
        return await TemplateCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated Template customization.
   */
  async update(context: MyContext, noTouch = false): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        // Set the isDirty flag if the customization is published
        if (this.latestPublishedVersionId && !noTouch) {
          this.isDirty = true;
        }

        await TemplateCustomization.update(
          context,
          TemplateCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await TemplateCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Archive the customization
   *
   * @param context The Apollo context
   * @returns The archived Template customization.
   */
  async delete(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');
    } else {
      const original: TemplateCustomization = await TemplateCustomization.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await TemplateCustomization.delete(
        context,
        TemplateCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove customization');
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Find the customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The template customization id.
   * @returns The Template customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    templateCustomizationId: number
  ): Promise<TemplateCustomization> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName} WHERE id = ?`,
      [templateCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new TemplateCustomization(results[0]) : undefined;
  }

  /**
   * Find the customization by the affiliation and template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param affiliationId The affiliation id.
   * @param templateId The template id.
   * @returns The Template customization.
   */
  static async findByAffiliationAndTemplate(
    reference: string,
    context: MyContext,
    affiliationId: string,
    templateId: number
  ): Promise<TemplateCustomization> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE affiliationId = ? AND templateId = ?`,
      [affiliationId, templateId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new TemplateCustomization(results[0]) : undefined;
  }

  /**
   * Find all the customizations for a given funder template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateId The template id.
   * @returns The Template customizations.
   */
  static async findByTemplateId(
    reference: string,
    context: MyContext,
    templateId: number
  ): Promise<TemplateCustomization[]> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName} WHERE templateId = ?`,
      [templateId?.toString()],
      reference
    )
    return Array.isArray(results) ? results.map(c => new TemplateCustomization(c)) : [];
  }

  /**
   * Find all the customizations for a given published version of a funder template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateId The versioned template id.
   * @returns The Template customizations.
   */
  static async findByVersionedTemplateId(
    reference: string,
    context: MyContext,
    versionedTemplateId: number
  ): Promise<TemplateCustomization[]> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE currentVersionedTemplateId = ?`,
      [versionedTemplateId?.toString()],
      reference
    )
    return Array.isArray(results) ? results.map(c => new TemplateCustomization(c)) : [];
  }
}
