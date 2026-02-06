import { MySqlModel } from "./MySqlModel";
import { VersionedTemplateCustomization } from "./VersionedTemplateCustomization";
import { VersionedTemplate } from "./VersionedTemplate";
import { Template } from "./Template";
import { MyContext } from "../context";

/**
 * The status of the customization.
 *  - DRAFT: The customization has not been published yet and is not available to users.
 *  - PUBLISHED: The customization has been published and is available to users.
 *  - ARCHIVED: The customization has been archived and is no longer available to users.
 */
export enum TemplateStatus {
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
export enum TemplateMigrationStatus {
  OK = 'OK',
  STALE = 'STALE',
  ORPHANED = 'ORPHANED'
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
 * All the queries, as well as the update and delete functions run a check to see
 * if the funder template has changed since the customization was last published.
 * If so, the `migrationStatus` is set to `STALE` and each child object is examined
 * to determine its own unique `migrationStatus`.
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
  public status: TemplateStatus;
  // The status of the customizations with regard to the base template
  public migrationStatus: TemplateMigrationStatus;
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
    this.status = options.status ?? TemplateStatus.DRAFT;
    this.migrationStatus = options.migrationStatus ?? TemplateMigrationStatus.OK;
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

    if (!this.affiliationId) {
      this.addError('affiliationId', 'Affiliation can\'t be blank');
    }
    if (this.templateId === null) {
      this.addError('templateId','Template can\'t be blank');
    }
    if (!this.currentVersionedTemplateId) {
      this.addError(
        'currentVersionedTemplateId',
        'Current template version can\'t be blank'
      );
    }
    if (!this.status) {
      this.addError('status','Status can\'t be blank');
    }
    if (!this.migrationStatus) {
      this.addError('migrationStatus','Migration status can\'t be blank');
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Check the funder template to see if the latest published version differs from
   * the currentVersionedTemplateId. If so, set the migrationStatus to STALE.
   *
   * If the funder template is no longer available, set the migrationStatus to ORPHANED.
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @returns true if the funder template has changed since the customization
   * was created, false otherwise.
   */
  async checkForDrift(
    reference: string,
    context: MyContext,
  ): Promise<boolean> {
    // There is nothing to check if this hasn't been published
    if (!this.latestPublishedVersionId) return false;

    const tmplt: VersionedTemplate = await VersionedTemplate.findActiveByTemplateId(
      reference,
      context,
      this.templateId
    );

    if (!tmplt) {
      // There is no current published version of the funder template
      this.migrationStatus = TemplateMigrationStatus.ORPHANED;
      return true;

    } else if (this.currentVersionedTemplateId !== tmplt.id) {
      // The funder template has changed since the customization was last published
      this.migrationStatus = TemplateMigrationStatus.STALE;
      return true;
    }

    return false;
  }

  /**
   * Process the result from the database
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @returns The Template customization.
   */
  async processResult(reference: string, context: MyContext): Promise<TemplateCustomization> {
    // Check the current status of the funder template to see if it has changed
    // since the customization was last published.
    await this.checkForDrift(reference, context);

    return new TemplateCustomization(this);
  }

  /**
   * Publish the customization
   *
   * @param context The Apollo context.
   * @returns The published Template customization.
   */
  async publish(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.publish';
    if (!this.id) {
      // Cannot publish it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        // Check to make sure the funder template hasn't changed
        if (await this.checkForDrift(ref, context)) {
          this.addError('general', 'Funder template has changed');
        } else {
          // Create a new published version of the customization
          const newVersion = new VersionedTemplateCustomization(
            {
              affiliationId: this.affiliationId,
              templateCustomizationId: this.id,
              versionedTemplateId: this.currentVersionedTemplateId,
              active: true
            }
          )
          const created: VersionedTemplateCustomization = await newVersion.create(context);

          if (created) {
            // Update the status of the customization to reflect the change
            this.status = TemplateStatus.PUBLISHED;
            this.isDirty = false;
            this.latestPublishedVersionId = created.id;
            this.latestPublishedDate = created.created;
            const published: TemplateCustomization = await this.update(context);

            if (!published) {
              this.addError('general', 'Unable to publish');
            }
          }
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

          if (!updatedVer) {
            this.addError('general', 'Unable to unpublish');
          } else {
            // Update the status of the customization to reflect the change
            this.status = TemplateStatus.DRAFT;
            this.isDirty = false;
            this.latestPublishedVersionId = undefined;
            this.latestPublishedDate = undefined;
            const published: TemplateCustomization = await this.update(context);

            if (!published) {
              this.addError('general', 'Unable to publish the customization');
            }
            return published;
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
      if (current) {
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
        if (this.latestPublishedVersionId && noTouch !== true) {
          this.isDirty = true;
        }

        await Template.update(
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

    return await this.processResult(ref, context);
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
      this.addError('general', 'Failed to archive customization');
    }
    return await this.processResult(ref, context);
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
    if (!Array.isArray(results) || results.length === 0) return undefined;

    // Check to see if there's been drift in the funder template since the
    // customization was last published.
    const templateCustomization = new TemplateCustomization(results[0]);
    return await templateCustomization.processResult(reference, context);
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
    if (!Array.isArray(results) || results.length === 0) return undefined;

    // Check to see if there's been drift in the funder template since the
    // customization was last published.
    const templateCustomization = new TemplateCustomization(results[0]);
    return await templateCustomization.processResult(reference, context);
  }
}
