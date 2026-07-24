import { MyContext } from "../context";
import { sendEmailConfirmationNotification } from "../services/emailService";
import {
  validateEmail,
  getCurrentDate,
} from '../utils/helpers';
import { TemplateCollaborator } from "./Collaborator";
import { MySqlModel } from "./MySqlModel";

// Reepresents one of the user's email addresses
export class UserEmail extends MySqlModel {
  public userId: number;
  public email: string;
  public isPrimary: boolean;
  public isConfirmed: boolean;

  private tableName = 'userEmails';

  // Initialize a new User
  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.userId = options.userId;
    this.email = options.email;
    this.isPrimary = options.isPrimary ?? false;
    this.isConfirmed = options.isConfirmed ?? false;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (this.userId === null) this.addError('userId', 'User can\'t be blank');
    if (!validateEmail(this.email)) this.addError('email', 'Invalid email address');

    return Object.keys(this.errors).length === 0;
  }

  // Confirm the user owns the email
  static async confirmEmail(context: MyContext, userId: number, email: string): Promise<UserEmail> {
    const ref = 'UserEmail.confirmEmail';
    // Fetch all of the existing records with the current email
    const userEmail = await UserEmail.findByUserIdAndEmail(ref, context, userId, email);

    if (userEmail) {
      // Fetch all of the other instances of this email
      const allEmails = await UserEmail.findByEmail(ref, context, email);
      const otherEmails = allEmails.filter((entry) => { return entry.userId !== userId });

      // If the email has already been confirmed by another account set an error message
      if (otherEmails && otherEmails.find((other) => { return other.isConfirmed; })) {
        userEmail.addError('email', 'Email has already been confirmed by another account');
        return userEmail;

      } else {
        // Update the confirmed flag
        userEmail.isConfirmed = true;
        const updated = await userEmail.update(context);

        // Claim any invitations to collaborate on a Template by assigning the userId
        const tmpltCollabs = await TemplateCollaborator.findByEmail(ref, context, email);
        for (const collab of tmpltCollabs) {
          collab.userId = userId;
          await collab.update(context);
        }

        // Remove any other instances of the email that are out there for other users
        for (const other of otherEmails) {
          await other.delete(context);
        }

        return updated;
      }
    }
    return userEmail;
  }

  // Custom Insert logic
  static async insert(
    apolloContext: MyContext,
    table: string,
    obj: UserEmail,
    reference = 'undefined caller',
    skipKeys?: string[]
  ): Promise<number> {
    // Update the creator/modifier info
    const currentDate = getCurrentDate();
    obj.createdById = obj.userId;
    obj.created = currentDate;
    obj.modifiedById = obj.userId;
    obj.modified = currentDate;

    // Fetch all of the data from the object
    const props = this.propertyInfo(obj, skipKeys);
    const sql = `INSERT INTO ${table} \
                  (${props.map((entry) => entry.name).join(', ')}) \
                 VALUES (${Array(props.length).fill('?').join(', ')})`
    const vals = props.map((entry) => this.prepareValue(entry.value, typeof (entry.value)));

    // Send the calcuated INSERT statement to the query function
    const result = await this.query(apolloContext, sql, vals, reference);
    return Array.isArray(result) ? result[0]?.insertId : null;
  }

  // Save the current record
  async create(context: MyContext): Promise<UserEmail> {
    const ref = 'UserEmail.create';
    // First make sure the record is valid
    if (await this.isValid()) {
      // Fetch all of the existing records with the current email
      const entries = await UserEmail.findByEmail(ref, context, this.email);

      // First make sure it's not already attached to this user account
      const existing = entries.find((entry) => { return entry.userId === this.userId; });
      if (existing) {
        this.addError('general', 'This email has already been associated with this account');
      }

      // Then make sure it hasn't already been claimed/confirmed by another user account
      const confirmed = entries.find((entry) => { return entry.isConfirmed; });
      if (confirmed) {
        this.addError('general', 'Email has already been confirmed by another account');
      }

      if (Object.keys(this.errors).length === 0) {
        // Save the record and then fetch it
        const newId = await UserEmail.insert(context, this.tableName, this, ref);
        const created = await UserEmail.findById(ref, context, newId);

        if (created) {
          // Send out an email confirmation notification. No async, can happen in background
          await sendEmailConfirmationNotification(context, created.email);
        }
        return created;
      }
    }
    // Otherwise return as-is with all the errors
    return new UserEmail(this);
  }

  // Save the changes made to the UserEmail
  async update(context: MyContext): Promise<UserEmail> {
    if (this.id) {
      // First make sure the record is valid
      if (await this.isValid()) {
        // Only allow this if the existing record or the update has been confirmed/verified
        const existing = await UserEmail.findById('UserEmail.update', context, this.id);
        if (existing && !existing.isConfirmed && !this.isConfirmed) {
          this.addError('general', 'Email has not yet been confirmed');
        }

        if (Object.keys(this.errors).length === 0) {
          await UserEmail.update(context, this.tableName, this, 'UserEmail.update');
          return await UserEmail.findById('UserEmail.update', context, this.id);
        }
      }
    } else {
      this.addError('general', 'Email has not been created yet');
    }

    return new UserEmail(this);
  }

  //Delete this UserEmail
  async delete(context: MyContext): Promise<UserEmail> {
    if (this.id) {
      const deleted = await UserEmail.findById('UserEmail.delete', context, this.id);

      if (deleted) {
        const success = await UserEmail.delete(context, this.tableName, this.id, 'UserEmail.delete');
        if (success) {
          return deleted;
        }
      }
      return null;
    } else {
      this.addError('general', 'Cannot delete email that has never been saved');
    }
    return new UserEmail(this);
  }

  // Return the specified UserEmail
  static async findById(reference: string, context: MyContext, id: number): Promise<UserEmail> {
    const sql = 'SELECT * FROM userEmails WHERE id = ?';
    const results = await UserEmail.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new UserEmail(results[0]) : null;
  }

  // Return the specified UserEmail by UserId and Email
  static async findByUserIdAndEmail(
    reference: string,
    context: MyContext,
    userId: number,
    email: string
  ): Promise<UserEmail> {
    const sql = 'SELECT * FROM userEmails WHERE userId = ? AND email = ?';
    const results = await UserEmail.query(context, sql, [userId?.toString(), email], reference);
    return Array.isArray(results) && results.length > 0 ? new UserEmail(results[0]) : null;
  }

  // Return the emails for the specified user
  static async findByUserId(
    reference: string,
    context: MyContext,
    userId: number
  ): Promise<UserEmail[]> {
    const sql = 'SELECT * FROM userEmails WHERE userId = ?';
    const results = await UserEmail.query(context, sql, [userId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new UserEmail(entry)) : [];
  }

  // Return the primary email for the specified user
  static async findPrimaryByUserId(
    reference: string,
    context: MyContext,
    userId: number
  ): Promise<UserEmail | null> {
    const sql = 'SELECT * FROM userEmails WHERE userId = ? AND isPrimary = 1';
    const results = await UserEmail.query(context, sql, [userId?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new UserEmail(results[0]) : null;
  }

  // Return the specified UserEmail
  static async findByEmail(
    reference: string,
    context: MyContext,
    email: string
  ): Promise<UserEmail[]> {
    const sql = 'SELECT * FROM userEmails WHERE email = ?';
    const results = await UserEmail.query(context, sql, [email], reference);
    return Array.isArray(results) ? results.map((entry) => new UserEmail(entry)) : [];
  }

  /**
   * Create or update the primary email for a user.
   * - If no primary exists, create a new primary record.
   * - If the email exists for the user but is not primary, set it as primary and unset any other.
   * - If a primary exists, update its email address.  The isConfirmed is only set for new email records,
   *   otherwise it remains unchanged.
   */
  static async createOrUpdatePrimary(
    context: MyContext,
    userId: number,
    email: string,
    isConfirmed = false
  ): Promise<UserEmail> {
    const ref = 'UserEmail.createOrUpdatePrimary';
    // Find current primary email for user
    const currentPrimary = await UserEmail.findPrimaryByUserId(ref, context, userId);

    // Find if the email already exists for this user
    const existingEmail = await UserEmail.findByUserIdAndEmail(ref, context, userId, email);

    if (!currentPrimary) {
      // No primary exists, create new primary
      const newPrimary = new UserEmail({
        userId,
        email,
        isPrimary: true,
        isConfirmed: isConfirmed,
      });
      return await newPrimary.create(context);
    }

    if (existingEmail) {
      if (!existingEmail.isPrimary) {
        // Set this email as primary, unset current primary
        existingEmail.isPrimary = true;
        await existingEmail.update(context);

        if (currentPrimary.id !== existingEmail.id) {
          currentPrimary.isPrimary = false;
          await currentPrimary.update(context);
        }
        return existingEmail;
      } else {
        // Already primary, nothing to do
        return existingEmail;
      }
    } else {
      // Update current primary record to have the new email
      currentPrimary.email = email;
      return await currentPrimary.update(context);
    }
  }
}
