import { MySqlModel } from "./MySqlModel";
import { MyContext } from "../context";
import {isNullOrUndefined} from "../utils/helpers";

/**
 * A snapshot version of the affiliation's customizations to a funder template
 *
 * The `active` field indicates whether this version is currently published. There
 * can be only one published version at a time.
 */
export class VersionedTemplateCustomization extends MySqlModel {
  // Pointer to the affiliation that owns this customization
  public affiliationId: string;
  // Pointer to the base customization object
  public templateCustomizationId: number;
  // Pointer to the published version template that this object tracks
  public currentVersionedTemplateId: number;
  // Whether this version is currently published
  public active: boolean;

  static tableName = 'versionedTemplateCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.templateCustomizationId = options.templateCustomizationId;
    this.currentVersionedTemplateId = options.currentVersionedTemplateId;
    this.active = options.active ?? false;
  }

  /**
   * Make sure the published customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the customization is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.affiliationId)) {
      this.addError('affiliationId', 'Affiliation can\'t be blank');
    }
    if (isNullOrUndefined(this.templateCustomizationId)) {
      this.addError('templateCustomizationId','Template customization can\'t be blank');
    }
    if (isNullOrUndefined(this.currentVersionedTemplateId)) {
      this.addError('currentVersionedTemplateId', 'Funder template can\'t be blank');
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Create the published version of the customization
   *
   * @param context The Apollo context.
   * @returns The newly created version of the customization.
   */
  async create(context: MyContext): Promise<VersionedTemplateCustomization> {
    const ref = 'VersionedTemplateCustomization.create';

    // Make sure the record is valid
    if (await this.isValid()) {
      // Set the active flag to true by default.
      this.active = true;

      // Save the record and then fetch it
      const newId: number = await VersionedTemplateCustomization.insert(
        context,
        VersionedTemplateCustomization.tableName,
        this,
        ref
      );

      if (newId) {
        const created: VersionedTemplateCustomization = await VersionedTemplateCustomization.findById(
          ref,
          context,
          newId
        );

        if (!isNullOrUndefined(created) && !isNullOrUndefined(created.id)) {
          // Unpublish all other versions of the customization.
          await created.unpublishOtherVersions(ref, context)

          return created;
        } else {
          this.addError('general', 'Unable to load newly created version');
        }
      } else {
        this.addError('general', 'Unable to create version');
      }
    }

    // Otherwise return as-is with all the errors
    return new VersionedTemplateCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated version of the customization.
   */
  async update(context: MyContext, noTouch = false): Promise<VersionedTemplateCustomization> {
    const ref = 'VersionedTemplateCustomization.update';

    if (!this.id) {
      // We cannot update it if the version has never been saved!
      this.addError('general', 'Version has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        const result = await VersionedTemplateCustomization.update(
          context,
          VersionedTemplateCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        ) as unknown as {affectedRows:number} | null;

        if (result && result.affectedRows > 0) {
          return await VersionedTemplateCustomization.findById(ref, context, this.id);
        } else {
          this.addError('general', 'Unable to update version');
        }
      }
    }
    return new VersionedTemplateCustomization(this);
  }

  /**
   * Unpublish all other versions of the customization.
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @returns boolean.
   */
  async unpublishOtherVersions(
    reference: string,
    context: MyContext
  ): Promise<boolean> {
    const results = await VersionedTemplateCustomization.query(
      context,
      `UPDATE ${VersionedTemplateCustomization.tableName} SET active = 0
        WHERE id != ? AND templateCustomizationId = ? AND currentVersionedTemplateId = ?`,
      [
        this.id.toString(),
        this.templateCustomizationId.toString(),
        this.currentVersionedTemplateId.toString()
      ],
      reference
    );
    return !!results;
  }

  /**
   * Find the version by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizationId The versioned template customization id.
   * @returns The Template customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizationId: number
  ): Promise<VersionedTemplateCustomization> {
    const results = await VersionedTemplateCustomization.query(
      context,
      `SELECT * FROM ${VersionedTemplateCustomization.tableName} WHERE id = ?`,
      [versionedTemplateCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0
      ? new VersionedTemplateCustomization(results[0])
      : undefined;
  }

  /**
   * Find the version by the customization and published template ids
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The customization id.
   * @param versionedTemplateId The published version of the template id.
   * @returns The version of the customization.
   */
  static async findByCustomizationAndTemplate(
    reference: string,
    context: MyContext,
    templateCustomizationId: number,
    versionedTemplateId: number
  ): Promise<VersionedTemplateCustomization> {
    const results = await VersionedTemplateCustomization.query(
      context,
      `SELECT * FROM ${VersionedTemplateCustomization.tableName}
         WHERE templateCustomizationId = ? AND currentVersionedTemplateId = ?
         AND active = 1`,
      [templateCustomizationId.toString(), versionedTemplateId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0
      ? new VersionedTemplateCustomization(results[0])
      : undefined;
  }
}
