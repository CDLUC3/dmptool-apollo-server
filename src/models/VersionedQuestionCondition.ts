import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { QuestionConditionCondition } from "./QuestionCondition";

export class VersionedQuestionCondition extends MySqlModel {
  public versionedQuestionConditionGroupId: number;
  public questionConditionId: number;
  public conditionType: QuestionConditionCondition;
  public conditionMatch?: string;

  private tableName = 'versionedQuestionConditions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedQuestionConditionGroupId = options.versionedQuestionConditionGroupId;
    this.questionConditionId = options.questionConditionId;
    this.conditionType = options.conditionType;
    this.conditionMatch = options.conditionMatch;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.versionedQuestionConditionGroupId) this.addError('versionedQuestionConditionGroupId', 'Versioned Question Condition Group can\'t be blank');
    if (!this.questionConditionId) this.addError('questionConditionId', 'Question Condition can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Insert the new record
  async create(context: MyContext): Promise<VersionedQuestionCondition> {
    // First make sure the record is valid
    if (await this.isValid()) {
      // Save the record and then fetch it
      const newId = await VersionedQuestionCondition.insert(
        context,
        this.tableName,
        this,
        'VersionedQuestionCondition.create',
      );
      return await VersionedQuestionCondition.findById('VersionedQuestion.create', context, newId);
    }
    // Otherwise return as-is with all the errors
    return new VersionedQuestionCondition(this);
  }

  // Find the VersionedQuestionCondition by id
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedQuestionCondition> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE id = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionCondition(results[0]) : null;
  }

  // Find all VersionedQuestionConditions that belong to the specified VersionedQuestionConditionGroup
  static async findByVersionedQuestionConditionGroupId(reference: string, context: MyContext, versionedQuestionConditionGroupId: number): Promise<VersionedQuestionCondition[]> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE versionedQuestionConditionGroupId = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [versionedQuestionConditionGroupId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedQuestionCondition(entry)) : [];
  }
}