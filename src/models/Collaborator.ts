import { MyContext } from '../context';
import { sendProjectCollaborationEmail, sendTemplateCollaborationEmail } from '../services/emailService';
import {
  formatORCID,
  isNullOrUndefined,
  stripORCIDIdentifierBaseURL,
  validateEmail,
  valueIsEmpty
} from '../utils/helpers';
import { MySqlModel } from './MySqlModel';
import { Project } from './Project';
import { Template } from './Template';
import { User } from './User';
import { PaginatedQueryResults, PaginationOptionsForCursors } from "../types/general";
import { CollaboratorSearchResult } from "../types";
import { Affiliation } from "./Affiliation";
import { OrcidAPI, OrcidPerson } from "../datasources/OrcidAPI";

export interface ProjectCollaboratorSearchResult {
  cursorId?: string;
  id?: number;
  givenName?: string;
  surName?: string;
  email?: string;
  orcid?: string;
  affiliationName?: string;
  affiliationRORId?: string;
  affiliationURL?: string;
}

// An abstract class that represents a User who has been invited to Collaborate on another
// entity (e.g. Template or Plan)
export class Collaborator extends MySqlModel {
  public email: string;
  public invitedById: number;
  public userId: number;

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.email = options.email;
    this.invitedById = options.invitedById;
    this.userId = options.userId ?? null;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!validateEmail(this.email)) {
      this.addError('email', 'Email can\'t be blank');
    }
    if (!this.invitedById) {
      this.addError('invitedById', 'Invited by can\'t be blank');
    }
    return Object.keys(this.errors).length === 0;
  }
}

// An individual that belongs to another affiliation that has been invited to work on a Template
export class TemplateCollaborator extends Collaborator {
  public templateId: number;

  private tableName = 'templateCollaborators';

  constructor(options) {
    super(options);

    this.templateId = options.templateId ?? null;
  }

