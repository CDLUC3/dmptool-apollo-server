import { MyContext } from "../context";
import { PaginatedQueryResults, PaginationOptions, PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { defaultLanguageId, supportedLanguages } from "./Language";
import { MySqlModel } from "./MySqlModel";
import { prepareObjectForLogs } from "../logger";
import { isNullOrUndefined } from "../utils/helpers";

export enum TemplateVisibility {
  ORGANIZATION = 'ORGANIZATION', // Template is only available to Researchers that belong to the same affiliation
  PUBLIC = 'PUBLIC', // Template is available to everyone creating a DMP
}

// A paired down version of template information for search results
export class TemplateSearchResult {
  public id: number;
  public name: string;
  public description?: string;
  public latestPublishVisibility?: TemplateVisibility;
  public bestPractice: boolean;
  public latestPublishVersion?: string;
  public latestPublishDate?: string;
  public isDirty: boolean;
  public ownerId: string;
  public ownerDisplayName: string;
  public createdById: number;
  public createdByName: string;
  public created: string;
  public modifiedById: number;
  public modifiedByName: string;
  public modified: string;

  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.latestPublishVisibility = options.latestPublishVisibility;
    this.bestPractice = options.bestPractice;
    this.latestPublishVersion = options.latestPublishVersion;
    this.latestPublishDate = options.latestPublishDate;
    this.isDirty = options.isDirty;
    this.ownerId = options.ownerId;
    this.ownerDisplayName = options.ownerDisplayName;
    this.createdById = options.createdById;
    this.createdByName = options.createdByName;
    this.created = options.created;
    this.modifiedById = options.modifiedById;
    this.modifiedByName = options.modifiedByName;
    this.modified = options.modified;
  }

  // Return the templates associated with the Affiliation and search term
  static async findByAffiliationIdAndTerm(
    reference: string,
    context: MyContext,
    affiliationId: string,
    term: string,
    options: PaginationOptions = Template.getDefaultPaginationOptions(),
  ): Promise<PaginatedQueryResults<TemplateSearchResult>> {
    const whereFilters = ['t.ownerId = ?'];
    const values: string[] = [affiliationId];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(t.name) LIKE ? OR LOWER(t.description) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 't.modified';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'DESC';

    // Specify the fields available for sorting
    options.availableSortFields = ['t.name', 't.created', 't.latestPublishVisibility', 't.bestPractice', 't.latestPublishDate'];
    // Specify the field we want to use for the count
    options.countField = 't.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 't.id';
    }

    const sqlStatement = 'SELECT t.id, t.name, t.description, t.latestPublishVisibility, t.bestPractice, t.isDirty, ' +
                                't.latestPublishVersion, t.latestPublishDate, t.ownerId, a.displayName, ' +
                                't.createdById, TRIM(CONCAT(cu.givenName, CONCAT(\' \', cu.surName))) as createdByName, t.created, ' +
                                't.modifiedById, TRIM(CONCAT(mu.givenName, CONCAT(\' \', mu.surName))) as modifiedByName, t.modified ' +
                          'FROM templates t ' +
                            'INNER JOIN affiliations a ON a.uri = t.ownerId ' +
                            'INNER JOIN users cu ON cu.id = t.createdById ' +
                            'INNER JOIN users mu ON mu.id = t.modifiedById';

    const response: PaginatedQueryResults<TemplateSearchResult> = await Template.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    )

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }

  // Find all of the published templates that have visibility=PUBLIC, for the given search term, and
  // exclude the user's org
  static async searchForCustomizableTemplates(
    reference: string,
    context: MyContext,
    term: string,
    options: PaginationOptions = Template.getDefaultPaginationOptions(),
  ): Promise<PaginatedQueryResults<TemplateSearchResult>> {
    // template should be published
    const whereFilters = ['t.latestPublishDate IS NOT NULL'];    
    const values: string[] = [];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(t.name) LIKE ? OR LOWER(t.description) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Return only those public templates with visibility=PUBLIC
    whereFilters.push('t.latestPublishVisibility = ?');
    values.push(TemplateVisibility.PUBLIC);

    // Exclude the user's affiliation
    const userAffiliationId = context.token?.affiliationId;
    if (userAffiliationId) {
      whereFilters.push('t.ownerId <> ?');
      values.push(userAffiliationId);
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 't.modified';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'DESC';

    // Specify the fields available for sorting
    options.availableSortFields = ['t.name', 't.created', 't.latestPublishVisibility', 't.bestPractice', 't.latestPublishDate'];
    // Specify the field we want to use for the count
    options.countField = 't.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 't.id';
    }

    const sqlStatement = 'SELECT t.id, t.name, t.description, t.latestPublishVisibility, t.bestPractice, t.isDirty, ' +
                                't.latestPublishVersion, t.latestPublishDate, t.ownerId, a.displayName, ' +
                                't.createdById, TRIM(CONCAT(cu.givenName, CONCAT(\' \', cu.surName))) as createdByName, t.created, ' +
                                't.modifiedById, TRIM(CONCAT(mu.givenName, CONCAT(\' \', mu.surName))) as modifiedByName, t.modified ' +
                          'FROM templates t ' +
                            'INNER JOIN affiliations a ON a.uri = t.ownerId ' +
                            'INNER JOIN users cu ON cu.id = t.createdById ' +
                            'INNER JOIN users mu ON mu.id = t.modifiedById';

    const response: PaginatedQueryResults<TemplateSearchResult> = await Template.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    )

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }
}

