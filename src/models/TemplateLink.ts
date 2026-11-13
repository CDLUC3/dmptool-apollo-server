import { MyContext } from "../context.js";
import { generalConfig } from "../config/generalConfig.js";
import { isNullOrUndefined, validateURL } from "../utils/helpers.js";
import { MySqlModel } from "./MySqlModel.js";

export enum TemplateLinkType {
  FUNDER = 'FUNDER',
  SAMPLE_PLAN = 'SAMPLE_PLAN',
}

// The maximum length of the url and text columns in the database
export const TEMPLATE_LINK_MAX_FIELD_LENGTH = 255;

// Return the maximum number of links of the specified type that a Template may have
export const maxTemplateLinks = (linkType: TemplateLinkType): number => {
  return linkType === TemplateLinkType.SAMPLE_PLAN
    ? generalConfig.maxTemplateSamplePlanLinks
    : generalConfig.maxTemplateFunderLinks;
}

// Shared validation for TemplateLink and VersionedTemplateLink
export const validateTemplateLinkFields = (
  link: MySqlModel & { linkType: TemplateLinkType, url: string, text?: string }
): void => {
  if (isNullOrUndefined(link.linkType)) {
    link.addError('linkType', 'Link type can\'t be blank');
  } else if (!Object.values(TemplateLinkType).includes(link.linkType)) {
    link.addError('linkType', 'Invalid link type');
  }

  if (!validateURL(link.url)) {
    link.addError('url', 'Invalid URL');
  } else if (link.url.length > TEMPLATE_LINK_MAX_FIELD_LENGTH) {
    link.addError('url', `URL must be ${TEMPLATE_LINK_MAX_FIELD_LENGTH} characters or less`);
  }

  if (!isNullOrUndefined(link.text) && link.text.length > TEMPLATE_LINK_MAX_FIELD_LENGTH) {
    link.addError('text', `Link text must be ${TEMPLATE_LINK_MAX_FIELD_LENGTH} characters or less`);
  }
}

// A link that can be displayed for a template (e.g. funder guidance or a sample plan)
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
    this.url = options.url?.trim();
    this.text = options.text?.trim();
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.templateId)) this.addError('templateId', 'Template can\'t be blank');
    validateTemplateLinkFields(this);

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<TemplateLink> {
    const reference = 'TemplateLink.create';

    if (await this.isValid()) {
      // Make sure the link isn't already associated with the Template
      const current = await TemplateLink.findByTemplateAndURL(reference, context, this.templateId, this.url);
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'That link is already associated with this Template');
        return new TemplateLink(this);
      }

      // Make sure the Template hasn't reached the maximum number of links of this type
      const existing = await TemplateLink.findByTemplateId(reference, context, this.templateId, this.linkType);
      const max = maxTemplateLinks(this.linkType);
      if (existing.length >= max) {
        this.addError('general', `A Template can have a maximum of ${max} links of this type`);
        return new TemplateLink(this);
      }

      // Save the record and then fetch it
      const newId = await TemplateLink.insert(context, TemplateLink.tableName, this, reference);
      return await TemplateLink.findById(reference, context, newId as number);
    }
    // Otherwise return as-is with all the errors
    return new TemplateLink(this);
  }

  // Update the link (the linkType and templateId are not expected to change)
  async update(context: MyContext): Promise<TemplateLink> {
    const reference = 'TemplateLink.update';
    if (!this.id) {
      this.addError('general', 'The link does not exist');
      return new TemplateLink(this);
    }

    if (await this.isValid()) {
      // Make sure another link on the Template doesn't already use this URL
      const current = await TemplateLink.findByTemplateAndURL(reference, context, this.templateId, this.url);
      if (!isNullOrUndefined(current) && current.id !== this.id) {
        this.addError('general', 'That link is already associated with this Template');
        return new TemplateLink(this);
      }

      const updated = await TemplateLink.update(context, TemplateLink.tableName, this, reference);
      if (updated) {
        return await TemplateLink.findById(reference, context, this.id);
      }

      this.addError('general', 'Unable to update the link');
    }

    // Otherwise return it with all of its errors
    return new TemplateLink(this);
  }

  // Delete this record
  async delete(context: MyContext): Promise<TemplateLink> {
    if (this.id) {
      const result = await TemplateLink.delete(context, TemplateLink.tableName, this.id, 'TemplateLink.delete');
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

  // Return the TemplateLink for the Template that has the specified URL
  static async findByTemplateAndURL(
    reference: string,
    context: MyContext,
    templateId: number,
    url: string
  ): Promise<TemplateLink> {
    const sql = `SELECT * FROM ${TemplateLink.tableName} WHERE templateId = ? AND url = ?`;
    const results = await TemplateLink.query(context, sql, [templateId?.toString(), url], reference);
    return Array.isArray(results) && results.length > 0 ? new TemplateLink(results[0]) : null;
  }

  // Return all of the TemplateLinks for the Template (optionally filtered by link type) in the order they were added
  static async findByTemplateId(
    reference: string,
    context: MyContext,
    templateId: number,
    linkType?: TemplateLinkType
  ): Promise<TemplateLink[]> {
    const values = [templateId?.toString()];
    let sql = `SELECT * FROM ${TemplateLink.tableName} WHERE templateId = ?`;
    if (!isNullOrUndefined(linkType)) {
      sql += ' AND linkType = ?';
      values.push(linkType);
    }
    sql += ' ORDER BY id ASC';

    const results = await TemplateLink.query(context, sql, values, reference);
    return Array.isArray(results) ? results.map((entry) => new TemplateLink(entry)) : [];
  }
}
