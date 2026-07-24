import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import { PaginatedQueryResults, PaginationOptions, PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, randomHex, validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { ResearchDomain } from "./ResearchDomain";

export const DEFAULT_DMPTOOL_METADATA_STANDARD_URL = 'https://dmptool.org/metadata-standards/';;
export class MetadataStandard extends MySqlModel {
  public name: string;
  public uri: string;
  public description?: string;
  public researchDomains: ResearchDomain[];
  public keywords: string[];

  private tableName = 'metadataStandards';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.id = options.id;
    this.name = options.name;
    this.uri = options.uri;
    this.description = options.description;
    this.researchDomains = options.researchDomains ?? [];
    this.keywords = options.keywords ?? [];
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.name) this.addError('name', 'Name can\'t be blank');
    if (!validateURL(this.uri)) this.addError ('uri', 'Invalid URL');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    if (!Array.isArray(this.researchDomains)) {
      this.researchDomains = []
    }
    if (!Array.isArray(this.keywords)) {
      this.keywords = []
    }
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.uri = this.uri?.trim();

    // make sure all keywords are lower cased and trimmed
    this.keywords = this.keywords.filter((item) => item).map((entry) => entry.toLowerCase().trim());
  }

  // Some of the properties are stored as JSON strings in the DB so we need to parse them
  // after fetching them
  static processResult(metadataStandard: MetadataStandard): MetadataStandard {
    if (metadataStandard?.keywords && typeof metadataStandard.keywords === 'string') {
      metadataStandard.keywords = JSON.parse(metadataStandard.keywords);
    }
    return metadataStandard;
  }

  //Create a new MetadataStandard
  async create(context: MyContext): Promise<MetadataStandard> {
    const reference = 'MetadataStandard.create';

    // If no URI is present, then use the DMPTool's default URI
    if (!this.uri) {
      this.uri = `${DEFAULT_DMPTOOL_METADATA_STANDARD_URL}${randomHex(6)}`;
    }

    this.prepForSave();
    // First make sure the record is valid
    if (await this.isValid()) {
      let current = await MetadataStandard.findByURI(reference, context, this.uri);
      if (!current) {
        current = await MetadataStandard.findByName(reference, context, this.name.toString());
      }

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'MetadataStandard already exists');
      } else {
        // Save the record and then fetch it
        const newId = await MetadataStandard.insert(context, this.tableName, this, reference, ['researchDomains']);
        const response = await MetadataStandard.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new MetadataStandard(this);
  }

  //Update an existing MetadataStandard
  async update(context: MyContext, noTouch = false): Promise<MetadataStandard> {
    const id = this.id;

    this.prepForSave();
    if (await this.isValid()) {
      if (id) {
        await MetadataStandard.update(
          context,
          this.tableName,
          this,
          'MetadataStandard.update',
          ['researchDomains'],
          noTouch
        );

        return await MetadataStandard.findById('MetadataStandard.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'MetadataStandard has never been saved');
    }
    return new MetadataStandard(this);
  }

  //Delete the MetadataStandard
  async delete(context: MyContext): Promise<MetadataStandard> {
    if (this.id) {
      const deleted = await MetadataStandard.findById('MetadataStandard.delete', context, this.id);

      const successfullyDeleted = await MetadataStandard.delete(
        context,
        this.tableName,
        this.id,
        'MetadataStandard.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Search for Metadata standards
  static async search(
    reference: string,
    context: MyContext,
    term: string,
    researchDomainId: number,
    options: PaginationOptions = MetadataStandard.getDefaultPaginationOptions()
  ): Promise<PaginatedQueryResults<MetadataStandard>> {
    const whereFilters = [];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(m.name) LIKE ? OR LOWER(m.keywords) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    if (researchDomainId) {
      whereFilters.push('msrd.researchDomainId = ?');
      values.push(researchDomainId.toString());
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'm.name';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'ASC';

    // Specify the fields available for sorting
    options.availableSortFields = ['m.name', 'm.created'];
    // Specify the field we want to use for the count
    options.countField = 'm.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'm.id';
    }

    const sqlStatement = 'SELECT m.* FROM metadataStandards m ' +
                          'LEFT OUTER JOIN metadataStandardResearchDomains msrd ON m.id = msrd.metadataStandardId';

    const response: PaginatedQueryResults<MetadataStandard> = await MetadataStandard.queryWithPagination(
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

  // Fetch a MetadataStandard by it's id
  static async findById(reference: string, context: MyContext, metadataStandardId: number): Promise<MetadataStandard> {
    const sql = `SELECT * FROM metadataStandards WHERE id = ?`;
    const results = await MetadataStandard.query(context, sql, [metadataStandardId?.toString()], reference);
    if (Array.isArray(results) && results.length !== 0){
      return MetadataStandard.processResult(new MetadataStandard(results[0]));
    }
    return null;
  }

  static async findByURI(reference: string, context: MyContext, uri: string): Promise<MetadataStandard> {
    const sql = `SELECT * FROM metadataStandards WHERE uri = ?`;
    const results = await MetadataStandard.query(context, sql, [uri], reference);
    if (Array.isArray(results) && results.length !== 0){
      return MetadataStandard.processResult(new MetadataStandard(results[0]));
    }
    return null;
  }

    static async findByURIs(reference: string, context: MyContext, uris: string[]): Promise<MetadataStandard[]> {
    if (!Array.isArray(uris) || uris.length === 0) {
      return [];
    }
    // Create placeholders for each URI
    const placeholders = uris.map(() => '?').join(', ');
    const sql = `SELECT * FROM metadataStandards WHERE uri IN (${placeholders})`;
    const results = await MetadataStandard.query(context, sql, uris, reference);
    if (Array.isArray(results) && results.length !== 0) {
      return results.map((row) => MetadataStandard.processResult(new MetadataStandard(row)));
    }
    return [];
  }

  static async findByName(reference: string, context: MyContext, name: string): Promise<MetadataStandard> {
    const sql = `SELECT * FROM metadataStandards WHERE LOWER(name) = ?`;
    const results = await MetadataStandard.query(context, sql, [name?.toLowerCase()?.trim()], reference);
    if (Array.isArray(results) && results.length !== 0){
      return MetadataStandard.processResult(new MetadataStandard(results[0]));
    }
    return null;
  }

  // Fetch all of the MetadataStandards associated with a ResearchDomain
  static async findByResearchDomainId(
    reference: string,
    context: MyContext,
    researchDomainId: number
  ): Promise<MetadataStandard[]> {
    const sql = 'SELECT ms.* FROM metadataStandards ms';
    const joinClause = 'INNER JOIN metadataStandardResearchDomains msrd ON ms.id = msrd.metadataStandardId';
    const whereClause = 'WHERE msrd.researchDomainId = ?';
    const vals = [researchDomainId?.toString()];

    const results = await MetadataStandard.query(context, `${sql} ${joinClause} ${whereClause}`, vals, reference);
    if (Array.isArray(results) && results.length !== 0){
      return results.map((res) => MetadataStandard.processResult(res))
    }
    return [];
  }
};
