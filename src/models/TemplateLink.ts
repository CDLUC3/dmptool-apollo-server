import { MyContext } from "../context";
import { isNullOrUndefined, validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";

export enum TemplateLinkType {
  FUNDER = 'FUNDER',
  SAMPLE_PLAN = 'SAMPLE_PLAN',
}

// A link that can be displayed for a template
export class TemplateLink extends MySqlModel {
  public templateId!: number;
  public linkType!: TemplateLinkType;
  public url!: string;
  public text: string;

  private static tableName = 'templateLinks';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.templateId = options.templateId;
    this.linkType = options.linkType;
    this.url = options.url;
    this.text = options.text;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateId)) this.addError('templateId', 'Template can\'t be blank');
    if (isNullOrUndefined(this.linkType)) this.addError('linkType', 'Link type can\'t be blank');
    if (validateURL(this.url)) this.addError('url', 'Invalid URL');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<TemplateLink> {
    const reference = 'TemplateLink.create';
    // First make sure the record doesn't already exist
    const current = await TemplateLink.findByTemplateAndURL(
      reference,
      context,
      this.templateId,
      this.url,
    );

    // Then make sure it doesn't already exist
    if(await this.isValid()) {
      if (!isNullOrUndefined(current)) {
        this.addError('general', `That link is already associated with this Template`);
      } else {
        // Save the record and then fetch it
        const newId = await TemplateLink.insert(
          context,
          TemplateLink.tableName,
          this,
          reference
        );
        return await TemplateLink.findById(reference, context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new TemplateLink(this);
  }

  // Archive this record
  async delete(context: MyContext): Promise<TemplateLink> {
    if (this.id) {
      const result = await TemplateLink.delete(
        context,
        TemplateLink.tableName,
        this.id,
        'TemplateLink.delete'
      );
      if (result) {
        return new TemplateLink(this);
      }
    }
    return null;
  }

  // Return the specified TemplateLink
  static async findById(reference: string, context: MyContext, id: number): Promise<TemplateLink> {
    const sql = `SELECT * FROM ${TemplateLink.tableName} WHERE id = ?`;
    const results = await TemplateLink.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new TemplateLink(results[0]) : null;
  }

  // Return the specified TemplateLink
  static async findByTemplateAndURL(reference: string, context: MyContext, templateId: number, url: string): Promise<TemplateLink> {
    const sql = `SELECT * FROM ${TemplateLink.tableName} WHERE templateId = ? AND url = ?`;
    const results = await TemplateLink.query(context, sql, [templateId.toString(), url], reference);
    return Array.isArray(results) && results.length > 0 ? new TemplateLink(results[0]) : null;
  }

  // Return all of the TemplateLink for the Template
  static async findByTemplateId(reference: string, context: MyContext, templateId: number): Promise<TemplateLink[]> {
    const sql = `SELECT * FROM ${TemplateLink.tableName} WHERE templateId = ?`;
    const results = await TemplateLink.query(context, sql, [templateId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new TemplateLink(entry)) : [];
  }
}
