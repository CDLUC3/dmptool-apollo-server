import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";

/**
 * This object represents a versioned snapshot of custom guidance text an
 * organization has added to an existing published template section.
 */
export class VersionedSectionCustomization extends MySqlModel {
  public versionedTemplateCustomizationId: number;
  public sectionCustomizationId: number;
  public versionedSectionId: number;
  public guidance?: string;

  static tableName = 'versionedSectionCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.versionedTemplateCustomizationId = options.versionedTemplateCustomizationId;
    this.sectionCustomizationId = options.sectionCustomizationId;
    this.versionedSectionId = options.versionedSectionId;
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

    if (isNullOrUndefined(this.versionedTemplateCustomizationId)) {
      this.addError(
        'versionedTemplateCustomizationId',
        'Versioned customization can\'t be blank'
      );
    }
    if (isNullOrUndefined(this.sectionCustomizationId)) {
      this.addError('sectionCustomizationId','Section customization can\'t be blank');
    }
    if (isNullOrUndefined(this.versionedSectionId)) {
      this.addError('versionedSectionId','Versioned section can\'t be blank');
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
   * @returns The newly created versioned section customization.
   */
  async create(context: MyContext): Promise<VersionedSectionCustomization> {
    const ref = 'VersionedSectionCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: VersionedSectionCustomization =
        await VersionedSectionCustomization.findByVersionedCustomizationAndVersionedSection(
          ref,
          context,
          this.versionedTemplateCustomizationId,
          this.versionedSectionId
        );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Versioned section has already been customized');
      } else {
        this.prepForSave();
        // Save the record and then fetch it
        const newId: number = await VersionedSectionCustomization.insert(
          context,
          VersionedSectionCustomization.tableName,
          this,
          ref
        );
        return await VersionedSectionCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedSectionCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated versioned section customization.
   */
  async update(context: MyContext, noTouch = false): Promise<VersionedSectionCustomization> {
    const ref = 'VersionedSectionCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Versioned customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await VersionedSectionCustomization.update(
          context,
          VersionedSectionCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await VersionedSectionCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedSectionCustomization(this);
  }

  /**
   * Delete the customization
   *
   * @param context The Apollo context
   * @returns The archived Section customization.
   */
  async delete(context: MyContext): Promise<VersionedSectionCustomization> {
    const ref = 'VersionedSectionCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Versioned customization has never been saved');
    } else {
      const original: VersionedSectionCustomization = await VersionedSectionCustomization.findById(
        ref,
        context,
        this.id
      );

      const result: boolean = await VersionedSectionCustomization.delete(
        context,
        VersionedSectionCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove the versioned section customization');
    }
    // Otherwise return as-is with all the errors
    return new VersionedSectionCustomization(this);
  }

  /**
   * Find the versioned section customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedSectionCustomizationId The versioned section customization id.
   * @returns The versioned section customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    versionedSectionCustomizationId: number
  ): Promise<VersionedSectionCustomization> {
    const results = await VersionedSectionCustomization.query(
      context,
      `SELECT * FROM ${VersionedSectionCustomization.tableName} WHERE id = ?`,
      [versionedSectionCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedSectionCustomization(results[0]) : undefined;
  }

  /**
   * Find the customization by the versioned customization and versioned funder section
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the versioned template customization.
   * @param versionedSectionId The versioned funder section id.
   * @returns The versioned section customization.
   */
  static async findByVersionedCustomizationAndVersionedSection(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number,
    versionedSectionId: number
  ): Promise<VersionedSectionCustomization> {
    const results = await VersionedSectionCustomization.query(
      context,
      `SELECT * FROM ${VersionedSectionCustomization.tableName}
         WHERE versionedTemplateCustomizationId = ? AND versionedSectionId = ?`,
      [versionedTemplateCustomizatonId.toString(), versionedSectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedSectionCustomization(results[0]) : undefined;
  }

  /**
   * Find all the versioned section customizations for a specific versioned customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the versioned customization.
   * @returns The versioned section customizations.
   */
  static async findByVersionedCustomizationId(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number
  ): Promise<VersionedSectionCustomization[]> {
    const results = await VersionedSectionCustomization.query(
      context,
      `SELECT * FROM ${VersionedSectionCustomization.tableName}
         WHERE versionedTemplateCustomizationId = ?`,
      [versionedTemplateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new VersionedSectionCustomization(r)) : [];
  }


  /**
 * Find the active versioned section customization for a given affiliation and section.
 * Used to surface customization guidance in the plan guidance panel.
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param affiliationId The affiliation id.
 * @param versionedSectionId The versioned section id.
 * @returns The active versioned section customization, or undefined if none exists.
 */
  static async findActiveByTemplateAffiliationAndSection(
    reference: string,
    context: MyContext,
    affiliationId: string,
    versionedSectionId: number
  ): Promise<VersionedSectionCustomization | undefined> {
    const results = await VersionedSectionCustomization.query(
      context,
      `SELECT vsc.* FROM ${VersionedSectionCustomization.tableName} AS vsc
     JOIN versionedTemplateCustomizations AS vtc
       ON vsc.versionedTemplateCustomizationId = vtc.id
     WHERE vtc.active = 1
       AND vtc.affiliationId = ?
       AND vsc.versionedSectionId = ?
     LIMIT 1`,
      [affiliationId, versionedSectionId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0
      ? new VersionedSectionCustomization(results[0])
      : undefined;
  }
}
