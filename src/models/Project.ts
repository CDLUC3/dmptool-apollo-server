import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from "../types/general";
import { isNullOrUndefined, validateDate } from "../utils/helpers";
import { MySqlModel } from "./MySqlModel";
import { PlanStatus } from "./Plan";
import { ProjectFilterOptions } from "../types";

export class ProjectSearchResult {
  public id: number;
  public title: string;
  public abstractText?: string;
  public startDate?: string;
  public endDate?: string;
  public researchDomain?: string;
  public isTestProject: boolean;
  public created: string;
  public createdById: number;
  public createdByName: string;
  public modified: string;
  public modifiedById: number;
  public modifiedByName: string;
  public collaboratorsData: string;
  public collaborators: { name: string, accessLevel: string, orcid: string }[];
  public membersData: string;
  public members: { name: string, role: string, orcid: string }[];
  public fundingsData: string;
  public fundings: { name: string, grantId: string }[];

  constructor(options) {
    this.id = options.id;
    this.title = options.title;
    this.abstractText = options.abstractText;
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.researchDomain = options.researchDomain;
    this.isTestProject = options.isTestProject;
    this.created = options.created;
    this.createdById = options.createdById;
    this.createdByName = options.createdByName;
    this.modified = options.modified;
    this.modifiedById = options.modifiedById;
    this.modifiedByName = options.modifiedByName;
    this.collaboratorsData = options.collaboratorsData;
    this.collaborators = options.collaborators;
    this.membersData = options.membersData;
    this.members = options.members;
    this.fundingsData = options.fundingsData;
    this.fundings = options.fundings;
  }

  static async search(
    reference: string,
    context: MyContext,
    term: string,
    userId: number,
    affiliationId: string | null = null,
    filterOptions: ProjectFilterOptions = {},
    options: PaginationOptions = Project.getDefaultPaginationOptions()
  ): Promise<PaginatedQueryResults<ProjectSearchResult>> {
    const whereFilters = [];
    const values = [];

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push('(LOWER(p.title) LIKE ? OR LOWER(p.abstractText) LIKE ?)');
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Handle the Plan.status filter
    switch (filterOptions.status) {
      case PlanStatus.COMPLETE:
        whereFilters.push('((SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'COMPLETE\') >= 1)');
        break;
      case PlanStatus.ARCHIVED:
        whereFilters.push('((SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'ARCHIVED\') >= 1)')
        break;
      case PlanStatus.DRAFT:
        whereFilters.push('((SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'DRAFT\') >= 1)')
        break;
      default:
        // Include all plans marked as draft or complete and projects that have no plans
        whereFilters.push('((SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status IN (\'DRAFT\', \'COMPLETE\')) >= 1 || (SELECT COUNT(*) FROM plans WHERE projectId = p.id) = 0)')
        break;
    }

    // Specify the fields available for sorting
    options.availableSortFields = ['p.title', 'p.created', 'p.modified', 'p.startDate', 'p.endDate', 'p.isTestProject'];
    // Specify the field we want to use for the totalCount
    options.countField = 'p.id';

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(options.sortField)) options.sortField = 'p.modified';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'DESC';

