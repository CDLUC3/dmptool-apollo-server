import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined, randomHex, validateURL } from "../utils/helpers";
import { PaginatedQueryResults, PaginationOptions, PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { prepareObjectForLogs } from "../logger";

export const DEFAULT_DMPTOOL_AFFILIATION_URL = 'https://dmptool.org/affiliations/';
export const DEFAULT_ROR_AFFILIATION_URL = 'https://ror.org/';
export const ROR_REGEX = /^https?:\/\/ror\.org\/[0-9a-zA-Z]+$/;

// The provenance of an Affiliation record
// Users can only update certain properties for records managed by other systems.
export enum AffiliationProvenance {
  DMPTOOL = 'DMPTOOL', // Affiliations added directly into the DMPTool (uses the URL above)
  ROR = 'ROR', // Affiliations managed by the Research Organization Registry (ROR) https://ror.org
}

// Affiliation types
export enum AffiliationType {
  EDUCATION = 'EDUCATION',
  NONPROFIT = 'NONPROFIT',
  GOVERNMENT = 'GOVERNMENT',
  FACILITY = 'FACILITY',
  COMPANY = 'COMPANY',
  HEALTHCARE = 'HEALTHCARE',
  ARCHIVE = 'ARCHIVE',
  OTHER = 'OTHER',
}

// Represents an Institution, Organization or Company
export class Affiliation extends MySqlModel {
  // These fields can only be modified if the record is managed by the DMPTool
  public uri: string;
  public active: boolean;
  public provenance: AffiliationProvenance;
  public name!: string;
  public displayName: string;
  public searchName: string;
  public funder: boolean;
  public fundrefId: string;
  public homepage: string;
  public acronyms: string[];
  public aliases: string[];
  public types: AffiliationType[];

  public managed: boolean;
  public logoURI: string;
  public logoName: string;
  public contactEmail: string;
  public contactName: string;
  public ssoEntityId: string;
  public feedbackEnabled: boolean;
  public feedbackMessage: string;
  public feedbackEmails: string[];
  public apiTarget: string;

  public uneditableProperties: string[];

  private tableName = 'affiliations';

  // Initialize a new Affiliation
  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById);

    // These fields can only be modified if the record is managed by the DMPTool
    this.uri = options.uri;
    this.active = options.active ?? true;
    this.provenance = options.provenance ?? AffiliationProvenance.DMPTOOL;
    this.name = options.name;
    this.displayName = options.displayName;
    this.searchName = options.searchName;
    this.funder = options.funder ?? false;
    this.fundrefId = options.fundrefId
    this.homepage = options.homepage;
    this.acronyms = options.acronyms ?? [];
    this.aliases = options.aliases ?? [];
    this.types = options.types ?? [AffiliationType.OTHER];

    // Properties specific to the DMPTool. These can be modified regardless of the record's provenance
    this.managed = options.managed;
    this.logoURI = options.logoURI;
    this.logoName = options.logoName;
    this.contactEmail = options.contactEmail;
    this.contactName = options.contactName;
    this.ssoEntityId = options.ssoEntityId;
    this.feedbackEnabled = options.feedbackEnabled;
    this.feedbackMessage = options.feedbackMessage;
    this.feedbackEmails = options.feedbackEmails;

    // We're proxying calls to funder APIs through the DMPHub API for now. This may change in the future
    this.apiTarget = options.apiTarget;

    this.uneditableProperties = ['uri', 'provenance', 'searchName'];

    // Records owned by the DMPTool can edit these additional properties
    if (this.provenance === AffiliationProvenance.ROR) {
      ['name', 'funder', 'fundrefId', 'homepage', 'acronyms', 'aliases', 'types'].forEach((entry) => {
        this.uneditableProperties.push(entry);
      });
    }
  }

  // Validate the Affiliation
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!validateURL(this.uri)) this.addError('uri', 'Invalid URL');
    if (!this.name) this.addError('name', 'Name can\'t be blank');
    if (!this.displayName) this.addError('displayName', 'Display name can\'t be blank');
    if (!this.searchName) this.addError('searchName', 'Search name can\'t be blank');
    if (!this.provenance) this.addError('provenance', 'Provenance can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Convert the name, homepage, acronyms and aliases into a search string
  buildSearchName(): string {
    const parts = [this.name, this.getDomain(), this.acronyms, this.aliases];
    return parts.flat().filter((item) => !isNullOrUndefined(item)).join(' | ').substring(0, 249);
  }

  // Get the domain from the homepage
  getDomain(): string {
    try {
      const url = new URL(this.homepage);
      return url.hostname;
    } catch {
      // It's not a URL so just return as is
      return this.homepage;
    }
  }

  // Perform tasks necessary to prepare the data to be saved
  prepForSave(): void {
    this.name = this.name?.trim();
    this.managed = this.managed ?? false;
    this.feedbackEnabled = this.feedbackEnabled ?? false;
    this.acronyms = this.acronyms ?? [];
    this.aliases = this.aliases ?? [];
    this.types = this.types ?? [AffiliationType.OTHER];
    this.feedbackEmails = this.feedbackEmails ?? [];
    this.searchName = this.buildSearchName();
    if (!this.displayName) {
      this.displayName = this.homepage ? `${this.name} (${this.getDomain()})` : this.name;
    }
  }

  // Save the current record
  async create(context: MyContext): Promise<Affiliation> {
    let current;

    // First make sure the record doesn't already exist based on the URI
    if (this.uri) {
      current = await Affiliation.findByURI('Affiliation.create', context, this.uri);
    } else {
      // Assign a new DMPTool id if one was not provided (meaning it was manually added by a user)
      this.uri = `${DEFAULT_DMPTOOL_AFFILIATION_URL}${randomHex(6)}`;
    }

    current = current ?? await Affiliation.findByName('Affiliation.create', context, this.name);

    // Then make sure it doesn't already exist
    if (current) {
      this.addError('general', 'The Affiliation already exists');
      return current;
    } else {
      // Save the record and then fetch it
      this.prepForSave();

      if (await this.isValid()) {
        const newId = await Affiliation.insert(
          context,
          this.tableName,
          this,
          'Affiliation.create',
          ['uneditableProperties']
        );
        return await Affiliation.findById('Affiliation.create', context, newId);
      }
    }

    // Otherwise return as-is with all the errors
    return this;
  }

  // Save the changes made to the affiliation
  async update(context: MyContext): Promise<Affiliation> {
    const reference = 'Affiliation.update';
    if (this.id) {
      if (await this.isValid()) {
        const existing = await Affiliation.findById(reference, context, this.id);

        // If the record is NOT managed by the DMP Tool then do not allow some fields to be changed
        if (this.provenance !== AffiliationProvenance.DMPTOOL) {
          this.uri = existing.uri;
          this.name = existing.name;
          this.provenance = existing.provenance;
          this.funder = existing.funder;
          this.types = existing.types;
          this.fundrefId = existing.fundrefId;
          this.homepage = existing.homepage;
          this.aliases = existing.aliases;
          this.acronyms = existing.acronyms;
        }

        // The following fields can never be modified here, they are auto-managed
        this.provenance = existing.provenance;
        this.searchName = existing.searchName;
        this.prepForSave();

        const updated = await Affiliation.update(
          context,
          this.tableName,
          this,
          reference,
          ['uneditableProperties', this.uneditableProperties].flat()
        );

        if (updated) {
          return await Affiliation.findById(reference, context, this.id);
        }
      }
    } else {
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Affiliation has never been saved');
    }
    // Return the affiliation as-is with all the errors
    return this;
  }

  // Delete this record (will cascade delate all associated AffiliationLinks and AffiliaitonEmailDomains)
  async delete(context: MyContext): Promise<Affiliation> {
    if (this.uri) {
      const result = await Affiliation.delete(context, this.tableName, this.id, 'Affiliation.delete');
      if (result) {
        return this;
      }
    }
    return null;
  }

  // Some of the properties are stored as JSON strings in the DB so we need to parse them
  // after fetching them
  static processResult(affiliation: Affiliation): Affiliation {
    if (affiliation?.aliases && typeof affiliation.aliases === 'string') {
      affiliation.aliases = JSON.parse(affiliation.aliases);
    }
    if (affiliation?.acronyms && typeof affiliation.acronyms === 'string') {
      affiliation.acronyms = JSON.parse(affiliation.acronyms);
    }
    if (affiliation?.feedbackEmails && typeof affiliation.feedbackEmails === 'string') {
      affiliation.feedbackEmails = JSON.parse(affiliation.feedbackEmails);
    }

    // Only include types that are in the enum
    if (affiliation?.types && typeof affiliation.types === 'string') {
      const types = JSON.parse(affiliation.types);
      affiliation.types = [];

      for (const typ of types) {
        if (AffiliationType[typ.toLocaleUpperCase()] !== undefined) {
          affiliation.types.push(AffiliationType[typ.toLocaleUpperCase()]);
        }
      }
    }
    return new Affiliation(affiliation);
  }

  // Return the specified Affiliation  based on the DB id
  static async findById(reference: string, context: MyContext, id: number): Promise<Affiliation> {
    const sql = 'SELECT * FROM affiliations WHERE id = ?';
    const results = await Affiliation.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Return the specified Affiliation based on the URI
  static async findByURI(reference: string, context: MyContext, uri: string): Promise<Affiliation> {
    const sql = 'SELECT * FROM affiliations WHERE uri = ?';
    const results = await Affiliation.query(context, sql, [uri], reference);
    return Array.isArray(results) && results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Return the specified Affiliation based on it's name
  static async findByName(reference: string, context: MyContext, name: string): Promise<Affiliation> {
    const sql = 'SELECT * FROM affiliations WHERE TRIM(LOWER(name)) = ?';
    const results = await Affiliation.query(context, sql, [name?.toLowerCase()?.trim()], reference);
    return Array.isArray(results) && results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Return the specified Affiliation based on it's SSO entity id
  static async findByEntityId(reference: string, context: MyContext, entityId: string): Promise<Affiliation> {
    const sql = 'SELECT * FROM affiliations WHERE TRIM(LOWER(ssoEntityId)) = ?';
    const results = await Affiliation.query(context, sql, [entityId?.toLowerCase()?.trim()], reference);
    return Array.isArray(results) && results.length > 0 ? this.processResult(results[0]) : null;
  }
}

// A pared down version of the full Affiliation object. This type is returned by
// our index searches
export class AffiliationSearch {
  public id!: number;
  public uri!: string;
  public displayName!: string;
  public funder!: boolean;
  public types: AffiliationType[];
  public apiTarget!: string;

  // Initialize a new AffiliationSearch result
  constructor(options) {
    this.id = options.id;
    this.uri = options.uri;
    this.displayName = options.displayName;
    this.funder = options.funder ?? false;
    this.types = options.types ?? [AffiliationType.OTHER];

    // We're proxying calls to funder APIs through the DMPHub API for now. This may change in the future
    this.apiTarget = options.apiTarget;
  }

  // Some of the properties are stored as JSON strings in the DB so we need to parse them
  // after fetching them
  static processResult(affiliation: AffiliationSearch): AffiliationSearch {
    // Only include types that are in the enum
    if (affiliation?.types && typeof affiliation.types === 'string') {
      const types = JSON.parse(affiliation.types);
      affiliation.types = [];

      for (const typ of types) {
        if (AffiliationType[typ.toLocaleUpperCase()] !== undefined) {
          affiliation.types.push(AffiliationType[typ.toLocaleUpperCase()]);
        }
      }
    }
    return new AffiliationSearch(affiliation);
  }

  // Search for Affiliations that match the term and the funder flag
  static async search(
    reference: string,
    context: MyContext,
    name: string,
    funderOnly: boolean,
    options: PaginationOptions = Affiliation.getDefaultPaginationOptions(),
  ): Promise<PaginatedQueryResults<AffiliationSearch>> {
    const whereFilters = ['a.active = 1'];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (name ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(a.searchName) LIKE ?)');
      values.push(`%${searchTerm}%`);
    }
    if (funderOnly) {
      whereFilters.push('a.funder = 1');
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'a.displayName';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'ASC';

    // Specify the fields available for sorting
    options.availableSortFields = ['a.displayName', 'a.created'];
    // Specify the field we want to use for the count
    options.countField = 'a.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'a.id';
    }

    const sqlStatement = 'SELECT a.* FROM affiliations a';

    const response: PaginatedQueryResults<AffiliationSearch> = await Affiliation.queryWithPagination(
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

  static async searchManagedWithPublishedGuidance(
    reference: string,
    context: MyContext,
    name?: string,
    options: PaginationOptions = Affiliation.getDefaultPaginationOptions(),
  ): Promise<PaginatedQueryResults<AffiliationSearch>> {
    const whereFilters = [
      'a.active = 1',
      'a.managed = 1',
    ];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (name ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm) && searchTerm !== '') {
      whereFilters.push('(LOWER(a.searchName) LIKE ?)');
      values.push(`%${searchTerm}%`);
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'a.displayName';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'ASC';

    // Specify the fields available for sorting
    options.availableSortFields = ['a.displayName', 'a.created'];
    // Specify the field we want to use for the count
    options.countField = 'a.id';

    // Determine the type of pagination we are using
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'a.id';
    }

    // Join to guidance groups and guidance to ensure published guidance exists
    const sqlStatement = `
      SELECT a.* 
      FROM affiliations a
      INNER JOIN guidanceGroups gg ON gg.affiliationId = a.uri
      INNER JOIN guidance g ON g.guidanceGroupId = gg.id
    `;

    // And add GROUP BY to handle duplicates:
    const groupByClause = 'GROUP BY a.id';

    // Add filters for published guidance groups and guidance created before publication
    whereFilters.push('gg.latestPublishedDate IS NOT NULL');
    whereFilters.push('g.created <= gg.latestPublishedDate');

    const response: PaginatedQueryResults<AffiliationSearch> = await Affiliation.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      opts,
      reference,
    );

    return response;
  }
}


// Funder popularity result based on the number of plans associated with the funder over the past year
export class PopularFunder {
  public id: number;
  public uri: string;
  public displayName: string;
  public apiTarget: string;
  public nbrPlans: number;

  constructor(options) {
    this.id = options.id;
    this.uri = options.uri;
    this.displayName = options.displayName;
    this.apiTarget = options.apiTarget;
    this.nbrPlans = options.nbrPlans;
  }

  static async top5(context: MyContext): Promise<PopularFunder[]> {
    // Get the date range for the past year
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);
    const startDate = lastYear.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    // Get the top 5 funders based on the number of plans created in the past year
    const sql = 'SELECT a.id, a.uri, a.displayName, a.apiTarget, COUNT(p.id) AS nbrPlans ' +
      'FROM affiliations a ' +
      'LEFT JOIN projectFundings pf ON pf.affiliationId = a.uri ' +
      'LEFT JOIN projects p ON p.id = pf.projectId ' +
      'WHERE a.active = 1 AND a.funder = 1 AND p.isTestProject = 0 AND p.created BETWEEN ? AND ? ' +
      'GROUP BY a.id, a.uri, a.displayName ' +
      'ORDER BY nbrPlans DESC LIMIT 5';
    const results = await Affiliation.query(
      context,
      sql,
      [`${startDate} 00:00:00`, `${endDate} 23:59:59`],
      'PopularFunder.top5'
    );
    if (Array.isArray(results) && results.length > 0) {
      return results.map((entry) => { return new PopularFunder(entry) });
    }
    return [];
  }
}
