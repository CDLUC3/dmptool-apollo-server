import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { QuestionConditionActionType, QuestionConditionCondition } from "./QuestionCondition";
import { DatabaseTransactionClient } from "../datasources/mysql";

export class VersionedQuestionCondition extends MySqlModel {
  public versionedQuestionId: number;
  public questionConditionId: number;
  public action: QuestionConditionActionType;
  public conditionType: QuestionConditionCondition;
  public conditionMatch?: string;
  public target: string;

  private tableName = 'versionedQuestionConditions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedQuestionId = options.versionedQuestionId;
    this.questionConditionId = options.questionConditionId;
    this.action = options.action;
    this.conditionType = options.conditionType;
    this.conditionMatch = options.conditionMatch;
    this.target = options.target;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.versionedQuestionId) this.addError('versionedQuestionId', 'Versioned Question can\'t be blank');
    if (!this.questionConditionId) this.addError('questionConditionId', 'Question Condition can\'t be blank');
    if (!this.action) this.addError('action', 'Action can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');
    if (!this.target) this.addError('target', 'Target can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Insert the new record
  async create(context: MyContext, transactionClient?: DatabaseTransactionClient): Promise<VersionedQuestionCondition> {
    // First make sure the record is valid
    if (await this.isValid()) {
      // Save the record and then fetch it
      const newId = await VersionedQuestionCondition.insert(
        context,
        this.tableName,
        this,
        'VersionedQuestionCondition.create',
        [],
        transactionClient
      );
      return await VersionedQuestionCondition.findById('VersionedQuestion.create', context, newId, transactionClient);
    }
    // Otherwise return as-is with all the errors
    return new VersionedQuestionCondition(this);
  }

  // Find the VersionedQuestionCondition by id
  static async findById(reference: string, context: MyContext, id: number, transactionClient?: DatabaseTransactionClient): Promise<VersionedQuestionCondition> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE id = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [id?.toString()], reference, transactionClient);
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionCondition(results[0]) : null;
  }

  // Find all VersionedQuestionConditions that match versionedQuestionId
  static async findByVersionedQuestionId(reference: string, context: MyContext, versionedQuestionId: number, transactionClient?: DatabaseTransactionClient): Promise<VersionedQuestionCondition[]> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE versionedQuestionId = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [versionedQuestionId?.toString()], reference, transactionClient);
    return Array.isArray(results) ? results.map((entry) => new VersionedQuestionCondition(entry)) : [];
  }
}