    // Determine the type of pagination we are using and then set any additional options we need
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'p.id';
    }

    // If a userId was provided, add it to the filters
    if (userId) {
      whereFilters.push('(p.createdById = ? OR p.id IN (SELECT projectId FROM projectCollaborators WHERE userId = ?))');
      values.push(userId.toString(), userId.toString());
    } else if (affiliationId) {
      // If the current user is an organizational admin
      whereFilters.push('(cu.affiliationId = ?)');
      values.push(affiliationId);
    }

    const sqlStatement = 'SELECT p.id, p.title, p.abstractText, p.startDate, p.endDate, p.isTestProject, ' +
      'researchDomains.description as researchDomain, ' +
      'p.createdById, p.created, TRIM(CONCAT(cu.givenName, CONCAT(\' \', cu.surName))) as createdByName, ' +
      'p.modifiedById, p.modified, TRIM(CONCAT(mu.givenName, CONCAT(\' \', mu.surName))) as modifiedByName, ' +
      'GROUP_CONCAT(DISTINCT CONCAT_WS(\'|\', ' +
      'CASE ' +
      'WHEN collab.surName IS NOT NULL THEN TRIM(CONCAT(collab.givenName, CONCAT(\' \', collab.surName))) ' +
      'ELSE (SELECT collabE.email FROM userEmails collabE WHERE collabE.userId = collab.id LIMIT 1) ' +
      'END, ' +
      'CONCAT(UPPER(SUBSTRING(pcol.accessLevel, 1, 1)), LOWER(SUBSTRING(pcol.accessLevel FROM 2))), ' +
      'collab.orcid ' +
      ') ORDER BY collab.created) collaboratorsData, ' +
      'GROUP_CONCAT(DISTINCT ' +
      'CONCAT_WS(\'|\', ' +
      'CASE ' +
      'WHEN pm.surName IS NOT NULL THEN TRIM(CONCAT(pm.givenName, CONCAT(\' \', pm.surName))) ' +
      'ELSE (SELECT pmE.email FROM userEmails pmE WHERE pmE.userId = pm.id AND pmE.isPrimary = 1 LIMIT 1) ' +
      'END, ' +
      'r.label, ' +
      'pm.orcid ' +
      ') ORDER BY pm.created) as membersData, ' +
      'GROUP_CONCAT(DISTINCT CONCAT_WS(\'|\', fundings.name, pf.grantId) ' +
      'ORDER BY fundings.name SEPARATOR \',\') fundingsData, ' +
      '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'DRAFT\') as draftPlans, ' +
      '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'COMPLETE\') as completePlans, ' +
      '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'ARCHIVED\') as archivedPlans ' +
      'FROM projects p ' +
      'LEFT JOIN researchDomains ON p.researchDomainId = researchDomains.id ' +
      'LEFT JOIN users cu ON cu.id = p.createdById ' +
      'LEFT JOIN users mu ON mu.id = p.modifiedById ' +
      'LEFT JOIN projectCollaborators pcol ON pcol.projectId = p.id ' +
      'LEFT JOIN users collab ON pcol.userId = collab.id ' +
      'LEFT JOIN projectMembers pm ON pm.projectId = p.id ' +
      'LEFT JOIN projectMemberRoles pmr ON pm.id = pmr.projectMemberId ' +
      'LEFT JOIN memberRoles r ON pmr.memberRoleId = r.id ' +
      'LEFT JOIN projectFundings pf ON pf.projectId = p.id ' +
      'LEFT JOIN affiliations fundings ON pf.affiliationId = fundings.uri ';

    const groupByClause = 'GROUP BY p.id, p.title, p.abstractText, p.startDate, p.endDate, p.isTestProject, ' +
      'p.createdById, p.created, p.modifiedById, p.modified, researchDomains.description';

    const response: PaginatedQueryResults<ProjectSearchResult> = await Project.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      groupByClause,
      values,
      opts,
      reference,
    )

    // Loop through each result and marshal the collaborators, members, and fundings objects
    response.items = response.items.map((item) => {
      const collabs = item.collaboratorsData?.split(',') ?? [];
      const contribs = item.membersData?.split(',') ?? [];
      const funds = item.fundingsData?.split(',') ?? [];

      // Translate the string data into collaborator objects
      item.collaborators = collabs.map((collab) => {
        const [name, accessLevel, orcid] = collab.split('|');
        return { name, accessLevel, orcid };
      });
      // Translate the string data into member objects.
      item.members = contribs.map((contrib) => {
        const [name, role, orcid] = contrib.split('|');
        return { name, role, orcid };
      });
      // There can be multiple member entries (one per role) so we want to deduplicate them
      // and have a single entry with all the roles listed
      item.members = item.members.reduce((acc, curr) => {
        const existing = acc.find((entry) => entry.name === curr.name);
        if (existing) {
          existing.role += `, ${curr.role}`;
        } else {
          acc.push(curr);
        }
        return acc;
      }, []);

      // Translate the string data into Funding objects
      item.fundings = funds.map((funding) => {
        const [name, grantId] = funding.split('|');
        return { name, grantId };
      });
      return new ProjectSearchResult(item)
    });

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }
}

