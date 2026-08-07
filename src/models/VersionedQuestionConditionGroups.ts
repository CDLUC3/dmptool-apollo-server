import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";

  // Point-in-time snapshot of a QuestionConditionGroup; write-once.
export class VersionedQuestionConditionGroup extends MySqlModel {
  public versionedQuestionId: number;
  public triggerQuestionId: number;

  private tableName = 'versionedQuestionConditionGroups';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedQuestionId = options.versionedQuestionId;
    this.triggerQuestionId = options.triggerQuestionId;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.versionedQuestionId) this.addError('versionedQuestionId', 'Versioned Question Id can\'t be blank');
    if (!this.triggerQuestionId) this.addError('triggerQuestionId', 'Trigger Question Id can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Create a new VersionedQuestionConditionGroup
  async create(context: MyContext): Promise<VersionedQuestionConditionGroup> {
    if (await this.isValid()) {
      const newId = await VersionedQuestionConditionGroup.insert(context, this.tableName, this, 'VersionedQuestionConditionGroup.create');
      const created = await VersionedQuestionConditionGroup.findById('VersionedQuestionConditionGroup.create', context, newId);
      if (created) return new VersionedQuestionConditionGroup(created);
    }
    return new VersionedQuestionConditionGroup(this);
  }

  // Fetch a VersionedQuestionConditionGroup by its id
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedQuestionConditionGroup> {
    const sql = 'SELECT * FROM versionedQuestionConditionGroups WHERE id = ?';
    const results = await VersionedQuestionConditionGroup.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedQuestionConditionGroup(results[0]) : null;
  }

  // Fetch all of the VersionedQuestionConditionGroups for the specified VersionedQuestion
  static async findByVersionedQuestionId(reference: string, context: MyContext, versionedQuestionId: number): Promise<VersionedQuestionConditionGroup[]> {
    const sql = 'SELECT * FROM versionedQuestionConditionGroups WHERE versionedQuestionId = ?';
    const results = await VersionedQuestionConditionGroup.query(context, sql, [versionedQuestionId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedQuestionConditionGroup(entry)) : [];
  }
}