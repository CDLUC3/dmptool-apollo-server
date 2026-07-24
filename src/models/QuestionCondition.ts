import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";

export enum QuestionConditionActionType {
  SHOW_QUESTION = 'SHOW_QUESTION',
  HIDE_QUESTION = 'HIDE_QUESTION',
  SEND_EMAIL = 'SEND_EMAIL',
}

export enum QuestionConditionCondition {
  HAS_ANSWER = 'HAS_ANSWER',
  EQUAL = 'EQUAL',
  DOES_NOT_EQUAL = 'DOES_NOT_EQUAL',
  INCLUDES = 'INCLUDES',
}
export class QuestionCondition extends MySqlModel {
  public questionId: number;
  public action: QuestionConditionActionType;
  public conditionType: QuestionConditionCondition;
  public conditionMatch?: string;
  public target: string;

  private tableName = 'questionConditions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.questionId = options.questionId;
    this.action = options.action ?? QuestionConditionActionType.SHOW_QUESTION;
    this.conditionType = options.conditionType ?? QuestionConditionCondition.EQUAL;
    this.conditionMatch = options.conditionMatch;
    this.target = options.target;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.questionId) this.addError('questionId', 'Question Id can\'t be blank');
    if (!this.action) this.addError('action', 'Action can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');
    if (!this.target) this.addError('target', 'Target can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  //Create a new QuestionCondition
  async create(context: MyContext): Promise<QuestionCondition> {
    // First make sure the record is valid
    if (await this.isValid()) {
      // Save the record and then fetch it
      const newId = await QuestionCondition.insert(context, this.tableName, this, 'QuestionCondition.create');
      const created = await QuestionCondition.findById('QuestionCondition.create', context, newId);
      if (created) {
        return new QuestionCondition(created);
      }
    }

    // Otherwise return as-is with all the errors
    return new QuestionCondition(this);
  }

  //Update an existing QuestionCondition
  async update(context: MyContext): Promise<QuestionCondition> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        await QuestionCondition.update(context, this.tableName, this, 'QuestionCondition.update');
        const updated = await QuestionCondition.findById('QuestionCondition.update', context, id);
        if (updated) {
          return new QuestionCondition(updated);
        }
      }
      // This QuestionCondition has never been saved before so we cannot update it!
      this.addError('general', 'QuestionCondition has never been saved');
    }
    return new QuestionCondition(this);
  }

  //Delete QuestionCondition based on the QuestionCondition object's id and return
  async delete(context: MyContext): Promise<QuestionCondition> {
    if (this.id) {
      /*First get the QuestionCondition to be deleted so we can return this info to the user
      since calling 'delete' doesn't return anything*/
      const deleted = await QuestionCondition.findById('QuestionCondition.delete', context, this.id);

      const successfullyDeleted = await QuestionCondition.delete(context, this.tableName, this.id, 'QuestionCondition.delete');
      if (successfullyDeleted) {
        return new QuestionCondition(deleted);
      } else {
        return null
      }
    }
    return null;
  }

  // Fetch a QuestionConditions by it's id
  static async findById(reference: string, context: MyContext, questionConditionId: number): Promise<QuestionCondition> {
    const sql = 'SELECT * FROM questionConditions WHERE id = ?';
    const results = await QuestionCondition.query(context, sql, [questionConditionId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new QuestionCondition(results[0]) : null;
  }

  // Fetch all of the QuestionConditions for the specified Question
  static async findByQuestionId(reference: string, context: MyContext, questionId: number): Promise<QuestionCondition[]> {
    const sql = 'SELECT * FROM questionConditions WHERE questionId = ?';
    const results = await QuestionCondition.query(context, sql, [questionId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new QuestionCondition(entry)) : [];
  }
}
