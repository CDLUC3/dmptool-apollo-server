import { MyContext } from "../context.js";
import { MySqlModel } from "./MySqlModel.js";

// The ids of a group's question and trigger question, along with the sections they belong to
export interface QuestionConditionGroupSections {
  questionId: number;
  triggerQuestionId: number;
  questionSectionId: number;
  triggerQuestionSectionId: number;
}

// One row per trigger-question "box" in the Display Logic UI. Groups
// together the conditions (option checks) that apply to a single
// prior options question. 
// Belongs to a QuestionDisplayLogic; owns QuestionConditions.
export class QuestionConditionGroup extends MySqlModel {
  public questionId: number;
  public triggerQuestionId: number;

  private tableName = 'questionConditionGroups';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.questionId = options.questionId;
    this.triggerQuestionId = options.triggerQuestionId;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.questionId) this.addError('questionId', 'Question Id can\'t be blank');
    if (!this.triggerQuestionId) this.addError('triggerQuestionId', 'Trigger Question Id can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  async create(context: MyContext): Promise<QuestionConditionGroup> {
    if (await this.isValid()) {
      const newId = await QuestionConditionGroup.insert(context, this.tableName, this, 'QuestionConditionGroup.create');
      const created = await QuestionConditionGroup.findById('QuestionConditionGroup.create', context, newId);
      if (created) return new QuestionConditionGroup(created);
    }
    return new QuestionConditionGroup(this);
  }

  async update(context: MyContext): Promise<QuestionConditionGroup> {
    const id = this.id;
    if (await this.isValid()) {
      if (id) {
        await QuestionConditionGroup.update(context, this.tableName, this, 'QuestionConditionGroup.update');
        const updated = await QuestionConditionGroup.findById('QuestionConditionGroup.update', context, id);
        if (updated) return new QuestionConditionGroup(updated);
      }
      this.addError('general', 'QuestionConditionGroup has never been saved');
    }
    return new QuestionConditionGroup(this);
  }

  // Deletes cascade to questionConditions via FK.
  async delete(context: MyContext): Promise<QuestionConditionGroup> {
    if (this.id) {
      const deleted = await QuestionConditionGroup.findById('QuestionConditionGroup.delete', context, this.id);
      const successfullyDeleted = await QuestionConditionGroup.delete(context, this.tableName, this.id, 'QuestionConditionGroup.delete');
      return successfullyDeleted ? new QuestionConditionGroup(deleted) : null;
    }
    return null;
  }

  static async findById(reference: string, context: MyContext, id: number): Promise<QuestionConditionGroup> {
    const sql = 'SELECT * FROM questionConditionGroups WHERE id = ?';
    const results = await QuestionConditionGroup.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new QuestionConditionGroup(results[0]) : null;
  }

  // Fetch all of the QuestionConditionGroups for the specified Question
  static async findByQuestionId(reference: string, context: MyContext, questionId: number): Promise<QuestionConditionGroup[]> {
    const sql = 'SELECT * FROM questionConditionGroups WHERE questionId = ?';
    const results = await QuestionConditionGroup.query(context, sql, [questionId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new QuestionConditionGroup(entry)) : [];
  }

  // Fetch all of the QuestionConditionGroups that the specified Question belongs to, either as the
  // question being shown/hidden or as the trigger question
  static async findByQuestionOrTriggerQuestionId(
    reference: string,
    context: MyContext,
    questionId: number
  ): Promise<QuestionConditionGroup[]> {
    const sql = 'SELECT * FROM questionConditionGroups WHERE questionId = ? OR triggerQuestionId = ?';
    const results = await QuestionConditionGroup.query(
      context,
      sql,
      [questionId?.toString(), questionId?.toString()],
      reference
    );
    return Array.isArray(results) ? results.map((entry) => new QuestionConditionGroup(entry)) : [];
  }

  // Fetch the QuestionConditionGroups that link a question in the specified Section to a question in
  // a different Section, along with the sections of both questions
  static async findCrossSectionBySectionId(
    reference: string,
    context: MyContext,
    sectionId: number
  ): Promise<QuestionConditionGroupSections[]> {
    const sql = `SELECT qcg.questionId, qcg.triggerQuestionId,
        q.sectionId AS questionSectionId, tq.sectionId AS triggerQuestionSectionId
      FROM questionConditionGroups qcg
      INNER JOIN questions q ON q.id = qcg.questionId
      INNER JOIN questions tq ON tq.id = qcg.triggerQuestionId
      WHERE (q.sectionId = ? OR tq.sectionId = ?)
      AND q.sectionId <> tq.sectionId`;
    const results = await QuestionConditionGroup.query(
      context,
      sql,
      [sectionId?.toString(), sectionId?.toString()],
      reference
    );
    return Array.isArray(results) ? results as QuestionConditionGroupSections[] : [];
  }
}