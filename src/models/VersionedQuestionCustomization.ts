import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";

/**
 * This object represents a snapshot of custom requirements, guidance, and
 * sample text an organization has added to an existing published template question
 */
export class VersionedQuestionCustomization extends MySqlModel {
  public versionedTemplateCustomizationId: number;
  public questionCustomizationId: number;
  public versionedQuestionId: number;
  public guidanceText?: string;
  public sampleText?: string;

  static tableName = 'versionedQuestionCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.versionedTemplateCustomizationId = options.versionedTemplateCustomizationId;
    this.questionCustomizationId = options.questionCustomizationId;
    this.versionedQuestionId = options.versionedQuestionId;
    this.guidanceText = options.guidanceText;
    this.sampleText = options.sampleText;
  }

  /**
   * Make sure the customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the versioned customized question is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.versionedTemplateCustomizationId)) {
      this.addError(
        'versionedTemplateCustomizationId',
        'Versioned customization can\'t be blank'
      );
    }
    if (isNullOrUndefined(this.questionCustomizationId)) {
      this.addError('questionCustomizationId','Versioned question customization can\'t be blank');
    }
    if (isNullOrUndefined(this.versionedQuestionId)) {
      this.addError('versionedQuestionId','Versioned question can\'t be blank');
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Ensure data integrity by trimming leading/trailing spaces.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.guidanceText = this.guidanceText?.trim();
    this.sampleText = this.sampleText?.trim();
  }

  /**
   * Save the current record
   *
   * @param context The Apollo context.
   * @returns The newly created versioned question customization.
   */
  async create(context: MyContext): Promise<VersionedQuestionCustomization> {
    const ref = 'VersionedQuestionCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: VersionedQuestionCustomization =
        await VersionedQuestionCustomization.findByVersionedCustomizationAndVersionedQuestion(
          ref,
          context,
          this.versionedTemplateCustomizationId,
          this.versionedQuestionId
        );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Question has already been customized');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await VersionedQuestionCustomization.insert(
          context,
          VersionedQuestionCustomization.tableName,
          this,
          ref
        );
        return await VersionedQuestionCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedQuestionCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated versioned question customization.
   */
  async update(context: MyContext, noTouch = false): Promise<VersionedQuestionCustomization> {
    const ref = 'VersionedQuestionCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Versioned question customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await VersionedQuestionCustomization.update(
          context,
          VersionedQuestionCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await VersionedQuestionCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedQuestionCustomization(this);
  }

  /**
   * Delete the customization
   *
   * @param context The Apollo context
   * @returns The archived versioned question customization.
   */
  async delete(context: MyContext): Promise<VersionedQuestionCustomization> {
    const ref = 'VersionedQuestionCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Versioned question customization has never been saved');
    } else {
      const original: VersionedQuestionCustomization = await VersionedQuestionCustomization.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await VersionedQuestionCustomization.delete(
        context,
        VersionedQuestionCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove the versioned question customization');
    }
    // Otherwise return as-is with all the errors
    return new VersionedQuestionCustomization(this);
  }

  /**
   * Find the customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedQuestionCustomizationId The versioned question customization id.
   * @returns The versioned question customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    versionedQuestionCustomizationId: number
  ): Promise<VersionedQuestionCustomization> {
    const results = await VersionedQuestionCustomization.query(
      context,
      `SELECT * FROM ${VersionedQuestionCustomization.tableName} WHERE id = ?`,
      [versionedQuestionCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionCustomization(results[0]) : undefined;
  }

  /**
   * Find the versioned question customization by the versioned customization and versioned question
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the versioned customization.
   * @param versionedQuestionId The versioned question id.
   * @returns The versioned question customization.
   */
  static async findByVersionedCustomizationAndVersionedQuestion(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number,
    versionedQuestionId: number
  ): Promise<VersionedQuestionCustomization> {
    const results = await VersionedQuestionCustomization.query(
      context,
      `SELECT * FROM ${VersionedQuestionCustomization.tableName}
         WHERE versionedTemplateCustomizationId = ? AND versionedQuestionId = ?`,
      [versionedTemplateCustomizatonId.toString(), versionedQuestionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionCustomization(results[0]) : undefined;
  }

  /**
   * Find all the versioned question customizations for a specific versioned customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the versioned customization.
   * @returns The versioned question customizations.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number
  ): Promise<VersionedQuestionCustomization[]> {
    const results = await VersionedQuestionCustomization.query(
      context,
      `SELECT * FROM ${VersionedQuestionCustomization.tableName}
         WHERE versionedTemplateCustomizationId = ?`,
      [versionedTemplateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new VersionedQuestionCustomization(r)) : [];
  }

  /**
 * Find the active versioned question customization for a given template and affiliation.
 * Used to surface customization guidance in the plan guidance panel.
 * 
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param templateId The base template id.
 * @param affiliationId The affiliation id.
 * @param versionedQuestionId The versioned question id.
 * @returns The active versioned question customization, or undefined if none exists.
 */
  static async findActiveByTemplateAffiliationAndQuestion(
    reference: string,
    context: MyContext,
    affiliationId: string,
    versionedQuestionId: number
  ): Promise<VersionedQuestionCustomization | undefined> {
    const results = await VersionedQuestionCustomization.query(
      context,
      `SELECT vqc.* FROM ${VersionedQuestionCustomization.tableName} AS vqc
     JOIN versionedTemplateCustomizations AS vtc
       ON vqc.versionedTemplateCustomizationId = vtc.id
     WHERE vtc.active = 1
       AND vtc.affiliationId = ?
       AND vqc.versionedQuestionId = ?
     LIMIT 1`,
      [affiliationId, versionedQuestionId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0
      ? new VersionedQuestionCustomization(results[0])
      : undefined;
  }

}
