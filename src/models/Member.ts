import { MyContext } from "../context";
import { validateOrcid } from "../resolvers/scalars/orcid";
import { capitalizeFirstLetter, formatORCID, validateEmail } from "../utils/helpers";
import { MemberRole } from "./MemberRole";
import { MySqlModel } from "./MySqlModel";

export class ProjectMember extends MySqlModel {
  public projectId: number;
  public affiliationId?: string;
  public givenName?: string;
  public surName?: string;
  public orcid?: string;
  public email?: string;
  public isPrimaryContact: boolean;
  public memberRoles: MemberRole[];

  public static tableName = 'projectMembers';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.id = options.id;
    this.projectId = options.projectId;
    this.affiliationId = options.affiliationId;
    this.givenName = options.givenName;
    this.surName = options.surName;
    this.orcid = options.orcid;
    this.email = options.email;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoles = options.memberRoles ?? [];
  }

  // Determine whether the 2 ProjectMembers are the same based on their id, orcid, email or name
  static areEqual(memberA: ProjectMember, memberB: ProjectMember): boolean {
    return memberA.id === memberB.id
      || (memberA.orcid && memberB.orcid && memberA.orcid.toLowerCase().trim() === memberB.orcid.toLowerCase().trim())
      || (memberA.email && memberB.email && memberA.email.toLowerCase().trim() === memberB.email.toLowerCase().trim())
      || (memberA.givenName && memberB.givenName && memberA.givenName.toLowerCase().trim() === memberB.givenName.toLowerCase().trim())
      || (memberA.surName && memberB.surName && memberA.surName.toLowerCase().trim() === memberB.surName.toLowerCase().trim());
  }

  // Ensure data integrity
  async prepForSave(context: MyContext, reference: string): Promise<void> {
    this.email = this.email?.trim()?.replace('%40', '@');
    this.givenName = capitalizeFirstLetter(this.givenName);
    this.surName = capitalizeFirstLetter(this.surName);
    this.orcid = formatORCID(this.orcid);

    // Ensure that memberRoles is always an array
    if (!Array.isArray(this.memberRoles)) {
      this.memberRoles = [await MemberRole.defaultRole(context, reference)]
    }
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.projectId) this.addError('projectId', 'Project can\'t be blank');

    if (!this.surName && !this.email && !this.orcid) {
      this.addError('general', 'You must specify at least one name, ORCID or email');
    }
    if (this.orcid && this.orcid.trim().length > 0) {
      try {
        validateOrcid(this.orcid);
      } catch (err) {
        this.addError('orcid', err.message);
      }
    }
    if (this.email && this.email.trim().length > 0 && !validateEmail(this.email)) {
      this.addError('email', 'Invalid email format');
    }

    return Object.keys(this.errors).length === 0;
  }

  //Create a new ProjectMember
  async create(context: MyContext, projectId: number): Promise<ProjectMember> {
    const reference = 'ProjectMember.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      let current: ProjectMember;

      // Then try to find an existing entry for each of the identifiers
      const orcid = formatORCID(this.orcid);
      if (orcid) {
        current = await ProjectMember.findByProjectAndORCID(reference, context, projectId, orcid);
      }
      // If email is not provided, then skip this check
      if (!current && this.email && this.email.trim().length > 0) {
        current = await ProjectMember.findByProjectAndEmail(reference, context, projectId, this.email);
      }
      if (!current) {
        current = await ProjectMember.findByProjectAndName(
          reference,
          context,
          projectId,
          this.givenName,
          this.surName
        );
      }

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Project already has an entry for this member');
      } else {
        this.prepForSave(context, reference);

        // Save the record and then fetch it
        const newId = await ProjectMember.insert(
          context,
          ProjectMember.tableName,
          this,
          reference,
          ['memberRoles']
        );
        const response = await ProjectMember.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new ProjectMember(this);
  }

  //Update an existing ProjectMember
  async update(context: MyContext, noTouch = false): Promise<ProjectMember> {
    const reference = 'ProjectMember.update';
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave(context, reference);

        await ProjectMember.update(
          context,
          ProjectMember.tableName,
          this,
          reference,
          ['memberRoles'],
          noTouch
        );
        return await ProjectMember.findById(reference, context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', `${reference} has never been saved`);
    }
    return new ProjectMember(this);
  }

  //Delete ProjectMember
  async delete(context: MyContext): Promise<ProjectMember> {
    if (this.id) {
      const reference = 'ProjectMember.delete';

      // If there is only one project member, then it cannot be deleted
      const projectMembers = await ProjectMember.findByProjectId(reference, context, this.projectId);
      if (projectMembers.length === 1) {
        this.addError('general', 'A project needs at least one member, so you cannot remove the last one.');
        return this;
      }

      // Get all the plans that are associated with the given projectMemberId
      const planMembers = await PlanMember.findByProjectMemberId(reference, context, this.id);

      // Check each plan to ensure it has more than one member
      for (const planMember of planMembers) {
        const membersInPlan = await PlanMember.findByPlanId(reference, context, planMember.planId);
        if (membersInPlan.length === 1) {
          this.addError(
            'general',
            'You cannot remove this member because it would leave a plan in the project without any members. Each plan must have at least one member.'
          );
          return this;
        }
      }

      // Delete all planMember records associated with this projectMember
      for (const planMember of planMembers) {
        await PlanMember.delete(context, PlanMember.tableName, planMember.id, reference);
      }

      // Delete the projectMember itself
      const deleted = await ProjectMember.findById(reference, context, this.id);
      const successfullyDeleted = await ProjectMember.delete(context, ProjectMember.tableName, this.id, reference);
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Return all members of the Project
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<ProjectMember[]> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE projectId = ? ORDER BY surName, givenName`;
    const results = await ProjectMember.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new ProjectMember(item)) : [];
  }

  // Return all members associated with the Affiliation
  static async findByAffiliation(reference: string, context: MyContext, affiliationId: string): Promise<ProjectMember[]> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE affiliationId = ? ORDER BY surName, givenName`;
    const results = await ProjectMember.query(context, sql, [affiliationId], reference);
    return Array.isArray(results) ? results.map((item) => new ProjectMember(item)) : [];
  }

  // Fetch a member by its id
  static async findById(reference: string, context: MyContext, projectMemberId: number): Promise<ProjectMember> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE id = ?`;
    const results = await ProjectMember.query(context, sql, [projectMemberId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }

  // Fetch a member by its project and email
  static async findByProjectAndEmail(
    reference: string,
    context: MyContext,
    projectId: number,
    email: string
  ): Promise<ProjectMember> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE projectId = ? AND email = ?`;
    const results = await ProjectMember.query(context, sql, [projectId?.toString(), email], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }

  // Fetch a member by its Project and ORCID
  static async findByProjectAndORCID(
    reference: string,
    context: MyContext,
    projectId: number,
    orcid: string
  ): Promise<ProjectMember> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE projectId = ? AND orcid = ?`;
    const results = await ProjectMember.query(context, sql, [projectId?.toString(), orcid], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }

  // Fetch a member by its project and name
  static async findByProjectAndName(
    reference: string,
    context: MyContext,
    projectId: number,
    givenName: string,
    surName: string
  ): Promise<ProjectMember> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE projectId = ? AND LOWER(givenName) = ? AND LOWER(surName) = ?`;
    const vals = [projectId?.toString(), givenName?.trim()?.toLowerCase(), surName?.trim()?.toLowerCase()];
    const results = await ProjectMember.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }

  // Fetch a member by its project and name or ORCID or email
  static async findByProjectAndNameOrORCIDOrEmail(
    reference: string,
    context: MyContext,
    projectId: number,
    givenName: string,
    surName: string,
    orcid: string,
    email: string
  ): Promise<ProjectMember> {
    let sql = `SELECT * FROM ${ProjectMember.tableName}`;
    sql += ' WHERE projectId = ? AND (LOWER(givenName) = ? AND LOWER(surName) = ?) OR (orcid = ?) OR (email = ?)';
    sql += ' ORDER BY orcid DESC, email DESC, surName, givenName';
    const vals = [projectId?.toString(), givenName?.trim()?.toLowerCase(), surName?.trim()?.toLowerCase(), orcid, email];
    const results = await ProjectMember.query(context, sql, vals, reference);
    // We've sorted by ORCID and the email descending so grab the first match
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }

  // Get the primary contact for the specified project
  static async findPrimaryContact(reference: string, context: MyContext, projectId: number): Promise<ProjectMember> {
    const sql = `SELECT * FROM ${ProjectMember.tableName} WHERE projectId = ? AND isPrimaryContact = 1`;
    const results = await ProjectMember.query(context, sql, [projectId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ProjectMember(results[0]) : null;
  }
}

// Represents members of a research project associated with a DMP
export class PlanMember extends MySqlModel {
  public planId: number;
  public projectMemberId: number;
  public isPrimaryContact: boolean;
  public memberRoleIds: number[];

  public static tableName = 'planMembers';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.planId = options.planId;
    this.projectMemberId = options.projectMemberId;
    this.isPrimaryContact = options.isPrimaryContact ?? false;
    this.memberRoleIds = options.memberRoleIds ?? [];
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();
    if (!this.planId) this.addError('planId', 'Plan can\'t be blank');
    if (!this.projectMemberId) this.addError('projectMemberId', 'Project member can\'t be blank');

    if (!Array.isArray(this.memberRoleIds) || this.memberRoleIds.length === 0) {
      this.addError('memberRoleIds', 'You must specify at least one role');
    }

    return Object.keys(this.errors).length === 0;
  }

  //Create a new PlanMember
  async create(context: MyContext): Promise<PlanMember> {
    const reference = 'PlanMember.create';

    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await PlanMember.findByPlanAndProjectMember(reference, context, this.planId, this.projectMemberId);

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Plan already has an entry for this member');
      } else {
        // Save the record and then fetch it
        const newId = await PlanMember.insert(
          context,
          PlanMember.tableName,
          this,
          reference,
          ['memberRoleIds']
        );
        const response = await PlanMember.findById(reference, context, newId);
        return response;
      }
    }
    // Otherwise return as-is with all the errors
    return new PlanMember(this);
  }

  //Update an existing plan member
  async update(context: MyContext, noTouch = false): Promise<PlanMember> {
    if (await this.isValid()) {
      if (this.id) {
        await PlanMember.update(
          context,
          PlanMember.tableName,
          this,
          'PlanMember.update',
          ['memberRoleIds'],
          noTouch
        );
        return await PlanMember.findById('PlanMember.update', context, this.id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'PlanMember has never been saved');
    }
    return new PlanMember(this);
  }

  //Delete PlanMember
  async delete(context: MyContext): Promise<PlanMember> {
    if (this.id) {
      const reference = 'PlanMember.delete';

      // If there is only one plan member, then it cannot be deleted
      const members = await PlanMember.findByPlanId(reference, context, this.planId);
      if (members.length === 1) {
        this.addError('general', 'A plan needs at least one member, so you cannot remove the last one.');
        return this;
      } else {
        const deleted = await PlanMember.findById('PlanMember.delete', context, this.id);

        const successfullyDeleted = await PlanMember.delete(
          context,
          PlanMember.tableName,
          this.id,
          'PlanMember.delete'
        );
        if (successfullyDeleted) {
          return deleted;
        } else {
          return null
        }
      }
    }
    return null;
  }

  // Find the project member by its id
  static async findById(reference: string, context: MyContext, id: number): Promise<PlanMember> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await PlanMember.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanMember(results[0]) : null;
  }

  // Fetch a member by the PLan and ProjectMember
  static async findByPlanAndProjectMember(
    reference: string,
    context: MyContext,
    planId: number,
    projectMemberId: number
  ): Promise<PlanMember> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND projectMemberId = ?`;
    const results = await PlanMember.query(context, sql, [planId?.toString(), projectMemberId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanMember(results[0]) : null;
  }

  // Fetch a member by its projectMember id
  static async findByProjectMemberId(
    reference: string,
    context: MyContext,
    planMemberId: number
  ): Promise<PlanMember[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectMemberId = ?`;
    const results = await PlanMember.query(context, sql, [planMemberId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? results.map((item) => new PlanMember(item)) : [];
  }

  // Fetch all of the members for a plan
  static async findByPlanId(reference: string, context: MyContext, planId: number): Promise<PlanMember[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? ORDER BY isPrimaryContact DESC`;
    const results = await PlanMember.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) ? results.map((item) => new PlanMember(item)) : [];
  }

  // Fetch all plan members by a projectId
  static async findByProjectId(reference: string, context: MyContext, projectId: number): Promise<PlanMember[]> {
    const sql = `SELECT pm.* FROM ${this.tableName} pm`;
    const joinClause = 'JOIN projectMembers pjm ON pm.projectMemberId = pjm.id';
    const whereClause = 'WHERE pjm.projectId = ?';
    const vals = [projectId?.toString()];
    const results = await PlanMember.query(context, `${sql} ${joinClause} ${whereClause}`, vals, reference);
    return Array.isArray(results) ? results.map((item) => new PlanMember(item)) : [];
  }

  // Get the primary contact for the specified plan
  static async findPrimaryContact(reference: string, context: MyContext, planId: number): Promise<PlanMember> {
    const sql = `SELECT * FROM ${this.tableName} WHERE planId = ? AND isPrimaryContact = 1`;
    const results = await PlanMember.query(context, sql, [planId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PlanMember(results[0]) : null;
  }
}
