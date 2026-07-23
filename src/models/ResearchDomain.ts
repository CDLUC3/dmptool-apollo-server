import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import { PaginatedQueryResults, PaginationOptions, PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, randomHex, validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";

export const DEFAULT_DMPTOOL_RESEARCH_DOMAIN_URL = 'https://dmptool.org/research-domains/';;

export class ResearchDomain extends MySqlModel {
  public name: string;
  public uri: string;
  public description?: string;
  public parentResearchDomainId?: number;
  public parentResearchDomain: ResearchDomain;

  private tableName = 'researchDomains';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.id = options.id;
    this.name = options.name;
    this.uri = options.uri;
    this.description = options.description;
    this.parentResearchDomainId = options.parentResearchDomainId;
    this.parentResearchDomain = options.parentResearchDomain;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.name) this.addError('name', 'Name can\'t be blank');
    if (!validateURL(this.uri)) this.addError('uri', 'Invalid URL');

    if (this.parentResearchDomain) {
      if (!this.parentResearchDomain.id) {
        this.addError('parentResearchDomain', 'Parent research domain must be saved first');
      }
      if (this.id && this.id === this.parentResearchDomain.id) {
        this.addError('parentResearchDomain', 'Parent research domain must be a different domain');
      }
    }
    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.uri = this.uri?.trim();
  }

  //Create a new ResearchDomain
  async create(context: MyContext): Promise<ResearchDomain> {
    const reference = 'ResearchDomain.create';

    // If no URI is present, then use the DMPTool's default URI
    if (!this.uri) {
      this.uri = `${DEFAULT_DMPTOOL_RESEARCH_DOMAIN_URL}${randomHex(6)}`;
    }

    // First make sure the record is valid
    if (await this.isValid()) {
      let current = await ResearchDomain.findByURI(reference, context, this.uri);
      if (!current) {
        current = await ResearchDomain.findByName(reference, context, this.name.toString());
      }

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'ResearchDomain already exists');
      } else {
        // Save the record and then fetch it
        const newId = await ResearchDomain.insert(
          context,
          this.tableName,
          this,
          reference,
          ['parentResearchDomain']
        );
        const response = await ResearchDomain.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new ResearchDomain(this);
  }

  //Update an existing ResearchDomain
  async update(context: MyContext, noTouch = false): Promise<ResearchDomain> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        await ResearchDomain.update(
          context,
          this.tableName,
          this,
          'ResearchDomain.update',
          ['parentResearchDomain'],
          noTouch
        );
        return await ResearchDomain.findById('ResearchDomain.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'ResearchDomain has never been saved');
    }
    return new ResearchDomain(this);
  }

  //Delete the ResearchDomain
  async delete(context: MyContext): Promise<ResearchDomain> {
    if (this.id) {
      const deleted = await ResearchDomain.findById('ResearchDomain.delete', context, this.id);

      const successfullyDeleted = await ResearchDomain.delete(
        context,
        this.tableName,
        this.id,
        'ResearchDomain.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Add this ResearchDomain to a MetadataStandard
  async addToMetadataStandard(context: MyContext, metadataStandardId: number): Promise<boolean> {
    const reference = 'ResearchDomain.addToMetadataStandard';
    let sql = 'INSERT INTO metadataStandardResearchDomains (researchDomainId, metadataStandardId, ';
    sql += 'createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token?.id?.toString();
    const vals = [this.id?.toString(), metadataStandardId?.toString(), userId, userId];
    const results = await ResearchDomain.query(context, sql, vals, reference);

    if (!results) {
      const payload = { researchDomainId: this.id, metadataStandardId };
      const msg = 'Unable to add the research domain to the metadata standard';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Add this ResearchDomain to a MetadataStandard
  async addToRepository(context: MyContext, repositoryId: number): Promise<boolean> {
    const reference = 'ResearchDomain.addToRepository';
    let sql = 'INSERT INTO repositoryResearchDomains (researchDomainId, repositoryId, createdById,';
    sql += 'modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token?.id?.toString();
    const vals = [this.id?.toString(), repositoryId?.toString(), userId, userId];
    const results = await ResearchDomain.query(context, sql, vals, reference);

    if (!results) {
      const payload = { researchDomainId: this.id, repositoryId };
      const msg = 'Unable to add the research domain to the repository';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Remove this ResearchDomain from a MetadataStandard
  async removeFromMetadataStandard(context: MyContext, metadataStandardId: number): Promise<boolean> {
    const reference = 'ResearchDomain.removeFromMetadataStandard';
    const sql = 'DELETE FROM metadataStandardResearchDomains WHERE researchDomainId = ? AND metadataStandardId = ?';
    const vals = [this.id?.toString(), metadataStandardId?.toString()];
    const results = await ResearchDomain.query(context, sql, vals, reference);

    if (!results) {
      const payload = { researchDomainId: this.id, metadataStandardId };
      const msg = 'Unable to remove the research domain from the metadata standard';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Remove this ResearchDomain from a repository
  async removeFromRepository(context: MyContext, repositoryId: number): Promise<boolean> {
    const reference = 'ResearchDomain.removeFromRepository';
    const sql = 'DELETE FROM repositoryResearchDomains WHERE researchDomainId = ? AND repositoryId = ?';
    const vals = [this.id?.toString(), repositoryId?.toString()];
    const results = await ResearchDomain.query(context, sql, vals, reference);

    if (!results) {
      const payload = { researchDomainId: this.id, repositoryId };
      const msg = 'Unable to remove the research domain from the repository';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Return all of the top level Research Domains (meaning they have no parent)
  static async search(
    reference: string,
    context: MyContext,
    term: string,
    options: PaginationOptions = ResearchDomain.getDefaultPaginationOptions()
  ): Promise<PaginatedQueryResults<ResearchDomain>> {
    const whereFilters = [];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(rd.name) LIKE ? OR LOWER(rd.description) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'rd.name';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'ASC';

    // Sepcify the feilds available for sorting
    options.availableSortFields = ['rd.name', 'rd.created'];
    // Specify the field we want to use for the count
    options.countField = 'rd.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'rd.id';
    }

    const sqlStatement = 'SELECT rd.* FROM researchDomains rd';

    const response: PaginatedQueryResults<ResearchDomain> = await ResearchDomain.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference
    )

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }

  // Return all of the top level Research Domains (meaning they have no parent)
  static async topLevelDomains(reference: string, context: MyContext): Promise<ResearchDomain[]> {
    const sql = 'SELECT * FROM researchDomains WHERE parentResearchDomainId IS NULL ORDER BY name';
    const results = await ResearchDomain.query(context, sql, [], reference);
    // No need to reinitialize all of the results to objects here because they're just search results
    return Array.isArray(results) ? results : [];
  }

  // Return all of the ResearchDomains for the specified parent Research Domain
  static async findByParentId(reference: string, context: MyContext, parentResearchDomainId: number): Promise<ResearchDomain[]> {
    const sql = 'SELECT * FROM researchDomains WHERE parentResearchDomainId = ? ORDER BY name';
    const results = await ResearchDomain.query(context, sql, [parentResearchDomainId?.toString()], reference);
    // No need to reinitialize all of the results to objects here because they're just search results
    return Array.isArray(results) ? results : [];
  }

  // Fetch all of the ResearchDomains for the specified MetadataStandard
  static async findByMetadataStandardId(
    reference: string,
    context: MyContext,
    metadataStandardId: number
  ): Promise<ResearchDomain[]> {
    const sql = 'SELECT rd.* FROM metadataStandardResearchDomains jt';
    const joinClause = 'INNER JOIN researchDomains rd ON jt.researchDomainId = rd.id';
    const whereClause = 'WHERE jt.metadataStandardId = ?';
    const vals = [metadataStandardId?.toString()];
    const results = await ResearchDomain.query(context, `${sql} ${joinClause} ${whereClause}`, vals, reference);
    return Array.isArray(results) ? results.map((entry) => new ResearchDomain(entry)) : [];
  }

  // Fetch all of the ResearchDomains associated with a Repository
  static async findByRepositoryId(
    reference: string,
    context: MyContext,
    repositoryId: number
  ): Promise<ResearchDomain[]> {
    const sql = 'SELECT rd.* FROM repositoryResearchDomains jt';
    const joinClause = 'INNER JOIN researchDomains rd ON jt.researchDomainId = rd.id';
    const whereClause = 'WHERE jt.repositoryId = ?';
    const vals = [repositoryId?.toString()];
    const results = await ResearchDomain.query(context, `${sql} ${joinClause} ${whereClause}`, vals, reference);
    return Array.isArray(results) ? results.map((entry) => new ResearchDomain(entry)) : [];
  }

  // Fetch a ResearchDomain by it's id
  static async findById(reference: string, context: MyContext, researchDomainId: number): Promise<ResearchDomain | null> {
    const sql = `SELECT * FROM researchDomains WHERE id = ?`;
    const results = await ResearchDomain.query(context, sql, [researchDomainId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ResearchDomain(results[0]) : null;
  }

  static async findByURI(reference: string, context: MyContext, uri: string): Promise<ResearchDomain> {
    const sql = `SELECT * FROM researchDomains WHERE uri = ?`;
    const results = await ResearchDomain.query(context, sql, [uri], reference);
    return Array.isArray(results) && results.length > 0 ? new ResearchDomain(results[0]) : null;
  }

  static async findByName(reference: string, context: MyContext, name: string): Promise<ResearchDomain> {
    const sql = `SELECT * FROM researchDomains WHERE LOWER(name) = ?`;
    const searchTerm = (name ?? '');
    const results = await ResearchDomain.query(context, sql, [searchTerm?.toLowerCase()?.trim()], reference);
    return Array.isArray(results) && results.length > 0 ? new ResearchDomain(results[0]) : null;
  }
}
