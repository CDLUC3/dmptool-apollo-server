import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import {
  isNullOrUndefined,
  removeNullAndUndefinedFromJSON
} from "../utils/helpers";
import { AnswerSchemaMap } from "@dmptool/types";

export class Answer extends MySqlModel {
  public planId: number;
  public versionedSectionId: number;
  public versionedQuestionId: number;
  public json: string;

  private static tableName = 'answers';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.versionedSectionId = options.versionedSectionId;
    this.versionedQuestionId = options.versionedQuestionId;
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

    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');
    if (!this.versionedSectionId) this.addError('versionedSectionId', 'Section can\'t be blank');
    if (!this.versionedQuestionId) this.addError('versionedQuestionId', 'Question can\'t be blank');

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
  }

  //Create a new Answer
  async create(context: MyContext): Promise<Answer> {
    const reference = 'Answer.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await Answer.findByPlanIdAndVersionedQuestionId(
        reference,
        context,
        this.planId,
        this.versionedQuestionId
      );

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Answer already exists');
      } else {
        // Save the record and then fetch it
        const newId = await Answer.insert(context, Answer.tableName, this, reference);
        const response = await Answer.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new Answer(this);
  }

  //Update an existing Answer
  async update(context: MyContext, noTouch = false): Promise<Answer> {
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
};
