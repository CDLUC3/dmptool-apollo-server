import { QuestionSchemaMap } from "@dmptool/types";
import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined, removeNullAndUndefinedFromJSON } from "../utils/helpers";

export class Question extends MySqlModel {
  public templateId: number;
  public sectionId: number;
  public sourceQuestionId?: number;
  public json: string;
  public questionText: string;
  public requirementText?: string;
  public guidanceText?: string;
  public sampleText?: string;
  public useSampleTextAsDefault?: boolean;
  public required: boolean;
  public displayOrder: number;
  public isDirty: boolean;

  private tableName = 'questions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.templateId = options.templateId;
    this.sectionId = options.sectionId;
    this.sourceQuestionId = options.sourceQuestionId;
    this.json = options.json;
    // Ensure json is stored as a string
    try {
      this.json = removeNullAndUndefinedFromJSON(options.json);
    } catch (e) {
      this.addError('json', e.message);
    }
    this.questionText = options.questionText;
    this.requirementText = options.requirementText;
    this.guidanceText = options.guidanceText;
    this.sampleText = options.sampleText;
    this.useSampleTextAsDefault = options.useSampleTextAsDefault ?? false;
    this.required = options.required ?? false;
    this.displayOrder = options.displayOrder;
    this.isDirty = options.isDirty ?? false;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateId)) this.addError('templateId', 'Template can\'t be blank');
    if (isNullOrUndefined(this.sectionId)) this.addError('sectionId', 'Section can\'t be blank');
    if (isNullOrUndefined(this.questionText)) this.addError('questionText', 'Question text can\'t be blank');
    if (isNullOrUndefined(this.displayOrder)) this.addError('displayOrder', 'Order number can\'t be blank');

    // If json is not null or undefined and the type is in the schema map
    if (!isNullOrUndefined(this.json) && this.errors['json'] === undefined) {
      const parsedJSON = JSON.parse(this.json);
      if (Object.keys(QuestionSchemaMap).includes(parsedJSON['type'])) {
        // Validate the json against the Zod schema and if valid, set the questionType
        try {
          const result = QuestionSchemaMap[parsedJSON['type']]?.safeParse(parsedJSON);
          if (result && !result.success) {
            // If there are validation errors, add them to the errors object
            this.addError('json', result.error?.issues?.map(e => `${e.path.join('.')} - ${e.message}`)?.join('; '));
          }
        } catch (e) {
          this.addError('json', e.message);
        }
      } else {
        // If the type is not in the schema map, add an error
        this.addError('json', `Unknown question type "${parsedJSON['type']}"`);
      }
    } else {
      if (this.errors['json'] === undefined) {
        this.addError('json', 'Question type JSON can\'t be blank');
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.questionText = this.questionText?.trim();
    this.requirementText = this.requirementText?.trim();
    this.guidanceText = this.guidanceText?.trim();
    this.sampleText = this.sampleText?.trim();
  }

  //Create a new Question
  async create(
    context: MyContext
  ): Promise<Question> {
    this.prepForSave();

    // First make sure the record is valid
    if (await this.isValid()) {
      // Save the record and then fetch it
      const newId = await Question.insert(context, this.tableName, this, 'Question.create', ['questionType']);
      const response = await Question.findById('Question.create', context, newId);
      return response;

    }
    // Otherwise return as-is with all the errors
    return new Question(this);
  }

  //Update an existing Section
  async update(context: MyContext, noTouch = false): Promise<Question> {
    if (this.id) {
      this.prepForSave();

      if (await this.isValid()) {
        await Question.update(context, this.tableName, this, 'Question.update', ['questionType'], noTouch);
        return await Question.findById('Question.update', context, this.id);
      }
    }
    this.addError('general', 'Question has never been saved');
    return new Question(this);
  }

  //Delete Question based on the Question object's id and return
  async delete(context: MyContext): Promise<Question> {
    if (this.id) {
      /*First get the question to be deleted so we can return this info to the user
      since calling 'delete' doesn't return anything*/
      const deletedSection = await Question.findById('Question.delete', context, this.id);

      const successfullyDeleted = await Question.delete(context, this.tableName, this.id, 'Question.delete');
      if (successfullyDeleted) {
        return deletedSection;
      } else {
        return null
      }
    }
    return null;
  }

  // Find the Question by it's id
  static async findById(reference: string, context: MyContext, questionId: number): Promise<Question> {
    const sql = 'SELECT * FROM questions WHERE id = ?';
    const result = await Question.query(context, sql, [questionId?.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new Question(result[0]) : null;
  }

  // Fetch all of the Questions for the specified Section
  static async findBySectionId(reference: string, context: MyContext, sectionId: number): Promise<Question[]> {
    const sql = 'SELECT * FROM questions WHERE sectionId = ? ORDER BY displayOrder ASC';
    const results = await Question.query(context, sql, [sectionId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new Question(entry)) : [];
  }
}
