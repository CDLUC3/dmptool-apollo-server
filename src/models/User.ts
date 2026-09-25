import {
  capitalizeFirstLetter,
  formatORCID,
  getCurrentDate,
  isNullOrUndefined,
} from '../utils/helpers.js';
import { prepareObjectForLogs } from '../logger.js';
import { MySqlModel } from './MySqlModel.js';
import { MyContext } from '../context.js';
import { defaultLanguageId, supportedLanguages } from './Language.js';
import { UserEmail } from './UserEmail.js';
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from '../types/general.js';

export enum UserRole {
  RESEARCHER = 'RESEARCHER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN',
}

export enum LogInType {
  PASSWORD = 'PASSWORD',
  SSO = 'SSO',
}

export class User extends MySqlModel {
  public password: string;
  public oldPasswordHash?: string;
  public role: UserRole;
  public givenName?: string;
  public surName?: string;
  public affiliationId: string;
  public acceptedTerms: boolean;
  public orcid?: string;
  public ssoId?: string;
  public languageId: string;

  public last_sign_in?: string;
  public last_sign_in_via?: LogInType;
  public failed_sign_in_attempts?: number;

  public notify_on_comment_added?: boolean;
  public notify_on_template_shared?: boolean;
  public notify_on_feedback_complete?: boolean;
  public notify_on_plan_shared?: boolean;
  public notify_on_plan_visibility_change?: boolean;

  public locked?: boolean;
  public active?: boolean;
  public isArchived?: boolean;
  public passwordChangedAt?: string;

  public tableName = 'users';

  // Initialize a new User
  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.password = options.password;
    this.oldPasswordHash = options.oldPasswordHash;
    this.role = options.role;
    this.givenName = options.givenName;
    this.surName = options.surName;
    this.orcid = options.orcid;
    this.ssoId = options.ssoId;
    this.affiliationId = options.affiliationId;
    this.acceptedTerms = options.acceptedTerms;
    this.languageId = options.languageId ?? defaultLanguageId;
    this.failed_sign_in_attempts = options.failed_sign_in_attempts ?? 0;
    this.locked = options.locked ?? false;
    this.active = options.active ?? true;
    this.notify_on_comment_added = options.notify_on_comment_added ?? true;
    this.notify_on_template_shared = options.notify_on_template_shared ?? true;
    this.notify_on_feedback_complete = options.notify_on_feedback_complete ?? true;
    this.notify_on_plan_shared = options.notify_on_plan_shared ?? true;
    this.notify_on_plan_visibility_change = options.notify_on_plan_visibility_change ?? true;
    this.passwordChangedAt = options.passwordChangedAt;
    this.isArchived = options.isArchived ?? false;

