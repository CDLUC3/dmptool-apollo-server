import { MyContext } from "../context";
import { valueIsEmpty } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";

export class PlanFeedbackComment extends MySqlModel {
  public answerId: number;
  public feedbackId: number;
  public commentText: string;

  private static tableName = 'feedbackComments';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.answerId = options.answerId;
    this.feedbackId = options.feedbackId;
    this.commentText = options.commentText;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.feedbackId) this.addError('feedbackId', 'Feedback can\'t be blank');
    if (valueIsEmpty(this.commentText)) this.addError('commentText', 'Comment can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.commentText = this.commentText?.trim();
  }

  //Create a new PlanFeedbackComment
  async create(context: MyContext): Promise<PlanFeedbackComment> {
    const reference = 'PlanFeedbackComment.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      this.prepForSave();
      // Save the record and then fetch it
      const newId = await PlanFeedbackComment.insert(context, PlanFeedbackComment.tableName, this, reference);
      const response = await PlanFeedbackComment.findById(reference, context, newId);
      return response;
    }
    // Otherwise return as-is with all the errors
    return new PlanFeedbackComment(this);
  }

  //Update an existing PlanFeedbackComment
  async update(context: MyContext, noTouch = false): Promise<PlanFeedbackComment> {
    if (await this.isValid()) {
      if (this.id) {
        this.prepForSave();
        await PlanFeedbackComment.update(context, PlanFeedbackComment.tableName, this, 'PlanFeedbackComment.update', [], noTouch);
        return await PlanFeedbackComment.findById('PlanFeedbackComment.update', context, this.id);
      }
      // This PlanFeedbackComment has never been saved before so we cannot update it!
      this.addError('general', 'PlanFeedbackComment has never been saved');
    }
    return new PlanFeedbackComment(this);
  }

  //Delete the PlanFeedbackComment
  async delete(context: MyContext): Promise<PlanFeedbackComment> {
    if (this.id) {
      const deleted = await PlanFeedbackComment.findById('PlanFeedbackComment.delete', context, this.id);

      const successfullyDeleted = await PlanFeedbackComment.delete(
        context,
        PlanFeedbackComment.tableName,
        this.id,
        'PlanFeedbackComment.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Fetch a PlanFeedbackComment by it's id
  static async findById(reference: string, context: MyContext, feedbackCommentsId: number): Promise<PlanFeedbackComment> {
    const sql = `SELECT * FROM ${PlanFeedbackComment.tableName} WHERE id = ?`;
    const results = await PlanFeedbackComment.query(context, sql, [feedbackCommentsId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanFeedbackComment(results[0]) : null;
  }

  // Fetch a PlanFeedbackComment by it's feedbackId
  static async findByFeedbackId(reference: string, context: MyContext, feedbackId: number): Promise<PlanFeedbackComment[]> {
    const sql = `SELECT * FROM ${PlanFeedbackComment.tableName} WHERE feedbackId = ?`;
    const results = await PlanFeedbackComment.query(context, sql, [feedbackId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new PlanFeedbackComment(ans)) : [];
  }

  // Fetch a PlanFeedbackComment by it's answerId
  static async findByAnswerId(reference: string, context: MyContext, answerId: number): Promise<PlanFeedbackComment[]> {
    const sql = `SELECT * FROM ${PlanFeedbackComment.tableName} WHERE answerId = ?`;
    const results = await PlanFeedbackComment.query(context, sql, [answerId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new PlanFeedbackComment(ans)) : [];
  }
}
