import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import {
  isNullOrUndefined,
  removeNullAndUndefinedFromJSON,
} from "../utils/helpers";
import {
  AnswerSchemaMap,
  AnyResearchOutputTableColumnAnswerType,
  ResearchOutputTableRowAnswerType,
  CURRENT_SCHEMA_VERSION,
  QuestionFormatsEnum,
  SelectBoxAnswerType
} from "@dmptool/types";

export class Answer extends MySqlModel {
  public planId: number;
  public versionedSectionId: number;
  public versionedQuestionId: number;
  public versionedCustomSectionId?: number;
  public versionedCustomQuestionId?: number;
  public json: string;

  private static tableName = 'answers';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.versionedSectionId = options.versionedSectionId;
    this.versionedQuestionId = options.versionedQuestionId;
    this.versionedCustomSectionId = options.versionedCustomSectionId;
    this.versionedCustomQuestionId = options.versionedCustomQuestionId;
    this.json = options.json;
    // Ensure json is stored as a string
    try {
      this.json = removeNullAndUndefinedFromJSON(options.json);
    } catch (e) {
      this.addError('json', e.message);
    }
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();
    const hasBase = !!this.versionedSectionId && !!this.versionedQuestionId;
    const hasCustomInCustomSection = !!this.versionedCustomSectionId && !!this.versionedCustomQuestionId;
    const hasCustomInBaseSection = !!this.versionedSectionId && !!this.versionedCustomQuestionId;

    // three valid combinations: 1) base section and question, 2) custom section and custom question, 3) base section and custom question (for when a custom question is added to a base section)
    if (!hasBase && !hasCustomInCustomSection && !hasCustomInBaseSection) {
      this.addError('general', 'Answer must belong to either a base or custom section and question');
    }
    if (hasBase && hasCustomInCustomSection) {
      this.addError('general', 'Answer cannot belong to both a base and custom section simultaneously');
    }

    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');

    // If json is not null or undefined and the type is in the schema map
    if (!isNullOrUndefined(this.json) && this.errors['json'] === undefined) {
      const parsedJSON = JSON.parse(this.json);
      if (Object.keys(AnswerSchemaMap).includes(parsedJSON['type'])) {
        // Validate the json against the Zod schema and if valid, set the questionType
        try {
          const result = AnswerSchemaMap[parsedJSON['type']]?.safeParse(parsedJSON);
          if (result && !result.success) {
            // If there are validation errors, add them to the errors object
            this.addError('json', result.error.issues?.map(e => `${e.path.join('.')} - ${e.message}`)?.join('; '));
          }
        } catch (e) {
          this.addError('json', e.message);
        }
      } else {
        // If the type is not in the schema map, add an error
        this.addError('json', `Unknown answer type "${parsedJSON['type']}"`);
      }
    } else {
      if (this.errors['json'] === undefined) {
        this.addError('json', 'Answer JSON can\'t be blank');
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.json = this.json?.trim();

    const parsedJSON = JSON.parse(this.json);

    // If this is not a research output table, we don't need to do anything further
    if (parsedJSON.type !== QuestionFormatsEnum.enum.researchOutputTable) {
      return;
    }

    // Extract the output type columns
    let modified = false;

    // Process each output in the table
    parsedJSON.answer = parsedJSON.answer.map((row: ResearchOutputTableRowAnswerType) => {
      const columns: AnyResearchOutputTableColumnAnswerType[] = row.columns || [];
      const typeCol = columns.find((col: AnyResearchOutputTableColumnAnswerType) => {
        return col.commonStandardId === 'type';
      }) as SelectBoxAnswerType;

      // If the output type column is missing or empty/null
      if (!typeCol || !typeCol.answer || typeCol.answer.trim() === '') {
        modified = true;

        // Create the default column object
        const defaultTypeCol: SelectBoxAnswerType = {
          type: "selectBox",
          commonStandardId: 'type',
          answer: "Unknown",
          meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
        } as unknown as SelectBoxAnswerType;

        // Return the row with the updated columns list
        return {
          ...row,
          columns: [
            ...columns.filter((col: AnyResearchOutputTableColumnAnswerType) => {
              return col.commonStandardId !== 'type';
            }),
            defaultTypeCol
          ]
        };
      }

      return row;
    });

    // Only stringify and re-assign if we actually changed something
    if (modified) {
      this.json = JSON.stringify(parsedJSON);
    }
  }

  //Create a new Answer
  async create(context: MyContext): Promise<Answer> {
    const reference = 'Answer.create';

    this.prepForSave();

    // First make sure the record is valid
    if (await this.isValid()) {
      // Check if an answer already exists for this planId and versionedQuestionId or versionedCustomQuestionId (depending on which one is being used)
      const current = this.versionedQuestionId
        ? await Answer.findByPlanIdAndVersionedQuestionId(reference, context, this.planId, this.versionedQuestionId)
        : await Answer.findByPlanIdAndVersionedCustomQuestionId(reference, context, this.planId, this.versionedCustomQuestionId);


      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Answer already exists');
      } else {
        // Save the record and then fetch it
        const newId = await Answer.insert(context, Answer.tableName, this, reference);
        if (!newId) {
          this.addError('general', 'Failed to save answer');
        } else {
          const response = await Answer.findById(reference, context, newId);
          return response;
        }
      }
    }
    // Otherwise return as-is with all the errors
    return new Answer(this);
  }