  // Verify that the templateId is present
  async isValid(): Promise<boolean> {
    await super.isValid()

    if (this.templateId === null) this.addError('templateId', 'Template Id can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext): Promise<TemplateCollaborator> {
    const reference = 'TemplateCollaborator.create';

    const currentCollaborator = await TemplateCollaborator.findByTemplateIdAndEmail(
      reference,
      context,
      this.templateId,
      this.email,
    );

    if (currentCollaborator) {
      currentCollaborator.addError('general', 'Collaborator has already been added');
      return currentCollaborator
    } else {
      // See if the user already has an account, if so grab their id
      const user = await User.findByEmail(reference, context, this.email);
      this.userId = user?.id;

      // Set the inviter's Id to the current user
      this.invitedById = context.token?.id;

      // First make sure the record is valid
      if (await this.isValid()) {
        // Save the record and then fetch it
        const newId = await TemplateCollaborator.insert(context, this.tableName, this, reference);
        if (newId) {
          const inviter = await User.findById(reference, context, this.invitedById);
          const template = await Template.findById(reference, context, this.templateId);

          // Send out the invitation notification (no async here, can happen in the background)
          await sendTemplateCollaborationEmail(context, template.name, inviter.getName(), this.email, this.userId)

          return await TemplateCollaborator.findById(reference, context, newId);
        }
      }
    }

    // Otherwise return as-is with all the errors
    return new TemplateCollaborator(this);
  }

  // Update the record
  async update(context: MyContext): Promise<TemplateCollaborator> {
    // First make sure the record is valid
    if (await this.isValid()) {
      if (this.id) {
        // Verify that the template we want to attach the collaborator to exists!
        const templateExists = await Template.exists(
          context,
          'templates',
          this.templateId,
          'TemplateCollaborator.update'
        );

        if (!templateExists) {
          this.addError('general', 'Template does not exist');
        } else {
          const result = await TemplateCollaborator.update(context, this.tableName, this, 'TemplateCollaborator.update');
          if (!result) {
            this.addError('general', 'Unable to update the collaborator');
          }
          if (!this.hasErrors()) {
            return await TemplateCollaborator.findById('TemplateCollaborator.update', context, this.id);
          }
        }
      } else {
        this.addError('general', 'TemplateCollaborator has never been saved');
      }
    }
    return new TemplateCollaborator(this);
  }

  // Remove this record
  async delete(context: MyContext): Promise<TemplateCollaborator> {
    const existing = await TemplateCollaborator.findById('TemplateCollaborator.delete', context, this.id);
    if (existing) {
      const result = await TemplateCollaborator.delete(context, this.tableName, this.id, 'TemplateCollaborator.delete');
      if (!result) {
        existing.addError('general', 'Unable to delete the collaborator');
      }
      return new TemplateCollaborator(existing);
    }
    return null;
  }

  // Get all of the collaborators for the specified Template
  static async findByTemplateId(
    reference: string,
    context: MyContext,
    templateId: number
  ): Promise<TemplateCollaborator[]> {
    const sql = 'SELECT * FROM templateCollaborators WHERE templateId = ? ORDER BY email ASC';
    const results = await TemplateCollaborator.query(context, sql, [templateId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new TemplateCollaborator(entry)) : [];
  }

  // Get the specified TemplateCollaborator
  static async findById(
    reference: string,
    context: MyContext,
    id: number,
  ): Promise<TemplateCollaborator> {
    const sql = 'SELECT * FROM templateCollaborators WHERE id = ?';
    const results = await TemplateCollaborator.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new TemplateCollaborator(results[0]) : null;
  }

  static async findByInvitedById(
    reference: string,
    context: MyContext,
    invitedById: number,
  ): Promise<TemplateCollaborator[]> {
    const sql = 'SELECT * FROM templateCollaborators WHERE invitedById = ?';
    const results = await TemplateCollaborator.query(context, sql, [invitedById?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new TemplateCollaborator(entry)) : [];
  }

  // Get all of the TemplateCollaborator records for the specified email
  static async findByEmail(
    reference: string,
    context: MyContext,
    email: string,
  ): Promise<TemplateCollaborator[]> {
    const sql = 'SELECT * FROM templateCollaborators WHERE email = ?';
    const results = await TemplateCollaborator.query(context, sql, [email], reference);
    return Array.isArray(results) ? results.map((entry) => new TemplateCollaborator(entry)) : [];
  }

  // Get the specified TemplateCollaborator
  static async findByTemplateIdAndEmail(
    reference: string,
    context: MyContext,
    templateId: number,
    email: string,
  ): Promise<TemplateCollaborator> {
    const sql = 'SELECT * FROM templateCollaborators WHERE templateId = ? AND email = ?';
    const vals = [templateId?.toString(), email];
    const results = await TemplateCollaborator.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new TemplateCollaborator(results[0]) : null;
  }
}

// The type of access the collaborator can have on a Project
export enum ProjectCollaboratorAccessLevel {
  // The user is able to perform all actions on a Plan (typically restricted to the owner/creator)
  PRIMARY = 'PRIMARY',
  // Has admin rights to project (can invite other users, edit the plans and publish them)
  OWN = 'OWN',
  // Can edit a Project's and Plan's info (except publish, mark as complete, and change access levels)
  EDIT = 'EDIT',
  // Can comment on a Plan's answers
  COMMENT = 'COMMENT',
}

// An individual that has permission to work on a Project and it's plans
export class ProjectCollaborator extends Collaborator {
  public projectId: number;
  public accessLevel: ProjectCollaboratorAccessLevel;

  private tableName = 'projectCollaborators';

  constructor(options) {
    super(options);

    this.projectId = options.projectId ?? null;
    this.accessLevel = options.accessLevel ?? ProjectCollaboratorAccessLevel.COMMENT;
  }

  // Verify that the projectId is present
  async isValid(): Promise<boolean> {
    await super.isValid()

    if (isNullOrUndefined(this.projectId)) this.addError('projectId', 'Project Id can\'t be blank');
    if (valueIsEmpty(this.accessLevel)) this.addError('accessLevel', 'Access Level can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Save the current record
  async create(context: MyContext, sendEmailNotification = true): Promise<ProjectCollaborator> {
    const reference = 'ProjectCollaborator.create';

    const currentCollaborator = await ProjectCollaborator.findByProjectIdAndEmail(
      reference,
      context,
      this.projectId,
      this.email,
    );

    if (currentCollaborator) {
      currentCollaborator.addError('general', 'Collaborator has already been added');
      return currentCollaborator
    } else {
      // See if the user already has an account, if so grab their id
      const user = await User.findByEmail(reference, context, this.email);
      this.userId = user?.id;

      // Set the inviter's Id to the current user
      this.invitedById = context.token?.id;

      // First make sure the record is valid
      if (await this.isValid()) {
        // Save the record and then fetch it
        const newId = await ProjectCollaborator.insert(context, this.tableName, this, reference);
        if (newId) {
          const inviter = await User.findById(reference, context, this.invitedById);
          const project = await Project.findById(reference, context, this.projectId);

          if (sendEmailNotification) {
            // Send out the invitation notification (no async here, can happen in the background)
            await sendProjectCollaborationEmail(context, project.title, inviter.getName(), this.email, this.userId)
          }

          return await ProjectCollaborator.findById(reference, context, newId);
        }
      }
    }

    // Otherwise return as-is with all the errors
    return new ProjectCollaborator(this);
  }

  // Update the record
  async update(context: MyContext): Promise<ProjectCollaborator> {
    // First make sure the record is valid
    if (await this.isValid()) {
      if (this.id) {
        // Verify that the project we want to attach the collaborator to exists!
        const projectExists = await Project.exists(
          context,
          'projects',
          this.projectId,
          'ProjectCollaborator.update'
        );

        if (!projectExists) {
          this.addError('general', 'Project does not exist');
        } else {
          const result = await ProjectCollaborator.update(context, this.tableName, this, 'ProjectCollaborator.update');
          if (!result) {
            this.addError('general', 'Unable to update the collaborator');
          }
          if (!this.hasErrors()) {
            return await ProjectCollaborator.findById('ProjectCollaborator.update', context, this.id);
          }
        }
      } else {
        this.addError('general', 'ProjectCollaborator has never been saved');
      }
    }
    return new ProjectCollaborator(this);
  }

  // Remove this record
  async delete(context: MyContext): Promise<ProjectCollaborator> {
    const existing = await ProjectCollaborator.findById('ProjectCollaborator.delete', context, this.id);
    if (existing) {
      const result = await ProjectCollaborator.delete(context, this.tableName, this.id, 'ProjectCollaborator.delete');
      if (!result) {
        existing.addError('general', 'Unable to delete the collaborator');
      }
      return new ProjectCollaborator(existing);
    }
    return null;
  }

  // Get all of the collaborators for the specified Project
  static async findByProjectId(
    reference: string,
    context: MyContext,
    projectId: number
  ): Promise<ProjectCollaborator[]> {
    const sql = 'SELECT * FROM projectCollaborators WHERE projectId = ? ORDER BY email ASC';
    const results = await ProjectCollaborator.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new ProjectCollaborator(entry)) : [];
  }

  // Get the specified ProjectCollaborator
  static async findById(
    reference: string,
    context: MyContext,
    id: number,
  ): Promise<ProjectCollaborator> {
    const sql = 'SELECT * FROM projectCollaborators WHERE id = ?';
    const results = await ProjectCollaborator.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectCollaborator(results[0]) : null;
  }

  static async findByInvitedById(
    reference: string,
    context: MyContext,
    invitedById: number,
  ): Promise<ProjectCollaborator[]> {
    const sql = 'SELECT * FROM projectCollaborators WHERE invitedById = ?';
    const results = await ProjectCollaborator.query(context, sql, [invitedById?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new ProjectCollaborator(entry)) : [];
  }

  // Get all of the ProjectCollaborator records for the specified email
  static async findByEmail(
    reference: string,
    context: MyContext,
    email: string,
  ): Promise<ProjectCollaborator[]> {
    const sql = 'SELECT * FROM projectCollaborators WHERE email = ?';
    const results = await ProjectCollaborator.query(context, sql, [email], reference);
    return Array.isArray(results) ? results.map((entry) => new ProjectCollaborator(entry)) : [];
  }


  // Get collaborator by userId and projectId
  static async findByUserIdAndProjectId(
    reference: string,
    context: MyContext,
    userId: number,
    projectId: number
  ): Promise<ProjectCollaborator> {
    const sql = 'SELECT * FROM projectCollaborators WHERE userId = ? AND projectId = ?';
    const results = await ProjectCollaborator.query(context, sql, [userId?.toString(), projectId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectCollaborator(results[0]) : null;
  }

  // Get the specified ProjectCollaborator
  static async findByProjectIdAndEmail(
    reference: string,
    context: MyContext,
    projectId: number,
    email: string,
  ): Promise<ProjectCollaborator> {
    const sql = 'SELECT * FROM projectCollaborators WHERE projectId = ? AND email = ?';
    const vals = [projectId?.toString(), email];
    const results = await ProjectCollaborator.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectCollaborator(results[0]) : null;
  }

  // Find a potential collaborator by their ORCID
  static async findPotentialCollaboratorByORCID(
    reference: string,
    context: MyContext,
    orcid: string
  ): Promise<CollaboratorSearchResult> {
    // Get the fully formatted ORCID
    const fullOrcid = formatORCID(orcid);
    // Get the ORCID without the base URL
    const orcidId = stripORCIDIdentifierBaseURL(orcid);

    if (!isNullOrUndefined(fullOrcid) && !isNullOrUndefined(orcid)) {
      // First try to find the user in the User table
      const user: User = await User.findByOrcid(reference, context, fullOrcid);
      if (!isNullOrUndefined(user)) {
        // We found the person in our users table, so just return the info we have
        const affiliation = await Affiliation.findByURI(
          reference,
          context,
          user.affiliationId
        );

        return {
          id: user.id,
          givenName: user.givenName,
          surName: user.surName,
          orcid: user.orcid || '',
          email: await user.getEmail(context),
          affiliationName: affiliation?.name,
          affiliationRORId: affiliation?.uri,
          affiliationURL: affiliation?.homepage,
        };

      } else {
        // Finally, call the ORCID API to get the person's details
        const orcidAPI: OrcidAPI = new OrcidAPI({ cache: context.cache });
        const orcidData: OrcidPerson = await orcidAPI.getPerson(context, orcidId, reference);

        if (isNullOrUndefined(orcidData)) {
          return null;
        }

        // Return the results provided by the ORCID API
        return {
          givenName: orcidData.givenName,
          surName: orcidData.surName,
          orcid: orcidData.orcid,
          email: orcidData.email,
          affiliationName: orcidData.employment?.name,
          affiliationRORId: orcidData.employment?.rorId,
          affiliationURL: orcidData.employment?.url,
        };
      }
    }
    return null;
  }

  // Find potential collaborators by search term
  static async findPotentialCollaboratorsByTerm(
    reference: string,
    context: MyContext,
    term: string,
    options: PaginationOptionsForCursors = Project.getDefaultPaginationOptions()
  ): Promise<PaginatedQueryResults<CollaboratorSearchResult>> {
    let results: ProjectCollaboratorSearchResult[] = [];
    let totalCount = 0;
    let hasNextPage = false;
    let nextCursor: string = null;
    const limit = ProjectCollaborator.getPaginationLimit(options?.limit);

    // Gather all the projects associated with the current user's affiliation
    const projects: Project[] = await Project.findByAffiliation(
      reference,
      context,
      context.token?.affiliationId
    );

    if (Array.isArray(projects) && projects.length > 0) {
      // Fetch all the collaborators for these projects
      const placeholder = projects.map(() => '?').join(',');
      const sortField = options?.sortField ?? 'u.surName';
      const sortDir = options?.sortDir ?? 'ASC';
      const cursorId = `CONCAT(LOWER(REPLACE(${sortField}, ' ', '_')), '-', LOWER(u.id))`;

      // Base FROM/WHERE clause without cursor filtering (for total count)
      const baseFromWhereClause = `
        FROM users u
            INNER JOIN userEmails ue on ue.userId = u.id AND ue.isPrimary = 1
            LEFT OUTER JOIN affiliations a ON u.affiliationId = a.uri
        WHERE u.active = 1
            AND (
                (
                  a.uri = ?
                  AND (LOWER(u.givenName) LIKE ? OR LOWER(u.surName) LIKE ? OR LOWER(ue.email) LIKE ?)
                ) OR (
                  u.id IN (
                    SELECT pc.userId
                    FROM projectCollaborators pc
                    WHERE pc.projectId IN (${placeholder})
                  )
                  AND (LOWER(u.givenName) LIKE ? OR LOWER(u.surName) LIKE ? OR LOWER(ue.email) LIKE ?)
                )
            )
      `;

      // FROM/WHERE clause with cursor filtering (for paginated results)
      const fromWhereClause = `${baseFromWhereClause}${options?.cursor ? `AND ${cursorId} >= ?` : ''}`;

      const sql = `
        SELECT DISTINCT ${cursorId} cursorId,
            u.id, u.givenName givenName, u.surName surName, ue.email email, u.orcid orcid,
            a.name affiliationName, a.uri affiliationRORId, a.homepage affiliationURL
        ${fromWhereClause}
        ORDER BY cursorId ${sortDir}
        LIMIT ${limit + 1};
      `;

      // Base values without cursor (for count query)
      const baseValues = [
        context.token?.affiliationId ? context.token.affiliationId : 'NULL',
        ...Array.from({ length: 3 }, () => `%${term.toLowerCase()}%`),
        ...projects.map(p => p.id.toString()),
        ...Array.from({ length: 3 }, () => `%${term.toLowerCase()}%`),
      ].flat().filter(v => v !== undefined);

      // Values with cursor (for paginated query)
      const values = [...baseValues];
      if (options?.cursor) values.push(options.cursor);

      // Execute the main query
      results = await ProjectCollaborator.query(
        context,
        sql,
        values,
        reference
      );

      // Always execute count query to get total across all pages
      const countSql = `SELECT COUNT(DISTINCT u.id) as total ${baseFromWhereClause}`;
      const countResults = await ProjectCollaborator.query(
        context,
        countSql,
        baseValues, // Use baseValues without cursor
        reference
      );

      totalCount = Array.isArray(countResults) && countResults.length > 0 ? countResults[0]?.total : 0;

      if (Array.isArray(results) && results.length > 0) {
        nextCursor = results.length > 0 ? results[results.length - 1]?.cursorId : undefined;
        hasNextPage = nextCursor !== undefined && options?.cursor !== nextCursor && results.length > limit;
      }
    }

    return {
      items: results.slice(0, limit), // Return only the first 'limit' items
      limit,
      totalCount,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
      availableSortFields: ['u.surName', 'u.givenName', 'ue.email'],
    };
  }
}
