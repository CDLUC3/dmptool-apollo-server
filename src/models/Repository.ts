import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import { PaginatedQueryResults, PaginationOptions, PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, randomHex, validateURL } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { ResearchDomain } from "./ResearchDomain";

export const DEFAULT_DMPTOOL_REPOSITORY_URL = 'https://dmptool.org/repositories/';;

export enum RepositoryType {
  OTHER = 'OTHER',                // A repository that doesn't fit into any of the other categories
  GOVERNMENTAL = 'GOVERNMENTAL',  // A repository owned and managed by a government entity (e.g. NCBI, NASA)
  PROJECT_RELATED = 'PROJECT_RELATED', // A repository created to support a specific project or initiative (e.g. Human Genome Project)
  GENERALIST = 'GENERALIST',        // A general purpose repository to store any output type (e.g. Dryad, Zenodo)
  DISCIPLINARY = 'DISCIPLINARY',    // A repository that stores discipline specific output (e.g. genomes, DNA)
  MULTI_DISCIPLINARY = 'MULTI_DISCIPLINARY', // A repository that accepts any type of dataset, from any discipline. Often used when no disciplinary repository exists.
  INSTITUTIONAL = 'INSTITUTIONAL',  // A repository owned and managed by a specific institution (e.g. UC, Stanford)
}

export class Repository extends MySqlModel {
  public name: string;
  public uri: string;
  public description?: string;
  public website?: string;
  public researchDomains: ResearchDomain[];
  public repositoryTypes: RepositoryType[];
  public keywords: string[];

