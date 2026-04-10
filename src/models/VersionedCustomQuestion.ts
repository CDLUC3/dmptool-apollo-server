import { MySqlModel } from "./MySqlModel";
import {
  isNullOrUndefined,
  removeNullAndUndefinedFromJSON
} from "../utils/helpers";
import { MyContext } from "../context";
import { QuestionSchemaMap } from "@dmptool/types";
import { PinnedSectionTypeEnum } from "./CustomSection";
import { PinnedQuestionTypeEnum } from "./CustomQuestion";

/**
 * This object represents a snapshot version of a custom question that an
 * organization wants to include as part of an existing published template
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
export class VersionedCustomQuestion extends MySqlModel {
  public versionedTemplateCustomizationId: number;
  public customQuestionId: number;
  public versionedSectionType: PinnedSectionTypeEnum;
  public versionedSectionId: number;
  public pinnedVersionedQuestionType?: PinnedQuestionTypeEnum;
  public pinnedVersionedQuestionId?: number;

  public questionText: string;
  public json: string;
  public requirementText?: string;
  public guidanceText?: string;
  public sampleText?: string;
  public useSampleTextAsDefault?: boolean;
  public required: boolean;

  static tableName = 'versionedCustomQuestions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.versionedTemplateCustomizationId = options.versionedTemplateCustomizationId;
    this.customQuestionId = options.customQuestionId;
    this.versionedSectionType = options.versionedSectionType ? PinnedSectionTypeEnum[options.versionedSectionType] : undefined;
    this.versionedSectionId = options.versionedSectionId;
    this.pinnedVersionedQuestionType = options.pinnedVersionedQuestionType ? PinnedQuestionTypeEnum[options.pinnedVersionedQuestionType] : undefined;
    this.pinnedVersionedQuestionId = options.pinnedVersionedQuestionId;

    this.json = options.json;
    // Ensure JSON is stored as a string
    try {
      this.json = removeNullAndUndefinedFromJSON(options.json);
    } catch (e) {
      this.addError('json', e.message);
    }
    this.questionText = options.questionText;
    this.requirementText = options.requirementText;
    this.guidanceText = options.guidanceText;
    this.sampleText = options.sampleText;
    this.useSampleTextAsDefault = options.useSampleTextAsDefault ?? false;
    this.required = options.required ?? false;
  }

  /**
   * Make sure the custom question version is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the custom question version is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.versionedTemplateCustomizationId)) {
      this.addError('versionedTemplateCustomizationId', 'Versioned customization can\'t be blank');
    }
    if (isNullOrUndefined(this.customQuestionId)) {
      this.addError('customQuestionId', 'Custom question can\'t be blank');
    }
    if (isNullOrUndefined(this.versionedSectionType) || isNullOrUndefined(this.versionedSectionId)) {
      this.addError(
        'versionedSectionId',
        'Must be attached to either a version of a custom section or a funder section'
      );
    }
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
  }

  /**
   * Save the custom question version
   *
   * @param context The Apollo context.
   * @returns The newly created custom question version.
   */
  async create(context: MyContext): Promise<VersionedCustomQuestion> {
    const ref = 'VersionedCustomQuestion.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: VersionedCustomQuestion = await VersionedCustomQuestion.findByCustomizationSectionAndQuestion(
        ref,
        context,
        this.versionedTemplateCustomizationId,
        this.customQuestionId,
        this.versionedSectionType,
        this.versionedSectionId,
        this.pinnedVersionedQuestionType,
        this.pinnedVersionedQuestionId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Custom question version already exists');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId: number = await VersionedCustomQuestion.insert(
          context,
          VersionedCustomQuestion.tableName,
          this,
          ref
        );
        return await VersionedCustomQuestion.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedCustomQuestion(this);
  }

  /**
   * Update the custom question version
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated custom question version.
   */
  async update(context: MyContext, noTouch = false): Promise<VersionedCustomQuestion> {
    const ref = 'VersionedCustomQuestion.update';

    if (isNullOrUndefined(this.id)) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Custom question version has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        this.prepForSave();

        await VersionedCustomQuestion.update(
          context,
          VersionedCustomQuestion.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await VersionedCustomQuestion.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedCustomQuestion(this);
  }

  /**
   * Delete the custom question version
   *
   * @param context The Apollo context
   * @returns The archived custom section version.
   */
  async delete(context: MyContext): Promise<VersionedCustomQuestion> {
    const ref = 'VersionedCustomQuestion.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Custom question has never been saved');
    } else {
      const original: VersionedCustomQuestion = await VersionedCustomQuestion.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await VersionedCustomQuestion.delete(
        context,
        VersionedCustomQuestion.tableName,
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
    return new VersionedCustomQuestion(this);
  }

  /**
   * Find the custom question version by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedCustomQuestionId The custom question version id.
   * @returns The custom question version.
   */
  static async findById(
    reference: string,
    context: MyContext,
    versionedCustomQuestionId: number
  ): Promise<VersionedCustomQuestion> {
    const results = await VersionedCustomQuestion.query(
      context,
      `SELECT * FROM ${VersionedCustomQuestion.tableName} WHERE id = ?`,
      [versionedCustomQuestionId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedCustomQuestion(results[0]) : undefined;
  }

  /**
   * Find all the custom question versions for a specific template customization
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the versioned template customization.
   * @returns The custom questions.
   */
  static async findByCustomizationId(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number
  ): Promise<VersionedCustomQuestion[]> {
    const results = await VersionedCustomQuestion.query(
      context,
      `SELECT * FROM ${VersionedCustomQuestion.tableName}
         WHERE versionedTemplateCustomizationId = ?`,
      [versionedTemplateCustomizatonId.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? results.map(r => new VersionedCustomQuestion(r)) : [];
  }

  /**
   * Find the customization by either its versioned customization, section and pinned question
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateCustomizatonId The id of the template customization.
   * @param customQuestionId The id of the custom question.
   * @param versionedSectionType The type of section the custom question is attached to (base or custom).
   * @param versionedSectionId The id of the section the custom question is attached to.
   * @param pinnedVersionedQuestionType The type of pinned question (base or custom).
   * @param pinnedVersionedQuestionId The pinned funder question id.
   * @returns The custom question version.
   */
  static async findByCustomizationSectionAndQuestion(
    reference: string,
    context: MyContext,
    versionedTemplateCustomizatonId: number,
    customQuestionId: number,
    versionedSectionType: PinnedSectionTypeEnum,
    versionedSectionId: number,
    pinnedVersionedQuestionType?: PinnedQuestionTypeEnum,
    pinnedVersionedQuestionId?: number
  ): Promise<VersionedCustomQuestion> {
    const results = await VersionedCustomQuestion.query(
      context,
      `SELECT * FROM ${VersionedCustomQuestion.tableName}
         WHERE versionedTemplateCustomizationId = ? AND customQuestionId = ?
           AND versionedSectionType = ? AND versionedSectionId = ?
           AND pinnedVersionedQuestionType = ? AND pinnedVersionedQuestionId = ?`,
      [
        versionedTemplateCustomizatonId.toString(),
        customQuestionId?.toString(),
        versionedSectionType,
        versionedSectionId?.toString(),
        pinnedVersionedQuestionType ? pinnedVersionedQuestionType : null,
        pinnedVersionedQuestionId ? pinnedVersionedQuestionId?.toString() : null
      ],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new VersionedCustomQuestion(results[0]) : undefined;
  }

  // Find all the custom question versions for a specific versioned custom section version
  // Custom questions use pinning, and not displayOrder
  static async findByVersionedCustomSectionId(
    reference: string,
    context: MyContext,
    versionedCustomSectionId: number
  ): Promise<VersionedCustomQuestion[]> {
    const sql = `
    SELECT vcq.* FROM ${VersionedCustomQuestion.tableName} as vcq
    JOIN versionedTemplateCustomizations as vtc
      ON vcq.versionedTemplateCustomizationId = vtc.id
    WHERE vcq.versionedSectionType = 'CUSTOM'
      AND vcq.versionedSectionId = ?
      AND vtc.active = 1
    ORDER BY vcq.pinnedVersionedQuestionType ASC, vcq.pinnedVersionedQuestionId ASC
  `;
    const results = await VersionedCustomQuestion.query(
      context, sql, [versionedCustomSectionId.toString()], reference
    );
    return Array.isArray(results) && results.length > 0
      ? results.map(r => new VersionedCustomQuestion(r))
      : [];
  }

  // Find all the custom question versions for a specific versioned section version and section type
  static async findByVersionedSectionIdAndType(
    reference: string,
    context: MyContext,
    versionedSectionId: number,
    sectionType: 'BASE' | 'CUSTOM'
  ): Promise<VersionedCustomQuestion[]> {
    const sql = `SELECT vcq.* FROM versionedCustomQuestions as vcq
    JOIN versionedTemplateCustomizations as vtc
      ON vcq.versionedTemplateCustomizationId = vtc.id 
    WHERE vcq.versionedSectionType = ? 
      AND vcq.versionedSectionId = ?
      AND vtc.active = 1
    ORDER BY vcq.pinnedVersionedQuestionType ASC, vcq.pinnedVersionedQuestionId ASC`;
    const results = await VersionedCustomQuestion.query(
      context, sql, [sectionType, versionedSectionId.toString()], reference
    );
    return Array.isArray(results) ? results.map(r => new VersionedCustomQuestion(r)) : [];
  }
}
