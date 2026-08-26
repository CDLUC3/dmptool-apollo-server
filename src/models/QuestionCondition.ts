import { MyContext } from "../context.js";
import { MySqlModel } from "./MySqlModel.js";
import type { // Tell Node.js to compeltely ignore this. line at runtime
  QuestionConditionActionType,
  QuestionConditionMatchType,
  QuestionConditionCondition
} from "../types.js";

export { QuestionConditionActionType, QuestionConditionMatchType, QuestionConditionCondition };

export class QuestionCondition extends MySqlModel {
  public conditionType: QuestionConditionCondition;
  public conditionMatch?: string;
  public groupId: number;

  private tableName = 'questionConditions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.conditionType = options.conditionType ?? "EQUAL";
    this.conditionMatch = options.conditionMatch;
    this.groupId = options.groupId;

  }

  async isValid(): Promise<boolean> {
    await super.isValid();
    if (!this.groupId) this.addError('groupId', 'Group Id can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');
    if (!this.conditionMatch) this.addError('conditionMatch', 'Condition Match can\'t be blank');

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
  static async findByGroupId(reference: string, context: MyContext, groupId: number): Promise<QuestionCondition[]> {
    const sql = 'SELECT * FROM questionConditions WHERE groupId = ?';
    const results = await QuestionCondition.query(context, sql, [groupId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new QuestionCondition(entry)) : [];
  }

}
