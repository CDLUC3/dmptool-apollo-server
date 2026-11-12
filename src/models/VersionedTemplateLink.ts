import { MyContext } from "../context.js";
import { isNullOrUndefined } from "../utils/helpers.js";
import { MySqlModel } from "./MySqlModel.js";
import { TemplateLinkType, validateTemplateLinkFields } from "./TemplateLink.js";

// A snapshot of a TemplateLink at the time the Template was versioned (published or saved as a draft)
export class VersionedTemplateLink extends MySqlModel {
  public versionedTemplateId!: number;
  public linkType!: TemplateLinkType;
  public url!: string;
  public text: string;

  private static tableName = 'versionedTemplateLinks';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.versionedTemplateId = options.versionedTemplateId;
    this.linkType = options.linkType;
    this.url = options.url?.trim();
    this.text = options.text?.trim();
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.versionedTemplateId)) {
      this.addError('versionedTemplateId', 'Versioned Template can\'t be blank');
    }
    validateTemplateLinkFields(this);

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<VersionedTemplateLink> {
    const reference = 'VersionedTemplateLink.create';

    if (await this.isValid()) {
      // Make sure the link isn't already associated with the VersionedTemplate
      const current = await VersionedTemplateLink.findByVersionedTemplateAndURL(
        reference,
        context,
        this.versionedTemplateId,
        this.url,
      );

      if (!isNullOrUndefined(current)) {
        this.addError('general', 'That link is already associated with this Template version');
      } else {
        // Save the record and then fetch it
        const newId = await VersionedTemplateLink.insert(context, VersionedTemplateLink.tableName, this, reference);
        return await VersionedTemplateLink.findById(reference, context, newId as number);
      }
    }
    // Otherwise return as-is with all the errors
    return new VersionedTemplateLink(this);
  }

  // Return the specified VersionedTemplateLink
  static async findById(reference: string, context: MyContext, id: number): Promise<VersionedTemplateLink> {
    const sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE id = ?`;
    const results = await VersionedTemplateLink.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedTemplateLink(results[0]) : null;
  }

  // Return the VersionedTemplateLink for the VersionedTemplate that has the specified URL
  static async findByVersionedTemplateAndURL(
    reference: string,
    context: MyContext,
    versionedTemplateId: number,
    url: string
  ): Promise<VersionedTemplateLink> {
    const sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE versionedTemplateId = ? AND url = ?`;
    const results = await VersionedTemplateLink.query(context, sql, [versionedTemplateId?.toString(), url], reference);
    return Array.isArray(results) && results.length > 0 ? new VersionedTemplateLink(results[0]) : null;
  }

  // Return all of the VersionedTemplateLinks for the VersionedTemplate (optionally filtered by link type)
  static async findByVersionedTemplateId(
    reference: string,
    context: MyContext,
    versionedTemplateId: number,
    linkType?: TemplateLinkType
  ): Promise<VersionedTemplateLink[]> {
    const values = [versionedTemplateId?.toString()];
    let sql = `SELECT * FROM ${VersionedTemplateLink.tableName} WHERE versionedTemplateId = ?`;
    if (!isNullOrUndefined(linkType)) {
      sql += ' AND linkType = ?';
      values.push(linkType);
    }
    sql += ' ORDER BY id ASC';

    const results = await VersionedTemplateLink.query(context, sql, values, reference);
    return Array.isArray(results) ? results.map((entry) => new VersionedTemplateLink(entry)) : [];
  }
}
