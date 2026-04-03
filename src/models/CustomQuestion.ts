import { MySqlModel } from "./MySqlModel";
import { TemplateCustomizationMigrationStatus } from "./TemplateCustomization";
import {
  isNullOrUndefined,
  removeNullAndUndefinedFromJSON
} from "../utils/helpers";
import { MyContext } from "../context";
import { DefaultTextAreaQuestion, QuestionSchemaMap } from "@dmptool/types";
import { PinnedSectionTypeEnum } from "./CustomSection";

/**
 * The type of question the custom question follows (is pinned to)
 *   - NULL: It should be the first question in the section.
 *   - BASE: The base funder template question
 *   - CUSTOM: A question added by the organization
 */
export enum PinnedQuestionTypeEnum {
  BASE = 'BASE',
  CUSTOM = 'CUSTOM'
}

/**
 * This object represents a custom question that an organization wants to include
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
export class CustomQuestion extends MySqlModel {
  public templateCustomizationId: number;
  public sectionType: PinnedSectionTypeEnum;
  public sectionId: number;
  public pinnedQuestionType?: PinnedQuestionTypeEnum;
  public pinnedQuestionId?: number;
  public migrationStatus: TemplateCustomizationMigrationStatus;

  public questionText: string;
  public json: string;
  public requirementText?: string;
  public guidanceText?: string;
  public sampleText?: string;
  public useSampleTextAsDefault?: boolean;
  public required: boolean;

  static tableName = 'customQuestions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.templateCustomizationId = options.templateCustomizationId;
    this.sectionType = options.sectionType ? PinnedSectionTypeEnum[options.sectionType] : undefined;
    this.sectionId = options.sectionId;
    this.pinnedQuestionType = options.pinnedQuestionType ? PinnedQuestionTypeEnum[options.pinnedQuestionType] : undefined;
    this.pinnedQuestionId = options.pinnedQuestionId;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;

    // Ensure JSON is stored as a string
    try {
      this.json = removeNullAndUndefinedFromJSON(options.json ?? DefaultTextAreaQuestion);
    } catch (e) {
      this.addError('json', e.message);
    }
    this.questionText = options.questionText ?? 'New question';
    this.requirementText = options.requirementText;
    this.guidanceText = options.guidanceText;
    this.sampleText = options.sampleText;
    this.useSampleTextAsDefault = options.useSampleTextAsDefault ?? false;
    this.required = options.required ?? false;
  }

  /**
   * Make sure the custom question is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the custom question is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateCustomizationId)) {
      this.addError('templateCustomizationId', 'Customization can\'t be blank');
    }
    if (isNullOrUndefined(this.sectionType) || isNullOrUndefined(this.sectionId)) {
      this.addError('sectionId', 'Must be attached to either a custom section or a funder section');
    }
    // Only validate these if the record has already been created
    if (!isNullOrUndefined(this.id)) {
      if (isNullOrUndefined(this.questionText)) {
        this.addError('questionText', 'Question text can\'t be blank');
      }
      // If JSON is not null and the type is in the schema map
      if (!isNullOrUndefined(this.json) && this.errors['json'] === undefined) {
        const parsedJSON = JSON.parse(this.json);
        if (Object.keys(QuestionSchemaMap).includes(parsedJSON['type'])) {
          // Validate the JSON against the Zod schema and if valid, set the questionType
          try {
            const result = QuestionSchemaMap[parsedJSON['type']]?.safeParse(parsedJSON);
            if (result && !result.success) {
              // If there are validation errors, add them to the errors object
              this.addError('json', result.error?.issues?.map(e => `${e.path.join('.')} - ${e.message}`)?.join('; '));
            }
          } catch (e) {
            this.addError('json', e.message);
          }
        } else {
          // If the type is not in the schema map, add an error
          this.addError('json', `Unknown question type "${parsedJSON['type']}"`);
        }
      } else {
        if (this.errors['json'] === undefined) {
          this.addError('json', 'Question JSON can\'t be blank');
        }
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Ensure data integrity by trimming leading/trailing spaces.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.questionText = this.questionText?.trim();
    this.requirementText = this.requirementText?.trim();
    this.sampleText = this.sampleText?.trim();
    this.guidanceText = this.guidanceText?.trim();
    if (isNullOrUndefined(this.useSampleTextAsDefault)) this.useSampleTextAsDefault = false;
    if (isNullOrUndefined(this.required)) this.required = false;
  }

  /**
   * Save the custom question
   *
   * @param context The Apollo context.
   * @returns The newly created custom question.
   */
  async create(context: MyContext): Promise<CustomQuestion> {
    const ref = 'CustomQuestion.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: CustomQuestion = await CustomQuestion.findByCustomizationSectionAndQuestion(
        ref,
        context,
        this.templateCustomizationId,
        this.sectionType,
        this.sectionId,
        this.pinnedQuestionType,
        this.pinnedQuestionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Custom question already exists');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await CustomQuestion.insert(
          context,
          CustomQuestion.tableName,
          this,
          ref
        );
        return await CustomQuestion.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new CustomQuestion(this);
  }

  /**
   * Update the custom question
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated custom question.
   */
  async update(context: MyContext, noTouch = false): Promise<CustomQuestion> {
    const ref = 'CustomQuestion.update';

    if (isNullOrUndefined(this.id)) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Custom question has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await CustomQuestion.update(
          context,
          CustomQuestion.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await CustomQuestion.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new CustomQuestion(this);
  }

  /**
   * Delete the custom question
   *
   * @param context The Apollo context
   * @returns The archived custom section.
   */
  async delete(context: MyContext): Promise<CustomQuestion> {
    const ref = 'CustomQuestion.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Custom question has never been saved');
    } else {
      const original: CustomQuestion = await CustomQuestion.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await CustomQuestion.delete(
        context,
        CustomQuestion.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove custom question');
    }
    // Otherwise return as-is with all the errors
    return new CustomQuestion(this);
  }

  /**
   * Find the custom question by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param customQuestionId The custom question id.
   * @returns The custom question.
   */
  static async findById(
    reference: string,
    context: MyContext,
    customQuestionId: number
  ): Promise<CustomQuestion> {
    const results = await CustomQuestion.query(
      context,
      `SELECT * FROM ${CustomQuestion.tableName} WHERE id = ?`,
      [customQuestionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new CustomQuestion(results[0]) : undefined;
  }

  /**
   * Find all the custom questions for a specific template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @returns The custom questions.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number
  ): Promise<CustomQuestion[]> {
    const results = await CustomQuestion.query(
      context,
      `SELECT * FROM ${CustomQuestion.tableName} WHERE templateCustomizationId = ?`,
      [templateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new CustomQuestion(r)) : [];
  }

  /**
   * Find the customization by either its customization, section and pinned question
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizatonId The id of the template customization.
   * @param sectionType The type of section the custom question is attached to (base or custom).
   * @param sectionId The id of the section the custom question is attached to.
   * @param pinnedQuestionType The type of pinned question (base or custom).
   * @param pinnedQuestionId The pinned funder question id.
   * @returns The custom question.
   */
  static async findByCustomizationSectionAndQuestion(
    reference: string,
    context: MyContext,
    templateCustomizatonId: number,
    sectionType: PinnedSectionTypeEnum,
    sectionId: number,
    pinnedQuestionType?: PinnedQuestionTypeEnum,
    pinnedQuestionId?: number
  ): Promise<CustomQuestion> {
    const results = await CustomQuestion.query(
      context,
      `SELECT * FROM ${CustomQuestion.tableName}
         WHERE templateCustomizationId = ? AND sectionType = ? AND sectionId = ?
           AND pinnedQuestionType = ? AND pinnedQuestionId = ?`,
      [
        templateCustomizatonId.toString(),
        sectionType,
        sectionId?.toString(),
        pinnedQuestionType ? pinnedQuestionType : null,
        pinnedQuestionId ? pinnedQuestionId?.toString() : null
      ],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new CustomQuestion(results[0]) : undefined;
  }

  /**
 * Find all custom questions for a specific section within a template customization
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param templateCustomizationId The id of the template customization.
 * @param sectionId The id of the section (either a versionedSection id or customSection id).
 * @returns The custom questions.
 */
  static async findByCustomizationAndSectionId(
    reference: string,
    context: MyContext,
    templateCustomizationId: number,
    sectionType: PinnedSectionTypeEnum,
    sectionId: number
  ): Promise<CustomQuestion[]> {
    const results = await CustomQuestion.query(
      context,
      `SELECT * FROM ${CustomQuestion.tableName}
       WHERE templateCustomizationId = ? AND sectionType = ? AND sectionId = ?`,
      [templateCustomizationId.toString(), sectionType, sectionId.toString()],
      reference
    );
    return Array.isArray(results) ? results.map(r => new CustomQuestion(r)) : [];
  }


  /**
   * Find all custom questions of a specific section type within a template customization.
   * For example, find all custom questions added to BASE sections (as opposed to CUSTOM sections).
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The id of the template customization.
   * @param sectionType The type of the section to filter by (either 'BASE' or 'CUSTOM').
   * @returns The custom questions.
   */
  static async findByCustomizationAndSectionType(
    reference: string,
    context: MyContext,
    templateCustomizationId: number,
    sectionType: PinnedSectionTypeEnum,
    // No sectionId — we want ALL questions of this type across all sections
  ): Promise<CustomQuestion[]> {
    const results = await CustomQuestion.query(
      context,
      `SELECT * FROM ${CustomQuestion.tableName}
     WHERE templateCustomizationId = ? AND sectionType = ?`,
      [templateCustomizationId.toString(), sectionType],
      reference
    );
    return Array.isArray(results) ? results.map(r => new CustomQuestion(r)) : [];
  }

  /**
   * Find a custom question by its position within a template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The id of the template customization.
   * @param sectionType The type of the section.
   * @param sectionId The id of the section.
   * @param pinnedQuestionType The type of the pinned question.
   * @param pinnedQuestionId The id of the pinned question.
   * @returns The custom question or null if not found.
   */
  static async findByPosition(
    reference: string,
    context: MyContext,
    templateCustomizationId: number,
    sectionType: string,
    sectionId: number,
    pinnedQuestionType: string | null,
    pinnedQuestionId: number | null
  ): Promise<CustomQuestion | null> {
    const sql = `
    SELECT * FROM customQuestions 
    WHERE templateCustomizationId = ?
      AND sectionType = ?
      AND sectionId = ?
      AND pinnedQuestionType <=> ?
      AND pinnedQuestionId <=> ?
    LIMIT 1
  `;
    // <=> is MySQL's NULL-safe equality operator.  It correctly handles the case where pinnedQuestionId is null, 
    // since null = null is false in SQL but null <=> null is true.
    const results = await CustomQuestion.query(context, sql, [
      templateCustomizationId.toString(),
      sectionType,
      sectionId.toString(),
      pinnedQuestionType,
      pinnedQuestionId?.toString() ?? null,
    ], reference);

    return Array.isArray(results) && results.length > 0 ? new CustomQuestion(results[0]) : null;

  }
}
