import { MyContext } from "../context";
import { valueIsEmpty } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { DatabaseTransactionClient } from "../datasources/mysql";

export class AnswerComment extends MySqlModel {
  public answerId: number;
  public commentText: string;

  private static tableName = 'answerComments';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.answerId = options.answerId;
    this.commentText = options.commentText;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.answerId) this.addError('answerId', 'Answer can\'t be blank');
    if (valueIsEmpty(this.commentText)) this.addError('commentText', 'Comment can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.commentText = this.commentText?.trim();
  }

  //Create a new AnswerComment
  async create(context: MyContext, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<AnswerComment> {
    const reference = 'AnswerComment.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      // Save the record and then fetch it
      const newId = await AnswerComment.insert(context, AnswerComment.tableName, this, reference, [], transactionClient);
      const response = await AnswerComment.findById(reference, context, newId);
      return response;
    }
    // Otherwise return as-is with all the errors
    return new AnswerComment(this);
  }

  //Update an existing AnswerComment
  async update(context: MyContext, noTouch = false, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<AnswerComment> {
    if (await this.isValid()) {
      if (this.id) {
        await AnswerComment.update(context, AnswerComment.tableName, this, 'AnswerComment.update', [], noTouch, transactionClient);
        return await AnswerComment.findById('AnswerComment.update', context, this.id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'AnswerComment has never been saved');
    }
    return new AnswerComment(this);
  }

  //Delete the AnswerComment
  async delete(context: MyContext, transactionClient: DatabaseTransactionClient | undefined = undefined): Promise<AnswerComment> {
    if (this.id) {
      const deleted = await AnswerComment.findById('AnswerComment.delete', context, this.id);

      const successfullyDeleted = await AnswerComment.delete(
        context,
        AnswerComment.tableName,
        this.id,
        'AnswerComment.delete',
        transactionClient
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Fetch a AnswerComment by it's id
  static async findById(reference: string, context: MyContext, licenseId: number): Promise<AnswerComment> {
    const sql = `SELECT * FROM ${AnswerComment.tableName} WHERE id = ?`;
    const results = await AnswerComment.query(context, sql, [licenseId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new AnswerComment(results[0]) : null;
  }

  // Fetch a AnswerComment by it's planId and versionedQuestionId
  static async findByAnswerId(reference: string, context: MyContext, answerId: number): Promise<AnswerComment[]> {
    const sql = `SELECT * FROM ${AnswerComment.tableName} WHERE answerId = ?`;
    const results = await AnswerComment.query(context, sql, [answerId.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((ans) => new AnswerComment(ans)) : [];
  }
};