export class Project extends MySqlModel {
  public title: string;
  public abstractText?: string;
  public startDate?: string;
  public endDate?: string;
  public researchDomainId?: number;
  public isTestProject: boolean;

  private tableName = 'projects';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.title = options.title;
    this.abstractText = options.abstractText;
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.researchDomainId = options.researchDomainId;
    this.isTestProject = options.isTestProject ?? false;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.title) this.addError('title', 'Title can\'t be blank');

    if (this.startDate) {
      const startIsValid = validateDate(this.startDate);
      if (!startIsValid) this.addError('startDate', 'Start date must be a valid date');
    }
    if (this.endDate) {
      const endIsValid = validateDate(this.endDate);
      if (!endIsValid) {
        this.addError('endDate', 'End date must be a valid date');
      } else {
        // Make sure start date comes before the end date
        if (this.startDate && this.endDate && this.endDate <= this.startDate) {
          this.addError('endDate', 'End date must come after the start date');
        }
      }
    }
    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.title = this.title?.trim();
    this.abstractText = this.abstractText?.trim();
  }

  //Create a new Project
  async create(context: MyContext): Promise<Project> {
    const reference = 'Project.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await Project.findByOwnerAndTitle(
        reference,
        context,
        this.title,
        context.token.id
      );

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Project already exists');
      } else {
        this.prepForSave();

        // Save the record and then fetch it
        const newId = await Project.insert(context, this.tableName, this, reference);
        const response = await Project.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new Project(this);
  }

  //Update an existing Project
  async update(context: MyContext, noTouch = false): Promise<Project> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave();

        await Project.update(context, this.tableName, this, 'Project.update', [], noTouch);
        return await Project.findById('Project.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Project has never been saved');
    }
    return new Project(this);
  }

  //Delete the Project
  async delete(context: MyContext): Promise<Project> {
    if (this.id) {
      const deleted = await Project.findById('Project.delete', context, this.id);

      const successfullyDeleted = await Project.delete(
        context,
        this.tableName,
        this.id,
        'Project.delete'
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Return all of projects for the User
  static async findByUserId(reference: string, context: MyContext, userId: number): Promise<Project[]> {
    const sql = 'SELECT * FROM projects WHERE createdById = ? ORDER BY created DESC';
    const results = await Project.query(context, sql, [userId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new Project(item)) : [];
  }

  // Return all of the projects for the Affiliation
  static async findByAffiliation(reference: string, context: MyContext, affiliationId: string): Promise<Project[]> {
    const sql = 'SELECT projects.* FROM projects INNER JOIN users ON projects.createdById = users.id';
    const whereClause = 'WHERE users.affiliationId = ? ORDER BY created DESC';
    const results = await Project.query(context, `${sql} ${whereClause}`, [affiliationId], reference);
    return Array.isArray(results) ? results.map((item) => new Project(item)) : [];
  }

  static async findByOwnerAndTitle(reference: string, context: MyContext, title: string, userId: number): Promise<Project> {
    const sql = 'SELECT * FROM projects WHERE createdById = ? AND LOWER(title) LIKE ?';
    const searchTerm = (title ?? '');
    const vals = [userId?.toString(), `%${searchTerm?.toLowerCase()?.trim()}%`]
    const results = await Project.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new Project(results[0]) : null;
  }

  // Fetch a Project by it's id
  static async findById(reference: string, context: MyContext, projectFundingId: number): Promise<Project> {
    const sql = 'SELECT * FROM projects WHERE id = ?';
    const results = await Project.query(context, sql, [projectFundingId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new Project(results[0]) : null;
  }
};