  private tableName = 'repositories';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.id = options.id;
    this.name = options.name;
    this.uri = options.uri;
    this.description = options.description;
    this.website = options.website;
    this.researchDomains = options.researchDomains ?? [];
    this.repositoryTypes = options.repositoryTypes ?? [];
    this.keywords = options.keywords ?? [];
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.name) this.addError('name', 'Name can\'t be blank');
    if (!validateURL(this.uri)) this.addError('uri', 'Invalid URL');
    if (this.website && !validateURL(this.website)) this.addError('website', 'Invalid website format');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    if (!Array.isArray(this.researchDomains)) {
      this.researchDomains = []
    }
    if (!Array.isArray(this.repositoryTypes)) {
      this.repositoryTypes = []
    }
    if (!Array.isArray(this.keywords)) {
      this.keywords = []
    }
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.uri = this.uri?.trim();
    this.description = this.description?.trim();
    this.website = this.website?.trim();

    // make sure all keywords are lower cased and trimmed
    this.keywords = this.keywords.filter((item) => item).map((entry) => entry.toLowerCase().trim());
  }

  // Some of the properties are stored as JSON strings in the DB so we need to parse them
  // after fetching them
  static processResult(repository: Repository): Repository {
    if (repository?.keywords && typeof repository.keywords === 'string') {
      repository.keywords = JSON.parse(repository.keywords);
    }

    // Parse and transform repositoryTypes from database format to enum formats replacing lowercase to uppercase and hyphens to underscores
    if (repository?.repositoryTypes) {
      let parsed;
      if (typeof repository.repositoryTypes === 'string') {
        parsed = JSON.parse(repository.repositoryTypes);
      } else if (Array.isArray(repository.repositoryTypes)) {
        parsed = repository.repositoryTypes;
      }

      if (Array.isArray(parsed)) {
        repository.repositoryTypes = parsed.map((type: string) =>
          type.toUpperCase().replace(/-/g, '_') as RepositoryType
        );
      }
    }
    return repository;
  }

  //Create a new Repository
  async create(context: MyContext): Promise<Repository> {
    const reference = 'Repository.create';

    // If no URI is present, then use the DMP Tool's default URI
    if (!this.uri) {
      this.uri = `${DEFAULT_DMPTOOL_REPOSITORY_URL}${randomHex(6)}`;
    }

    this.prepForSave();
    // First make sure the record is valid
    if (await this.isValid()) {
      let current = await Repository.findByURI(reference, context, this.uri);
      if (!current) {
        current = await Repository.findByName(reference, context, this.name.toString());
      }

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Repository already exists');
      } else {
        // Save the record and then fetch it
        const newId = await Repository.insert(context, this.tableName, this, reference, ['researchDomains']);
        const response = await Repository.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new Repository(this);
  }

  //Update an existing Repository
  async update(context: MyContext, noTouch = false): Promise<Repository> {
    const id = this.id;

    this.prepForSave();
    if (await this.isValid()) {
      if (id) {
        await Repository.update(context, this.tableName, this, 'Repository.update', ['researchDomains'], noTouch);
        return await Repository.findById('Repository.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Repository has never been saved');
    }
    return new Repository(this);
  }

  //Delete the Repository
  async delete(context: MyContext): Promise<Repository> {
    if (this.id) {
      const deleted = await Repository.findById('Repository.delete', context, this.id);

      const successfullyDeleted = await Repository.delete(
        context,
        this.tableName,
        this.id,
        'Repository.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Search for Repositories
  static async search(
    reference: string,
    context: MyContext,
    term: string,
    researchDomainId: number,
    keyword: string,
    repositoryType: RepositoryType,
    options: PaginationOptions = Repository.getDefaultPaginationOptions()
  ): Promise<PaginatedQueryResults<Repository>> {
    const whereFilters = [];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(r.name) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.keywords) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }
    // Handle the incoming repository type
    if (repositoryType) {
      whereFilters.push('JSON_CONTAINS(r.repositoryTypes, ?, \'$\')');
      values.push(JSON.stringify(repositoryType.toLowerCase().replace(/_/g, '-')));
    }
    // Handle the incoming research domain
    if (researchDomainId) {
      whereFilters.push('rrd.researchDomainId = ?');
      values.push(researchDomainId.toString());
    }
    // Handle the incoming keyword
    if (keyword) {
      const searchKeyword = keyword.toLowerCase().trim();
      whereFilters.push('JSON_CONTAINS(r.keywords, ?, \'$\')'); //use JSON_CONTAINS to search within the JSON array
      values.push(JSON.stringify(searchKeyword));
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'r.name';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'ASC';

    // Specify the fields available for sorting
    options.availableSortFields = ['r.name', 'r.created'];
    // Specify the field we want to use for the count
    options.countField = 'r.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'r.id';
    }

    const sqlStatement = 'SELECT r.* FROM repositories r ' +
                          'LEFT OUTER JOIN repositoryResearchDomains rrd ON r.id = rrd.repositoryId';

    const response: PaginatedQueryResults<Repository> = await Repository.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    )

    // Process each repository result to transform repositoryTypes from database format
    if (response?.items && Array.isArray(response.items)) {
      response.items = response.items.map((item) => Repository.processResult(new Repository(item)));
    }

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }

  // Fetch a Repository by it's id
  static async findById(reference: string, context: MyContext, repositoryId: number): Promise<Repository> {
    const sql = `SELECT * FROM repositories WHERE id = ?`;
    const results = await Repository.query(context, sql, [repositoryId?.toString()], reference);
    if (Array.isArray(results) && results.length !== 0) {
      return Repository.processResult(new Repository(results[0]));
    }
    return null;
  }

  static async findByURI(reference: string, context: MyContext, uri: string): Promise<Repository> {
    const sql = `SELECT * FROM repositories WHERE uri = ?`;
    const results = await Repository.query(context, sql, [uri], reference);
    if (Array.isArray(results) && results.length !== 0) {
      return Repository.processResult(new Repository(results[0]));
    }
    return null;
  }

  static async findByName(reference: string, context: MyContext, name: string): Promise<Repository> {
    const sql = `SELECT * FROM repositories WHERE LOWER(name) = ?`;
    const searchTerm = (name ?? '');
    const results = await Repository.query(context, sql, [searchTerm?.toLowerCase()?.trim()], reference);
    if (Array.isArray(results) && results.length !== 0) {
      return Repository.processResult(new Repository(results[0]));
    }
    return null;
  }

  // Fetch all of the Repositories associated with a ResearchDomain
  static async findByResearchDomainId(
    reference: string,
    context: MyContext,
    researchDomainId: number
  ): Promise<Repository[]> {
    const sql = 'SELECT r.* FROM repositories r';
    const joinClause = 'INNER JOIN repositoryResearchDomains rrd ON r.id = rrd.repositoryId';
    const whereClause = 'WHERE rrd.researchDomainId = ?';
    const vals = [researchDomainId?.toString()];
    const results = await Repository.query(context, `${sql} ${joinClause} ${whereClause}`, vals, reference);
    // No need to reinitialize all of the results to objects here because they're just search results
    if (Array.isArray(results) && results.length !== 0) {
      return results.map((res) => Repository.processResult(res))
    }
    return [];
  }

  // Fetch all distinct keywords across all repositories
  static async findAllDistinctKeywords(
    reference: string,
    context: MyContext
  ): Promise<string[]> {
    const sql = `
      SELECT DISTINCT jt.keyword
      FROM repositories
      CROSS JOIN JSON_TABLE(
        repositories.keywords,
        '$[*]' COLUMNS (
          keyword VARCHAR(255) PATH '$'
        )
      ) AS jt
      ORDER BY jt.keyword
    `;
    const results = await Repository.query(context, sql, [], reference);
    if (Array.isArray(results) && results.length !== 0) {
      return results.map((row) => row.keyword);
    }
    return [];
  }
};