  //Update an existing Answer
  async update(context: MyContext, noTouch = false): Promise<Answer> {
    this.prepForSave();

    if (await this.isValid()) {
      if (this.id) {
        await Answer.update(context, Answer.tableName, this, 'Answer.update', [], noTouch);
        return await Answer.findById('Answer.update', context, this.id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Answer has never been saved');
    }
    return new Answer(this);
  }

  //Delete the Answer
  async delete(context: MyContext): Promise<Answer> {
    if (this.id) {
      const deleted = await Answer.findById('Answer.delete', context, this.id);

      const successfullyDeleted = await Answer.delete(
        context,
        Answer.tableName,
        this.id,
        'Answer.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Fetch a Answer by its id
  static async findById(reference: string, context: MyContext, licenseId: number): Promise<Answer> {
    const sql = `SELECT * FROM ${Answer.tableName} WHERE id = ?`;
    const results = await Answer.query(context, sql, [licenseId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Answer(results[0]) : null;
  }

  // Fetch an Answer by its planId and versionedQuestionId
  static async findByPlanIdAndVersionedQuestionId(
    reference: string,
    context: MyContext,
    planId: number,
    versionedQuestionId: number
  ): Promise<Answer> {
    const sql = `SELECT * FROM answers WHERE planId = ? AND versionedQuestionId = ?`;
    const results = await Answer.query(context, sql, [planId.toString(), versionedQuestionId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Answer(results[0]) : null;
  }

  static async findByPlanIdAndVersionedCustomQuestionId(
    reference: string,
    context: MyContext,
    planId: number,
    versionedCustomQuestionId: number
  ): Promise<Answer> {
    const sql = `SELECT * FROM answers WHERE planId = ? AND versionedCustomQuestionId = ?`;
    const results = await Answer.query(context, sql, [planId.toString(), versionedCustomQuestionId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Answer(results[0]) : null;
  }


  // Fetch all of the answers for a versionedSectionId
  static async findByPlanIdAndVersionedSectionId(
    reference: string,
    context: MyContext,
    planId: number,
    versionedSectionId: number
  ): Promise<Answer[]> {
    const sql = `SELECT * FROM answers WHERE planId = ? AND versionedSectionId = ?`;
    const results = await Answer.query(context, sql, [planId.toString(), versionedSectionId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new Answer(ans)) : [];
  }

  // Fetch all of the answers for a plan
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<Answer[]> {
    const sql = `SELECT * FROM answers WHERE planId = ?`;
    const results = await Answer.query(context, sql, [planId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new Answer(ans)) : [];
  }

  // given a list of question ids, return all filled answers, flexible to handle different groupings of question ids
  static async findFilledAnswersByQuestionIds(
    reference: string,
    context: MyContext,
    planId: number,
    questionIds: number[]
  ): Promise<Answer[]> {
    if (!Array.isArray(questionIds) || questionIds.length === 0) return [];

    const placeholders = questionIds.map(() => '?').join(', ');
    const sql = `SELECT * FROM answers WHERE planId = ? AND versionedQuestionId IN (${placeholders}) AND json IS NOT NULL AND json != ''`;
    const results = await Answer.query(context, sql, [String(planId), ...questionIds.map(String)], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new Answer(ans)) : [];
  }

  // Given a list of question ids, return all filled answers for custom questions
  static async findFilledAnswersByCustomQuestionIds(
    reference: string,
    context: MyContext,
    planId: number,
    customQuestionIds: number[]
  ): Promise<Answer[]> {
    if (!Array.isArray(customQuestionIds) || customQuestionIds.length === 0) return [];

    const placeholders = customQuestionIds.map(() => '?').join(', ');
    const sql = `SELECT * FROM answers 
    WHERE planId = ? 
    AND versionedCustomQuestionId IN (${placeholders}) 
    AND json IS NOT NULL AND json != ''`;
    const results = await Answer.query(context, sql, [String(planId), ...customQuestionIds.map(String)], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new Answer(ans)) : [];
  }
};
