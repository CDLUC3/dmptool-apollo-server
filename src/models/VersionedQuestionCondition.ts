import { MyContext } from "../context.js";
import { MySqlModel } from "./MySqlModel.js";
import { QuestionConditionCondition } from "./QuestionCondition.js";

export class VersionedQuestionCondition extends MySqlModel {
  public versionedQuestionConditionGroupId: number;
  public conditionType: QuestionConditionCondition;
  public conditionMatch?: string;

  private tableName = 'versionedQuestionConditions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedQuestionConditionGroupId = options.versionedQuestionConditionGroupId;
    this.conditionType = options.conditionType;
    this.conditionMatch = options.conditionMatch; // plain string in memory — no encoding here
  }

  async isValid(): Promise<boolean> {
    await super.isValid();
    if (!this.versionedQuestionConditionGroupId) this.addError('versionedQuestionConditionGroupId', 'Versioned Question Condition Group can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  async create(context: MyContext): Promise<VersionedQuestionCondition> {
    if (await this.isValid()) {
      const newId = await VersionedQuestionCondition.insert(
        context,
        this.tableName,
        this,
        'VersionedQuestionCondition.create'
      );
      return await VersionedQuestionCondition.findById('VersionedQuestion.create', context, newId);
    }
    return new VersionedQuestionCondition(this);
  }

  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedQuestionCondition> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE id = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionCondition(results[0]) : null;
  }

  static async findByVersionedQuestionConditionGroupId(reference: string, context: MyContext, versionedQuestionConditionGroupId: number): Promise<VersionedQuestionCondition[]> {
    const sql = 'SELECT * FROM versionedQuestionConditions WHERE versionedQuestionConditionGroupId = ?';
    const results = await VersionedQuestionCondition.query(context, sql, [versionedQuestionConditionGroupId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedQuestionCondition(entry)) : [];
  }
}