import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";
import { MyContext } from "../context";
import { PinnedSectionTypeEnum } from "./CustomSection";

/**
 * This object represents a versioned snapshot of a custom section that an
 * organization wants to include as part of an existing published template
 */
export class VersionedCustomSection extends MySqlModel {
  public versionedTemplateCustomizationId: number;
  public customSectionId: number;
  public pinnedVersionedSectionType?: PinnedSectionTypeEnum;
  public pinnedVersionedSectionId?: number;

  public name: string;
  public introduction?: string;
  public requirements?: string;
  public guidance?: string;

  static tableName = 'versionedCustomSections';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.versionedTemplateCustomizationId = options.versionedTemplateCustomizationId;
    this.customSectionId = options.customSectionId;
    this.pinnedVersionedSectionType = options.pinnedVersionedSectionType ? PinnedSectionTypeEnum[options.pinnedVersionedSectionType] : undefined;
    this.pinnedVersionedSectionId = options.pinnedVersionedSectionId;

    this.name = options.name;
    this.introduction = options.introduction;
    this.requirements = options.requirements;
    this.guidance = options.guidance;
  }

  /**
   * Make sure the custom section version is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the custom section version is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.versionedTemplateCustomizationId)) {
      this.addError('versionedTemplateCustomizationId', 'Versioned customization can\'t be blank');
    }
    if (isNullOrUndefined(this.customSectionId)) {
      this.addError('customSectionId', 'Section customization can\'t be blank');
    }
    if (isNullOrUndefined(this.name)) {
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
   * Save the custom section version
   *
   * @param context The Apollo context.
   * @returns The newly created custom section version.
   */
  async create(context: MyContext): Promise<VersionedCustomSection> {
    const ref = 'VersionedCustomSection.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: VersionedCustomSection = await VersionedCustomSection.findByCustomizationAndPinnedSection(
        ref,
        context,
        this.versionedTemplateCustomizationId,
        this.customSectionId,
        this.pinnedVersionedSectionType,
        this.pinnedVersionedSectionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Custom section version already exists');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await VersionedCustomSection.insert(
          context,
          VersionedCustomSection.tableName,
          this,
          ref
        );
        return await VersionedCustomSection.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedCustomSection(this);
  }

  /**
   * Update the custom section version
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated custom section version.
   */
  async update(context: MyContext, noTouch = false): Promise<VersionedCustomSection> {
    const ref = 'VersionedCustomSection.update';

    if (isNullOrUndefined(this.id)) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Custom section version has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await VersionedCustomSection.update(
          context,
          VersionedCustomSection.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await VersionedCustomSection.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedCustomSection(this);
  }

  /**
   * Remove the custom section version
   *
   * @param context The Apollo context
   * @returns The deleted custom section version.
   */
  async delete(context: MyContext): Promise<VersionedCustomSection> {
    const ref = 'VersionedCustomSection.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Custom section has never been saved');
    } else {
      const original: VersionedCustomSection = await VersionedCustomSection.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await VersionedCustomSection.delete(
        context,
        VersionedCustomSection.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove the custom section version');
    }
    // Otherwise return as-is with all the errors
    return new VersionedCustomSection(this);
  }

  /**
   * Find the custom section version by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedCustomSectionId The custom section version id.
   * @returns The custom section version.
   */
  static async findById(
    reference: string,
    context: MyContext,
    versionedCustomSectionId: number
  ): Promise<VersionedCustomSection> {
    const results = await VersionedCustomSection.query(
      context,
      `SELECT * FROM ${VersionedCustomSection.tableName} WHERE id = ?`,
      [versionedCustomSectionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedCustomSection(results[0]) : undefined;
  }

  /**
   * Find the custom section version by the customization, pinned section
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the template customization version.
   * @param customSectionId The custom section id.
   * @param pinnedVersionedSectionType The type of pinned section.
   * @param pinnedVersionedSectionId The section id.
   * @returns The custom section versions.
   */
  static async findByCustomizationAndPinnedSection(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number,
    customSectionId: number,
    pinnedVersionedSectionType: PinnedSectionTypeEnum,
    pinnedVersionedSectionId: number
  ): Promise<VersionedCustomSection> {
    const results = await VersionedCustomSection.query(
      context,
      `SELECT * FROM ${VersionedCustomSection.tableName}
         WHERE versionedTemplateCustomizatonId = ? AND customSectionId = ?
           AND pinnedVersionedSectionType = ? AND pinnedVersionedSectionId = ?`,
      [
        versionedTemplateCustomizatonId.toString(),
        customSectionId?.toString(),
        pinnedVersionedSectionType,
        pinnedVersionedSectionId?.toString()
      ],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedCustomSection(results[0]) : undefined;
  }

  /**
   * Find all the custom section versions for a specific template customization version
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the template customization version.
   * @returns The custom section versions.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number
  ): Promise<VersionedCustomSection[]> {
    const results = await VersionedCustomSection.query(
      context,
      `SELECT * FROM ${VersionedCustomSection.tableName}
         WHERE versionedTemplateCustomizationId = ?`,
      [versionedTemplateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new VersionedCustomSection(r)) : [];
  }
}
