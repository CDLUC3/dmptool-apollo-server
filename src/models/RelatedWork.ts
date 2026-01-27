import { MyContext } from '../context';
import { isNullOrUndefined, valueIsEmpty } from '../utils/helpers';
import { MySqlModel } from './MySqlModel';
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType,
} from '../types/general';
import {
  ContentMatch,
  DoiMatch,
  ItemMatch,
  RelatedWorksFilterOptions,
  Author,
  Funder,
  Institution,
  Award,
} from '../types';
import { prepareObjectForLogs } from '../logger';
import { Plan } from './Plan';

export class Work extends MySqlModel {
  public id: number;
  public doi: string;

  private static tableName = 'works';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);
    this.doi = options.doi;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.doi)) this.addError('doi', "DOI can't be blank");

    return Object.keys(this.errors).length === 0;
  }

  prepForSave(): void {
    // Only store the DOI identifier not full URL
    this.doi = parseDOI(this.doi);
  }

  async create(context: MyContext): Promise<Work> {
    const reference = 'Work.create';

    // First make sure the record is valid
    this.prepForSave();
    if (await this.isValid()) {
      const current = await Work.findByDoi(reference, context, this.doi);

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Work already exists');
      } else {
        // Save the record and then fetch it
        const newId = await Work.insert(context, Work.tableName, this, reference);
        return await Work.findById(reference, context, newId);
      }
    }

    // Otherwise return as-is with all the errors
    return new Work(this);
  }

  async update(context: MyContext, noTouch = false): Promise<Work> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        await Work.update(context, Work.tableName, this, 'Work.update', [], noTouch);
        return await Work.findById('Work.update', context, id);
      }
      this.addError('general', 'Work has never been saved');
    }
    return new Work(this);
  }

  async delete(context: MyContext): Promise<Work> {
    if (this.id) {
      const deleted = await Work.findById('Work.delete', context, this.id);

      const successfullyDeleted = await Work.delete(context, Work.tableName, this.id, 'Work.delete');
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null;
      }
    }
    return null;
  }

  // Fetch a Work by its id
  static async findById(reference: string, context: MyContext, workId: number): Promise<Work> {
    const sql = `SELECT * FROM works WHERE id = ?`;
    const results = await Work.query(context, sql, [workId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Work(results[0]) : null;
  }

  // Fetch a Work by its DOI
  static async findByDoi(reference: string, context: MyContext, doi: string): Promise<Work> {
    const sql = `SELECT * FROM works WHERE doi = ?`;
    const results = await Work.query(context, sql, [doi], reference);
    return Array.isArray(results) && results.length > 0 ? new Work(results[0]) : null;
  }
}

export const parseDOI = (doi: string | undefined | null): string => {
  if (isNullOrUndefined(doi)) return null;

  const trimmed = doi.trim();

  try {
    // Parse URL, get pathname and decode
    const url = new URL(trimmed);
    return decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  } catch (error) {
    // Non URL based DOI
    try {
      return decodeURIComponent(trimmed).toLowerCase();
    } catch (e) {
      return trimmed.toLowerCase();
    }
  }
};

export class WorkVersion extends MySqlModel {
  public id: number;
  public workId: number;
  public hash: Buffer;
  public workType: WorkType;
  public publicationDate: string;
  public title: string;
  public abstractText: string;
  public authors: Author[];
  public institutions: Institution[];
  public funders: Funder[];
  public awards: Award[];
  public publicationVenue: string;
  public sourceName: string;
  public sourceUrl: string;

  private static tableName = 'workVersions';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);
    this.workId = options.workId;
    this.hash = options.hash;
    this.workType = options.workType;
    this.publicationDate = options.publicationDate;
    this.title = options.title;
    this.abstractText = options.abstractText;
    this.authors = options.authors;
    this.institutions = options.institutions;
    this.funders = options.funders;
    this.awards = options.awards;
    this.publicationVenue = options.publicationVenue;
    this.sourceName = options.sourceName;
    this.sourceUrl = options.sourceUrl;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.workId)) this.addError('workId', "Work ID can't be blank");
    if (isNullOrUndefined(this.hash)) this.addError('hash', "Hash can't be blank");
    if (isNullOrUndefined(this.workType) || valueIsEmpty(this.workType))
      this.addError('workType', "Work type can't be blank");
    if (!this.authors) this.addError('authors', "Authors can't be blank");
    if (!this.institutions) this.addError('institutions', "Institutions can't be blank");
    if (!this.funders) this.addError('funders', "Funders can't be blank");
    if (!this.awards) this.addError('awards', "Awards can't be blank");
    if (isNullOrUndefined(this.sourceName) || valueIsEmpty(this.sourceName))
      this.addError('sourceName', "Source name can't be blank");
    if (isNullOrUndefined(this.sourceUrl) || valueIsEmpty(this.sourceUrl))
      this.addError('sourceUrl', "Source URL can't be blank");

    return Object.keys(this.errors).length === 0;
  }

  async create(context: MyContext, doi: string): Promise<WorkVersion> {
    const reference = 'WorkVersion.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await WorkVersion.findByDoiAndHash(reference, context, doi, this.hash);

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Work version already exists');
      } else {
        // Save the record and then fetch it
        const newId = await WorkVersion.insert(context, WorkVersion.tableName, this, reference);
        return await WorkVersion.findById(reference, context, newId);
      }
    }

    // Otherwise return as-is with all the errors
    return new WorkVersion(this);
  }

  async update(context: MyContext, noTouch = false): Promise<WorkVersion> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        await WorkVersion.update(context, WorkVersion.tableName, this, 'WorkVersion.update', [], noTouch);
        return await WorkVersion.findById('WorkVersion.update', context, id);
      }
      this.addError('general', 'WorkVersion has never been saved');
    }
    return new WorkVersion(this);
  }

  async delete(context: MyContext): Promise<WorkVersion> {
    if (this.id) {
      const deleted = await WorkVersion.findById('WorkVersion.delete', context, this.id);

      const successfullyDeleted = await WorkVersion.delete(
        context,
        WorkVersion.tableName,
        this.id,
        'WorkVersion.delete',
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null;
      }
    }
    return null;
  }

  // Fetch a Work by its id
  static async findById(reference: string, context: MyContext, workVersionId: number): Promise<WorkVersion> {
    const sql = `SELECT * FROM workVersions WHERE id = ?`;
    const results = await WorkVersion.query(context, sql, [workVersionId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new WorkVersion(results[0]) : null;
  }

  static async findByDoiAndHash(
    reference: string,
    context: MyContext,
    doi: string,
    hash: Buffer,
  ): Promise<WorkVersion> {
    const sql = `SELECT * FROM workVersions wv LEFT JOIN works w ON wv.workId = w.id WHERE wv.hash = ? AND w.doi = ?`;
    const results = await WorkVersion.query(context, sql, [hash, doi?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new WorkVersion(results[0]) : null;
  }
}

export class RelatedWork extends MySqlModel {
  public id: number;
  public planId: number;
  public workVersionId: number;
  public sourceType: RelatedWorkSourceType;
  public score: number;
  public scoreMax: number;
  public status: RelatedWorkStatus;
  public doiMatch: DoiMatch;
  public contentMatch: ContentMatch;
  public authorMatches: ItemMatch[];
  public institutionMatches: ItemMatch[];
  public funderMatches: ItemMatch[];
  public awardMatches: ItemMatch[];

  private static tableName = 'relatedWorks';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.workVersionId = options.workVersionId;
    this.sourceType = options.sourceType;
    this.score = options.score;
    this.scoreMax = options.scoreMax;
    this.status = options.status;
    this.doiMatch = options.doiMatch;
    this.contentMatch = options.contentMatch;
    this.authorMatches = options.authorMatches;
    this.institutionMatches = options.institutionMatches;
    this.funderMatches = options.funderMatches;
    this.awardMatches = options.awardMatches;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    if (isNullOrUndefined(this.planId)) this.addError('planId', "Plan ID can't be blank");
    if (isNullOrUndefined(this.workVersionId)) this.addError('workVersionId', "Work Version ID can't be blank");
    if (isNullOrUndefined(this.sourceType)) this.addError('sourceType', "Source type can't be blank");
    if (isNullOrUndefined(this.score)) this.addError('score', "Score can't be blank");
    if (isNullOrUndefined(this.scoreMax)) this.addError('scoreMax', "Max score can't be blank");
    if (isNullOrUndefined(this.status)) this.addError('status', "Status can't be blank");

    return Object.keys(this.errors).length === 0;
  }

  // Create a new RelatedWork
  async create(context: MyContext): Promise<RelatedWork> {
    const reference = 'RelatedWork.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      // Check that work version exists
      const workVersion = await WorkVersion.findById(reference, context, this.workVersionId);
      if (!workVersion) {
        this.addError('workVersion', 'Work version does not exist');
      }

      // Check that plan exists
      const plan = await Plan.findById(reference, context, this.planId);
      if (!plan) {
        this.addError('plan', 'Plan does not exist');
      }

      // Check that related work doesn't exist
      const current = await RelatedWork.findByPlanAndWorkVersionId(reference, context, this.planId, this.workVersionId);
      if (current) {
        this.addError('relatedWork', 'RelatedWork already exists');
      }

      if (Object.keys(this.errors).length == 0) {
        // Insert related work
        const newId = await RelatedWork.insert(context, RelatedWork.tableName, this, reference, []);
        return await RelatedWork.findById(reference, context, newId);
      }
    }

    // Otherwise return as-is with all the errors
    return new RelatedWork(this);
  }

  // Update an existing RelatedWork
  async update(context: MyContext, noTouch = false): Promise<RelatedWork> {
    if (await this.isValid()) {
      if (this.id) {
        await RelatedWork.update(context, RelatedWork.tableName, this, 'RelatedWork.update', [], noTouch);

        return await RelatedWork.findById('RelatedWork.update', context, this.id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'RelatedWork has never been saved');
    }
    return new RelatedWork(this);
  }

  // Delete the RelatedWork
  async delete(context: MyContext): Promise<RelatedWork> {
    if (this.id) {
      const deleted = await RelatedWork.findById('RelatedWork.delete', context, this.id);

      const successfullyDeleted = await RelatedWork.delete(
        context,
        RelatedWork.tableName,
        this.id,
        'RelatedWork.delete',
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null;
      }
    }
    return null;
  }

  // Find a RelatedWork by its identifier
  static async findById(reference: string, context: MyContext, id: number): Promise<RelatedWork> {
    const sql = `SELECT * FROM ${RelatedWork.tableName} WHERE id = ?`;
    const result = await RelatedWork.query(context, sql, [id.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new RelatedWork(result[0]) : null;
  }

  // Find a RelatedWork by plan and work version
  static async findByPlanAndWorkVersionId(
    reference: string,
    context: MyContext,
    planId: number,
    workVersionId: number,
  ): Promise<RelatedWork> {
    const sql = `SELECT * FROM ${RelatedWork.tableName} WHERE planId = ? AND workVersionId = ?`;
    const result = await RelatedWork.query(context, sql, [planId.toString(), workVersionId.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new RelatedWork(result[0]) : null;
  }
}

export interface RelatedWorkSearchResults<T> extends PaginatedQueryResults<T> {
  statusOnlyCount?: number;
  workTypeCounts: { count: number; typeId: string }[];
  confidenceCounts: { count: number; typeId: string }[];
}

export class RelatedWorkSearchResult extends MySqlModel {
  public id: number;
  public planId: number;
  public workVersion: {
    id: number;
    work: {
      id: number;
      doi: string;
      created: string;
      createdById: number;
      modified: string;
      modifiedById: number;
    };
    hash: Buffer;
    workType: WorkType;
    publicationDate: string;
    title: string;
    abstractText: string;
    authors: Author[];
    institutions: Institution[];
    funders: Funder[];
    awards: Award[];
    publicationVenue: string;
    sourceName: string;
    sourceUrl: string;
    created: string;
    createdById: number;
    modified: string;
    modifiedById: number;
  };
  public sourceType: RelatedWorkSourceType;
  public score: number;
  public scoreMax: number;
  public scoreNorm: number;
  public status: RelatedWorkStatus;
  public doiMatch: DoiMatch;
  public contentMatch: ContentMatch;
  public authorMatches: ItemMatch[];
  public institutionMatches: ItemMatch[];
  public funderMatches: ItemMatch[];
  public awardMatches: ItemMatch[];
  public created: string;
  public createdById: number;
  public modified: string;
  public modifiedById: number;

  public static sqlStatement =
    `SELECT ` + // requires 'SELECT ' for cursor pagination to work
    `rw.id,
      rw.planId,
      JSON_OBJECT(
       'id', wv.id,
       'work', JSON_OBJECT(
         'id', w.id,
         'doi', w.doi,
         'created', w.created,
         'createdById', w.createdById,
         'modified', w.modified,
         'modifiedById', w.modifiedById
       ),
       'hash', wv.hash,
       'workType', wv.workType,
       'publicationDate', wv.publicationDate,
       'title', wv.title,
       'authors', wv.authors,
       'institutions', wv.institutions,
       'funders', wv.funders,
       'awards', wv.awards,
       'publicationVenue', wv.publicationVenue,
       'sourceName', wv.sourceName,
       'sourceUrl', wv.sourceUrl,
       'created', wv.created,
       'createdById', wv.createdById,
       'modifiedBy', w.modified,
       'modifiedById', w.modifiedById
      ) AS workVersion,
      rw.sourceType,
      rw.score,
      rw.scoreMax,
      (rw.score / rw.scoreMax) AS scoreNorm,
      CASE
        WHEN rw.score / rw.scoreMax >= 0.7 THEN 'HIGH'
        WHEN rw.score / rw.scoreMax >= 0.4 THEN 'MEDIUM'
        ELSE 'LOW'
      END AS confidence,
      rw.status,
      rw.doiMatch,
      rw.contentMatch,
      rw.authorMatches,
      rw.institutionMatches,
      rw.funderMatches,
      rw.awardMatches,
      rw.created,
      rw.createdById,
      rw.modified,
      rw.modifiedById
    FROM relatedWorks rw
    LEFT JOIN plans p ON rw.planId = p.id
    LEFT JOIN workVersions wv ON rw.workVersionId = wv.id
    LEFT JOIN works w ON wv.workId = w.id
  `;

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.workVersion = options.workVersion;
    this.sourceType = options.sourceType;
    this.score = options.score;
    this.scoreMax = options.scoreMax;
    this.scoreNorm = options.scoreNorm;
    this.status = options.status;
    this.doiMatch = options.doiMatch;
    this.contentMatch = options.contentMatch;
    this.authorMatches = options.authorMatches;
    this.institutionMatches = options.institutionMatches;
    this.funderMatches = options.funderMatches;
    this.awardMatches = options.awardMatches;
  }

  static async search(
    reference: string,
    context: MyContext,
    projectId: number,
    planId?: number,
    filterOptions: RelatedWorksFilterOptions = {},
    options: PaginationOptions = RelatedWorkSearchResult.getDefaultPaginationOptions(),
  ): Promise<RelatedWorkSearchResults<RelatedWorkSearchResult>> {
    const whereFilters = [];
    const values = [];

    // Configure sorting
    const sortMapping = new Map<string, string>();
    sortMapping.set('scoreNorm', '(rw.score / rw.scoreMax)');
    sortMapping.set('created', 'rw.created');
    sortMapping.set('modified', 'rw.modified');
    sortMapping.set('publicationDate', 'wv.publicationDate');
    options.availableSortFields = Array.from(sortMapping.keys());

    if (!isNullOrUndefined(options.sortField) && !sortMapping.has(options.sortField)) {
      throw Error(`Sort field ${options.sortField} not found.`);
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) {
      if (filterOptions.status == 'PENDING') {
        options.sortField = 'scoreNorm';
      } else if (filterOptions.status == 'ACCEPTED') {
        options.sortField = 'created';
      } else if (filterOptions.status == 'REJECTED') {
        options.sortField = 'modified';
      } else {
        options.sortField = 'publicationDate';
      }
    }
    options.sortField = sortMapping.get(options.sortField);

    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'DESC';

    // Specify the field we want to use for the totalCount
    options.countField = 'rw.id';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'rw.id';
    }

    // Where clauses
    whereFilters.push('p.projectId = ?');
    values.push(projectId);
    if (!isNullOrUndefined(planId)) {
      whereFilters.push('rw.planId = ?');
      values.push(planId);
    }
    if (!isNullOrUndefined(filterOptions.confidence)) {
      whereFilters.push(
        "CASE WHEN rw.score / rw.scoreMax >= 0.7 THEN 'HIGH' WHEN rw.score / rw.scoreMax >= 0.4 THEN 'MEDIUM' ELSE 'LOW' END = ?",
      );
      values.push(filterOptions.confidence);
    }
    if (!isNullOrUndefined(filterOptions.workType)) {
      whereFilters.push('wv.workType = ?');
      values.push(filterOptions.workType);
    }
    if (!isNullOrUndefined(filterOptions.status)) {
      whereFilters.push('rw.status = ?');
      values.push(filterOptions.status);
    }

    // Fetch query
    const response: PaginatedQueryResults<RelatedWorkSearchResult> = await RelatedWorkSearchResult.queryWithPagination(
      context,
      this.sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    );

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);

    // Run aggregations
    const aggSql = [
      `WITH data AS (
       SELECT
         wv.workType,
         CASE
           WHEN rw.score / rw.scoreMax >= 0.7 THEN 'HIGH'
           WHEN rw.score / rw.scoreMax >= 0.4 THEN 'MEDIUM'
           ELSE 'LOW'
         END AS confidence
       FROM relatedWorks rw
       LEFT JOIN plans p ON rw.planId = p.id
       LEFT JOIN workVersions wv ON rw.workVersionId = wv.id
       LEFT JOIN works w ON wv.workId = w.id`,
    ];
    const aggValues = [];
    aggSql.push('WHERE p.projectId = ?');
    aggValues.push(projectId);
    if (!isNullOrUndefined(planId)) {
      aggSql.push('AND rw.planId = ?');
      aggValues.push(planId);
    }
    if (!isNullOrUndefined(filterOptions.status)) {
      aggSql.push('AND rw.status = ?');
      aggValues.push(filterOptions.status);
    }
    aggSql.push(')');

    aggSql.push(`
    SELECT JSON_OBJECT(
    'statusOnlyCount', (SELECT COUNT(*) FROM data),
    'workTypeCounts',
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT('typeId', workType, 'count', count)
      )
      FROM (
        SELECT workType, COUNT(*) AS count
        FROM data
    `);

    if (!isNullOrUndefined(filterOptions.confidence)) {
      aggSql.push('WHERE confidence = ?');
      aggValues.push(filterOptions.confidence);
    }
    aggSql.push(`GROUP BY workType) AS wtc),
    'confidenceCounts',
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT('typeId', confidence, 'count', count)
      )
      FROM (
      SELECT confidence, COUNT(*) as count
      FROM data
    `);
    if (!isNullOrUndefined(filterOptions.workType)) {
      aggSql.push('WHERE workType = ?');
      aggValues.push(filterOptions.workType);
    }
    aggSql.push(`GROUP BY confidence) AS cc)) AS result;`);

    const aggResults = await RelatedWorkSearchResult.query(context, aggSql.join('\n'), aggValues, reference);

    if (Array.isArray(aggResults) && aggResults.length > 0) {
      return {
        ...response,
        statusOnlyCount: aggResults[0]?.result?.statusOnlyCount ?? 0,
        workTypeCounts: aggResults[0]?.result?.workTypeCounts ?? [],
        confidenceCounts: aggResults[0]?.result?.confidenceCounts ?? [],
      };
    }

    return {
      ...response,
      statusOnlyCount: 0,
      workTypeCounts: [],
      confidenceCounts: [],
    };
  }

  // Find a RelatedWorkSearchResult by its identifier
  static async findById(reference: string, context: MyContext, id: number): Promise<RelatedWorkSearchResult> {
    const sql = `${this.sqlStatement} WHERE rw.id = ?`;
    const result = await RelatedWorkSearchResult.query(context, sql, [id.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new RelatedWorkSearchResult(result[0]) : null;
  }
}

export enum WorkType {
  ARTICLE = 'ARTICLE',
  AUDIO_VISUAL = 'AUDIO_VISUAL',
  BOOK = 'BOOK',
  BOOK_CHAPTER = 'BOOK_CHAPTER',
  COLLECTION = 'COLLECTION',
  DATASET = 'DATASET',
  DATA_PAPER = 'DATA_PAPER',
  DISSERTATION = 'DISSERTATION',
  EDITORIAL = 'EDITORIAL',
  ERRATUM = 'ERRATUM',
  EVENT = 'EVENT',
  GRANT = 'GRANT',
  IMAGE = 'IMAGE',
  INTERACTIVE_RESOURCE = 'INTERACTIVE_RESOURCE',
  LETTER = 'LETTER',
  LIBGUIDES = 'LIBGUIDES',
  MODEL = 'MODEL',
  OTHER = 'OTHER',
  PARATEXT = 'PARATEXT',
  PEER_REVIEW = 'PEER_REVIEW',
  PHYSICAL_OBJECT = 'PHYSICAL_OBJECT',
  PREPRINT = 'PREPRINT',
  REFERENCE_ENTRY = 'REFERENCE_ENTRY',
  REPORT = 'REPORT',
  RETRACTION = 'RETRACTION',
  REVIEW = 'REVIEW',
  SERVICE = 'SERVICE',
  SOFTWARE = 'SOFTWARE',
  SOUND = 'SOUND',
  STANDARD = 'STANDARD',
  SUPPLEMENTARY_MATERIALS = 'SUPPLEMENTARY_MATERIALS',
  TEXT = 'TEXT',
  WORKFLOW = 'WORKFLOW',
}

export enum RelatedWorkStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum RelatedWorkSourceType {
  USER_ADDED = 'USER_ADDED',
  SYSTEM_MATCHED = 'SYSTEM_MATCHED',
}
