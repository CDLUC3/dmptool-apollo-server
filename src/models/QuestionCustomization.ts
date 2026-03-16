import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";
import { TemplateCustomizationMigrationStatus } from "./TemplateCustomization";

/**
 * This object represents custom requirements, guidance, and sample text an
 * organization has added to an existing published template question
 *
 * The questionCustomizationService is called in some resolvers to determine if
 * the base funder template has changed. This determines the `migrationStatus`:
 * - When the funder template has NOT been republished.
 *     - "OK": The latest version of the base funder template has not changed.
 * - When the funder template has been republished:
 *     - "OK": The question has not changed in the latest version.
 *     - "STALE" The question has changed in the latest version.
 *     - "ORPHANED" The question is no longer available in the latest version.
 */
export class QuestionCustomization extends MySqlModel {
  public templateCustomizationId: number;
  public questionId: number;
  public migrationStatus: TemplateCustomizationMigrationStatus;
  public guidanceText?: string;
  public sampleText?: string;

  static tableName = 'questionCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.templateCustomizationId = options.templateCustomizationId;
    this.questionId = options.questionId;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;
    this.guidanceText = options.guidanceText;
    this.sampleText = options.sampleText;
  }

  /**
   * Make sure the customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the question customization is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateCustomizationId)) {
      this.addError('templateCustomizationId', 'Customization can\'t be blank');
    }
    if (isNullOrUndefined(this.questionId)) {
      this.addError('questionId', 'Question can\'t be blank');
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
   * @returns The newly created question customization.
   */
  async create(context: MyContext): Promise<QuestionCustomization> {
    const ref = 'QuestionCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: QuestionCustomization = await QuestionCustomization.findByCustomizationAndQuestion(
        ref,
        context,
        this.templateCustomizationId,
        this.questionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Question has already been customized');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await QuestionCustomization.insert(
          context,
          QuestionCustomization.tableName,
          this,
          ref
        );
        return await QuestionCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new QuestionCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated Question customization.
   */
  async update(context: MyContext, noTouch = false): Promise<QuestionCustomization> {
    const ref = 'QuestionCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Question customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await QuestionCustomization.update(
          context,
          QuestionCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await QuestionCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new QuestionCustomization(this);
  }

  /**
   * Delete the customization
   *
   * @param context The Apollo context
   * @returns The archived Question customization.
   */
  async delete(context: MyContext): Promise<QuestionCustomization> {
    const ref = 'QuestionCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Question customization has never been saved');
    } else {
      const original: QuestionCustomization = await QuestionCustomization.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await QuestionCustomization.delete(
        context,
        QuestionCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove the question customization');
    }
    // Otherwise return as-is with all the errors
    return new QuestionCustomization(this);
  }

  /**
   * Find the question customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param questionCustomizationId The question customization id.
   * @returns The Question customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    questionCustomizationId: number
  ): Promise<QuestionCustomization> {
    const results = await QuestionCustomization.query(
      context,
      `SELECT * FROM ${QuestionCustomization.tableName} WHERE id = ?`,
      [questionCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new QuestionCustomization(results[0]) : undefined;
  }

  /**
   * Find the question customization by the customization and funder question
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param questionId The question id.
   * @returns The Question customization.
   */
  static async findByCustomizationAndQuestion(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    questionId: number
  ): Promise<QuestionCustomization> {
    const results = await QuestionCustomization.query(
      context,
      `SELECT * FROM ${QuestionCustomization.tableName}
         WHERE templateCustomizationId = ? AND questionId = ?`,
      [templateCustomizatonId.toString(), questionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new QuestionCustomization(results[0]) : undefined;
  }


  /**
   * Find the customization by the customization and versioned question
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param versionedQuestionId The versioned question id.
   * @returns The Question customization.
   */
  static async findByCustomizationAndVersionedQuestion(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    versionedQuestionId: number
  ): Promise<QuestionCustomization> {
    const results = await QuestionCustomization.query(
      context,
      `SELECT qc.* FROM ${QuestionCustomization.tableName} qc
         INNER JOIN versionedQuestions vq ON qc.questionId = vq.questionId
         WHERE qc.templateCustomizationId = ? AND vq.id = ?`,
      [templateCustomizatonId.toString(), versionedQuestionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new QuestionCustomization(results[0]) : undefined;
  }

  /**
   * Find all the question customizations for a specific template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @returns The Question customizations.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number
  ): Promise<QuestionCustomization[]> {
    const results = await QuestionCustomization.query(
      context,
      `SELECT * FROM ${QuestionCustomization.tableName} WHERE templateCustomizationId = ?`,
      [templateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new QuestionCustomization(r)) : [];
  }
}
