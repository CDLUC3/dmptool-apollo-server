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
    this.conditionMatch = options.conditionMatch; // plain string in memory — no encoding here
  }

  async isValid(): Promise<boolean> {
    await super.isValid();
    if (!this.versionedQuestionConditionGroupId) this.addError('versionedQuestionConditionGroupId', 'Versioned Question Condition Group can\'t be blank');
    if (!this.questionConditionId) this.addError('questionConditionId', 'Question Condition can\'t be blank');
    if (!this.conditionType) this.addError('conditionType', 'Condition Type can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Returns a plain object matching this instance, but with conditionMatch
  // JSON-encoded for storage (the DB column is JSON-typed). Encoding only
  // happens here, at the write boundary — never in the constructor, so
  // reconstructing an instance from a DB row (findById, etc.) can't
  // re-encode a value that's already been through this once.
  private toDbPayload() {
    return {
      ...this,
      conditionMatch: this.conditionMatch !== undefined && this.conditionMatch !== null
        ? JSON.stringify(this.conditionMatch)
        : null,
    };
  }

  async create(context: MyContext): Promise<VersionedQuestionCondition> {
    if (await this.isValid()) {
      const newId = await VersionedQuestionCondition.insert(
        context,
        this.tableName,
        this.toDbPayload(),
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