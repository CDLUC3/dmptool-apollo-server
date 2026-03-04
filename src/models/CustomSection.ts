import { MySqlModel } from "./MySqlModel";
import { TemplateCustomizationMigrationStatus } from "./TemplateCustomization";
import { isNullOrUndefined } from "../utils/helpers";
import { MyContext } from "../context";

/**
 * The type of section the custom section follows (is pinned to)
 *   - NULL: It should be the first section in the funder template.
 *   - BASE: The base funder template section
 *   - CUSTOM: A section added by the organization
 */
export enum PinnedSectionTypeEnum {
  BASE = 'BASE',
  CUSTOM = 'CUSTOM'
}

/**
 * This object represents a custom section that an organization wants to include
 * as part of an existing published template
 *
 * The sectionCustomizationService is called in some resolvers to determine if
 * the base funder template has changed. This determines the `migrationStatus`:
 * - When the funder template has NOT been republished.
 *     - "OK": The latest version of the base funder template has not changed.
 * - When the funder template has been republished:
 *     - "OK": The pinned section still exists in the latest version.
 *     - "STALE" The pinned section has moved position in the latest version.
 *     - "ORPHANED" The pinned section is no longer available in the latest version.
 */
export class CustomSection extends MySqlModel {
  public templateCustomizationId: number;
  public pinnedSectionType?: PinnedSectionTypeEnum;
  public pinnedSectionId?: number;
  public migrationStatus: TemplateCustomizationMigrationStatus;

  public name?: string;
  public introduction?: string;
  public requirements?: string;
  public guidance?: string;

  static tableName = 'customSections';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.templateCustomizationId = options.templateCustomizationId;
    this.pinnedSectionType = options.pinnedSectionType ? PinnedSectionTypeEnum[options.pinnedSectionType] : undefined;
    this.pinnedSectionId = options.pinnedSectionId;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;

    this.name = options.name;
    this.introduction = options.introduction;
    this.requirements = options.requirements;
    this.guidance = options.guidance;
  }

  /**
   * Make sure the custom section is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the custom section is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateCustomizationId)) {
      this.addError('templateCustomizationId', 'Customization can\'t be blank');
    }
    // Only validate the name if the record has already been created
    if (!isNullOrUndefined(this.id) && isNullOrUndefined(this.name)) {
      this.addError('name', 'Name can\'t be blank');
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Ensure data integrity by trimming leading/trailing spaces.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.introduction = this.introduction?.trim();
    this.requirements = this.requirements?.trim();
    this.guidance = this.guidance?.trim();
  }

  /**
   * Save the custom section
   *
   * @param context The Apollo context.
   * @returns The newly created custom section.
   */
  async create(context: MyContext): Promise<CustomSection> {
    const ref = 'CustomSection.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: CustomSection = await CustomSection.findByCustomizationAndPinnedSection(
        ref,
        context,
        this.templateCustomizationId,
        this.pinnedSectionType,
        this.pinnedSectionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Custom section already exists');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await CustomSection.insert(
          context,
          CustomSection.tableName,
          this,
          ref
        );
        return await CustomSection.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new CustomSection(this);
  }

  /**
   * Update the custom section
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated custom section.
   */
  async update(context: MyContext, noTouch = false): Promise<CustomSection> {
    const ref = 'CustomSection.update';

    if (isNullOrUndefined(this.id)) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Custom section has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await CustomSection.update(
          context,
          CustomSection.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await CustomSection.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new CustomSection(this);
  }

  /**
   * Remove the custom section
   *
   * @param context The Apollo context
   * @returns The deleted custom section.
   */
  async delete(context: MyContext): Promise<CustomSection> {
    const ref = 'CustomSection.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Custom section has never been saved');
    } else {
      const original: CustomSection = await CustomSection.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await CustomSection.delete(
        context,
        CustomSection.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove the custom section');
    }
    // Otherwise return as-is with all the errors
    return new CustomSection(this);
  }

  /**
   * Find the custom section by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param customSectionId The custom section id.
   * @returns The custom section.
   */
  static async findById(
    reference: string,
    context: MyContext,
    customSectionId: number
  ): Promise<CustomSection> {
    const results = await CustomSection.query(
      context,
      `SELECT * FROM ${CustomSection.tableName} WHERE id = ?`,
      [customSectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new CustomSection(results[0]) : undefined;
  }

  /**
   * Find the custom section by the customization, pinned section
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param pinnedSectionType The type of pinned section.
   * @param pinnedSectionId The section id.
   * @returns The custom sections.
   */
  static async findByCustomizationAndPinnedSection(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    pinnedSectionType: PinnedSectionTypeEnum,
    pinnedSectionId: number
  ): Promise<CustomSection> {
    const results = await CustomSection.query(
      context,
      `SELECT * FROM ${CustomSection.tableName}
         WHERE templateCustomizationId = ? AND pinnedSectionType = ? AND pinnedSectionId = ?`,
      [templateCustomizatonId.toString(), pinnedSectionType, pinnedSectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new CustomSection(results[0]) : undefined;
  }

  /**
   * Find all the custom sections for a specific template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @returns The custom sections.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number
  ): Promise<CustomSection[]> {
    const results = await CustomSection.query(
      context,
      `SELECT * FROM ${CustomSection.tableName} WHERE templateCustomizationId = ?`,
      [templateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new CustomSection(r)) : [];
  }
}