    this.prepForSave();
  }

  // Async getter for primary email
  public async getEmail(context: MyContext): Promise<string | null> {
    const primaryEmail = await UserEmail.findPrimaryByUserId('User.getEmail', context, this.id);
    return primaryEmail ? primaryEmail.email : null;
  }


  // Ensure data integrity
  prepForSave() {
    this.role = this.role ?? UserRole.RESEARCHER;
    this.givenName = capitalizeFirstLetter(this.givenName);
    this.surName = capitalizeFirstLetter(this.surName);
    // Set the languageId to the default if it is not a supported language
    if (!supportedLanguages.map((l) => l.id).includes(this.languageId)) {
      this.languageId = defaultLanguageId;
    }
    this.orcid = this.orcid ? formatORCID(this.orcid) : null;
  }

  // Verify that the email does not already exist and that the required fields have values
  async isValid(): Promise<boolean> {
    await super.isValid();

    // email is validated in the table to which it belongs, UserEmail
    if (!this.password) this.addError('password', 'Password is required');
    if (!this.role) this.addError('role', 'Role can\'t be blank');
    if (this.orcid && formatORCID(this.orcid) === null) this.addError('orcid', 'Invalid ORCID');

    return Object.keys(this.errors).length === 0;
  }

  // Helper function to return the user's full name
  getName(): string {
    return [this.givenName, this.surName].join(' ').trim();
  }

  // Find the User by their id
  static async findById(reference: string, context: MyContext, userId: number): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const results = await User.query(context, sql, [userId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new User(results[0]) : null;
  }

  // Find the User by their ORCID
  static async findByOrcid(reference: string, context: MyContext, orcid: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE orcid = ?';
    const results = await User.query(context, sql, [orcid], reference);
    return Array.isArray(results) && results.length > 0 ? new User(results[0]) : null;
  }

  // Find the User by their email address
  static async findByEmail(reference: string, context: MyContext, email: string): Promise<User | null> {
    const emails = await UserEmail.findByEmail(reference, context, email);
    if (!emails || emails.length === 0) return null;

    return await User.findById(reference, context, emails[0].userId);
  }

  // Return all the Users associated with the specified affiliationId that match the search term
  static async findByAffiliationId(
    reference: string,
    context: MyContext,
    affiliationId: string,
    term: string,
    options: PaginationOptions = User.getDefaultPaginationOptions(),
    role?: UserRole
  ): Promise<PaginatedQueryResults<User>> {
    const whereFilters = ['u.affiliationId = ?'];
    const values = [affiliationId];

    whereFilters.push('u.isArchived = 0');

    if (!isNullOrUndefined(role)) {
      whereFilters.push('u.role = ?');
      values.push(role);
    }
    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push(`(
        (LOWER(u.givenName) LIKE ? OR
        LOWER(u.surName) LIKE ? OR
        LOWER(ue.email) LIKE ? OR
        LOWER(u.orcid) LIKE ?))`);
      values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Join users with user_emails
    const sqlStatement = `
    SELECT u.* FROM users u
    LEFT JOIN userEmails ue ON u.id = ue.userId AND ue.isPrimary = 1
  `;

    // Determine the type of pagination being used
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = {
        ...options,
        // Specify the fields available for sorting
        availableSortFields: ['u.surName', 'u.givenName', 'u.created', 'ue.email', 'u.orcid', 'u.role', 'u.active', 'u.last_sign_in', 'a.name'],
      } as PaginationOptionsForOffsets;
    } else {
      opts = {
        ...options,
        // Specify the field we want to use for the cursor (should typically match the sort field)
        cursorField: 'CONCAT(ue.email, u.id)',
      } as PaginationOptionsForCursors;
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(opts.sortField)) opts.sortField = 'u.created';
    if (isNullOrUndefined(opts.sortDir)) opts.sortDir = 'DESC';

    // Specify the field we want to use for the count
    opts.countField = 'u.id';

    const response: PaginatedQueryResults<User> = await User.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    );

    context.logger.debug(prepareObjectForLogs({ options, response }), reference);
    return response;
  }

  // Find all the Users that match the search term
  static async search(
    reference: string,
    context: MyContext,
    term: string,
    options: PaginationOptions = User.getDefaultPaginationOptions(),
    role?: UserRole,
    affiliationId?: string,
  ): Promise<PaginatedQueryResults<User>> {
    const whereFilters: string[] = [];
    const values: string[] = [];

    whereFilters.push('u.isArchived = 0');

    // Handle the incoming search term
    const searchTerm = (term ?? '').toLowerCase().trim();
    if (!isNullOrUndefined(searchTerm)) {
      whereFilters.push(`(
        LOWER(u.givenName) LIKE ? OR
        LOWER(u.surName) LIKE ? OR
        LOWER(ue.email) LIKE ? OR
        LOWER(u.orcid) LIKE ? OR
        LOWER(a.searchName) LIKE ?)`);
      values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Add role filter if provided
    if (!isNullOrUndefined(role)) {
      whereFilters.push('u.role = ?');
      values.push(role);
    }

    // Add affiliation filter if provided
    if (!isNullOrUndefined(affiliationId)) {
      whereFilters.push('a.uri = ?');
      values.push(affiliationId);
    }

    // Determine the type of pagination being used
    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = {
        ...options,
        // Specify the fields available for sorting
        availableSortFields: ['u.surName', 'u.givenName', 'u.created', 'ue.email', 'u.orcid', 'u.role', 'u.active', 'u.last_sign_in', 'a.name'],
      } as PaginationOptionsForOffsets;
    } else {
      opts = {
        ...options,
        // Specify the field we want to use for the cursor (should typically match the sort field)
        cursorField: 'CONCAT(ue.email, u.id)',
      } as PaginationOptionsForCursors;
    }

    // Set the default sort field and order if none was provided
    if (isNullOrUndefined(opts.sortField)) opts.sortField = 'u.created';
    if (isNullOrUndefined(opts.sortDir)) opts.sortDir = 'DESC';

    // Specify the field we want to use for the count
    opts.countField = 'u.id';

    // Join users with user_emails
    const sqlStatement = `
    SELECT u.*, a.name, a.uri FROM users u
                      LEFT JOIN affiliations a ON u.affiliationId = a.uri
                      LEFT JOIN userEmails ue ON u.id = ue.userId AND ue.isPrimary = 1
  `;

    const response: PaginatedQueryResults<User> = await User.queryWithPagination(
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

  // Update the last_login fields
  async recordLogIn(context: MyContext, loginType: LogInType): Promise<boolean> {
    if (this.id) {
      this.last_sign_in = getCurrentDate();
      this.last_sign_in_via = loginType;

      if (await User.update(context, this.tableName, this, 'User.recordLogIn', ['password'], true)) {
        return true;
      }
    }
    // This recordSignIn could not update the record for some reason
    context.logger.error(`recordSignIn failed for user ${this.id}`);
    return false;
  }

  // Save the changes made to the User
  async update(context: MyContext): Promise<User> {
    if (await this.isValid()) {
      if (this.id) {
        const original = await User.findById('User.update', context, this.id);
        // If the user changed their affiliationId
        if (original.affiliationId !== this.affiliationId) {
          // If the user is an ADMIN then demote them to RESEARCHER
          if (this.role === UserRole.ADMIN) {
            const msg = `User.update Admin changed affiliation so their role must change to Researcher`;
            context.logger.info(prepareObjectForLogs({ userId: this.id }), msg);
            this.role = UserRole.RESEARCHER;
          }

          // Their ssoId will no longer be applicable (unless they are SUPERADMIN)
          if (this.role !== UserRole.SUPERADMIN) {
            this.ssoId = null;
          }
        }

        // Don't allow password changes here
        await User.update(context, this.tableName, this, 'User.update', ['password']);
        return await User.findById('User.update', context, this.id);
      }
      // This user has never been saved before so we cannot update it!
      this.addError('general', 'User has never been saved');
    }
    return new User(this);
  }
}
