import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";
import { TemplateCustomizationMigrationStatus } from "./TemplateCustomization";

/**
 * This object represents custom guidance text an organization has added to an
 * existing published template section.
 *
 * The sectionCustomizationService is called in some resolvers to determine if
 * the base funder template has changed. This determines the `migrationStatus`:
 * - When the funder template has NOT been republished.
 *     - "OK": The latest version of the base funder template has not changed.
 * - When the funder template has been republished:
 *     - "OK": The section has not changed in the latest version.
 *     - "STALE" The section has changed in the latest version.
 *     - "ORPHANED" The section is no longer available in the latest version.
 */
export class SectionCustomization extends MySqlModel {
  public templateCustomizationId: number;
  public sectionId: number;
  public migrationStatus: TemplateCustomizationMigrationStatus;
  public guidance?: string;

  static tableName = 'sectionCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.templateCustomizationId = options.templateCustomizationId;
    this.sectionId = options.sectionId;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;
    this.guidance = options.guidance;
  }

  /**
   * Make sure the customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the customization is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateCustomizationId)) {
      this.addError('templateCustomizationId', 'Customization can\'t be blank');
    }
    if (isNullOrUndefined(this.sectionId)) {
      this.addError('sectionId','Section can\'t be blank');
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Ensure data integrity by trimming leading/trailing spaces.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.guidance = this.guidance?.trim();
  }

  /**
   * Save the current record
   *
   * @param context The Apollo context.
   * @returns The newly created Section customization.
   */
  async create(context: MyContext): Promise<SectionCustomization> {
    const ref = 'SectionCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: SectionCustomization = await SectionCustomization.findByCustomizationAndSection(
        ref,
        context,
        this.templateCustomizationId,
        this.sectionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Section has already been customized');
      } else {
        this.prepForSave();
        // Save the record and then fetch it
        const newId: number = await SectionCustomization.insert(
          context,
          SectionCustomization.tableName,
          this,
          ref
        );
        return await SectionCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new SectionCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated Section customization.
   */
  async update(context: MyContext, noTouch = false): Promise<SectionCustomization> {
    const ref = 'SectionCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Section customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await SectionCustomization.update(
          context,
          SectionCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await SectionCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new SectionCustomization(this);
  }

  /**
   * Archive the customization
   *
   * @param context The Apollo context
   * @returns The archived Section customization.
   */
  async delete(context: MyContext): Promise<SectionCustomization> {
    const ref = 'SectionCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Section customization has never been saved');
    } else {
      const original: SectionCustomization = await SectionCustomization.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await SectionCustomization.delete(
        context,
        SectionCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove section customization');
    }
    // Otherwise return as-is with all the errors
    return new SectionCustomization(this);
  }

  /**
   * Find the customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param sectionCustomizationId The section customization id.
   * @returns The Section customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    sectionCustomizationId: number
  ): Promise<SectionCustomization> {
    const results = await SectionCustomization.query(
      context,
      `SELECT * FROM ${SectionCustomization.tableName} WHERE id = ?`,
      [sectionCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new SectionCustomization(results[0]) : undefined;
  }

  /**
   * Find the customization by the customization and funder section
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param sectionId The section id.
   * @returns The Section customization.
   */
  static async findByCustomizationAndSection(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    sectionId: number
  ): Promise<SectionCustomization> {
    const results = await SectionCustomization.query(
      context,
      `SELECT * FROM ${SectionCustomization.tableName}
         WHERE templateCustomizationId = ? AND sectionId = ?`,
      [templateCustomizatonId.toString(), sectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new SectionCustomization(results[0]) : undefined;
  }

  /**
   * Find the customization by the customization and versioned section
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param versionedSectionId The versioned section id.
   * @returns The Section customization.
   */
  static async findByCustomizationAndVersionedSection(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    versionedSectionId: number
  ): Promise<SectionCustomization> {
    const results = await SectionCustomization.query(
      context,
      `SELECT sc.* FROM ${SectionCustomization.tableName} sc
         INNER JOIN versionedSections vs ON sc.sectionId = vs.sectionId
         WHERE sc.templateCustomizationId = ? AND vs.id = ?`,
      [templateCustomizatonId.toString(), versionedSectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new SectionCustomization(results[0]) : undefined;
  }

  /**
   * Find all the section customizations for a specific template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @returns The Section customizations.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number
  ): Promise<SectionCustomization[]> {
    const results = await SectionCustomization.query(
      context,
      `SELECT * FROM ${SectionCustomization.tableName} WHERE templateCustomizationId = ?`,
      [templateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new SectionCustomization(r)) : [];
  }
}
