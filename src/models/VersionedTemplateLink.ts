import { MyContext } from "../context";
import { isNullOrUndefined, validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { TemplateLinkType } from "./TemplateLink";

// A link that can be displayed for a template
export class VersionedTemplateLink extends MySqlModel {
  public templateId!: number;
  public linkType!: TemplateLinkType;
  public url!: string;
  public text: string;

  private static tableName = 'versionedTemplateLinks';

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
  async create(context: MyContext): Promise<VersionedTemplateLink> {
    const reference = 'VersionedTemplateLink.create';
    // First make sure the record doesn't already exist
    const current = await VersionedTemplateLink.findByTemplateAndURL(
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
        const newId = await VersionedTemplateLink.insert(
          context,
          VersionedTemplateLink.tableName,
          this,
          reference
        );
        return await VersionedTemplateLink.findById(reference, context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedTemplateLink(this);
  }

  // Archive this record
  async delete(context: MyContext): Promise<VersionedTemplateLink> {
    if (this.id) {
      const result = await VersionedTemplateLink.delete(
        context,
        VersionedTemplateLink.tableName,
        this.id,
        'VersionedTemplateLink.delete'
      );
      if (result) {
        return new VersionedTemplateLink(this);
      }
    }
    return null;
  }

  // Return the specified VersionedTemplateLink
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedTemplateLink> {
    const sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE id = ?`;
    const results = await VersionedTemplateLink.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedTemplateLink(results[0]) : null;
  }

  // Return the specified VersionedTemplateLink
  static async findByTemplateAndURL(reference: string, context: MyContext, templateId: number, url: string): Promise<VersionedTemplateLink> {
    const sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE templateId = ? AND url = ?`;
    const results = await VersionedTemplateLink.query(context, sql, [templateId.toString(), url], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedTemplateLink(results[0]) : null;
  }

  // Return all of the VersionedTemplateLink for the Template
  static async findByTemplateId(reference: string, context: MyContext, templateId: number): Promise<VersionedTemplateLink[]> {
    const sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE templateId = ?`;
    const results = await VersionedTemplateLink.query(context, sql, [templateId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedTemplateLink(entry)) : [];
  }
}