// A Template for creating a DMP
export class Template extends MySqlModel {
  public sourceTemplateId?: number;
  public name: string;
  public description?: string;
  public ownerId?: string;
  public latestPublishVisibility?: TemplateVisibility;
  public latestPublishVersion?: string;
  public latestPublishDate?: string;
  public isDirty: boolean;
  public bestPractice: boolean;
  public languageId: string;

  private tableName = 'templates';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.name = options.name;
    this.ownerId = options.ownerId;
    this.description = options.description;
    this.sourceTemplateId = options.sourceTemplateId
    this.latestPublishVisibility = options.latestPublishVisibility ?? TemplateVisibility.ORGANIZATION;
    this.latestPublishVersion = options.latestPublishVersion ?? '';
    this.latestPublishDate = options.latestPublishDate ?? null;
    this.isDirty = options.isDirty ?? true;
    this.bestPractice = options.bestPractice ?? false;
    this.languageId = options.languageId ?? defaultLanguageId;
  }

  // Ensure data integrity
  prepForSave() {
    if (!supportedLanguages.map((l) => l.id).includes(this.languageId)) {
      this.languageId = defaultLanguageId;
    }
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.description = this.description?.trim();
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (this.ownerId === null) this.addError('ownerId', 'Owner can\'t be blank');
    if (!this.name) this.addError('name', 'Name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<Template> {
    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await Template.findByNameAndOwnerId(
        'TemplateCollaborator.create',
        context,
        this.name,
      );

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Template with this name already exists');
      } else {
        this.prepForSave();
        // Save the record and then fetch it
        const newId = await Template.insert(context, this.tableName, this, 'Template.create');
        return await Template.findById('Template.create', context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new Template(this);
  }

  // Save the changes made to the template
  async update(context: MyContext, noTouch = false): Promise<Template> {
    const id = this.id;

    // First make sure the record is valid
    if (await this.isValid()) {
      if (id) {
        // if the template is versioned then set the isDirty flag
        if (this.latestPublishVersion && noTouch !== true) {
          this.isDirty = true;
        }

        /*When calling 'update' in the mySqlModel, the query returns an object that looks something like this:
        {
          fieldCount: 0,
          affectedRows: 1,
          insertId: 0,
          info: 'Rows matched: 1  Changed: 1  Warnings: 0',
          serverStatus: 2,
          warningStatus: 0,
          changedRows: 1
        }
        So, we have to make a call to findById to get the updated data to return to user
        */
        await Template.update(context, this.tableName, this, 'Template.update', [], noTouch);
        return await Template.findById('Template.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Template has never been saved');
    }
    return new Template(this);
  }

  // Archive this record
  async delete(context: MyContext): Promise<Template> {
    if (this.id) {
      const original = await Template.findById('Template.delete', context, this.id);
      // Associated TemplateCollaborators and VersionedTemplates will be deletd automatically by MySQL
      const result = await Template.delete(context, this.tableName, this.id, 'Template.delete');
      if (result) {
        return original;
      }
    }
    return null;
  }

  // Return the specified Template
  static async findById(reference: string, context: MyContext, templateId: number): Promise<Template> {
    const sql = 'SELECT * FROM templates WHERE id = ?';
    const results = await Template.query(context, sql, [templateId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Template(results[0]) : null;
  }

  // Look for the template by it's name and owner
  static async findByNameAndOwnerId(
    reference: string,
    context: MyContext,
    name: string
  ): Promise<Template> {
    const sql = 'SELECT * FROM templates WHERE LOWER(name) = ? AND ownerId = ?';
    const searchTerm = (name ?? '');
    const vals = [searchTerm?.toLowerCase()?.trim(), context.token?.affiliationId];
    const results = await Template.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new Template(results[0]) : null;
  }

  // Find all of the templates associated with the Affiliation
  static async findByAffiliationId(
    reference: string,
    context: MyContext,
    affiliationId: string
  ): Promise<Template[]> {
    const sql = 'SELECT * FROM templates WHERE ownerId = ? ORDER BY modified DESC';
    const results = await Template.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((item) => new Template(item)) : [];
  }

  // Template needs to be updated to isDirty=true if changes were made to its sections or questions
  static async markTemplateAsDirty(
    reference: string,
    context: MyContext,
    templateId: number
  ): Promise<void> {
    const template = await Template.findById(reference, context, templateId);
    if (template) {
      template.isDirty = true;
      await template.update(context);
    }
  };
}
