import { MySqlModel } from './MySqlModel';
import { MyContext } from '../context';
import { getCurrentDate } from '../utils/helpers';
import { prepareObjectForLogs } from '../logger';

export class PasswordResetToken extends MySqlModel {
  public userId: number;
  public resetPasswordToken?: string;
  public resetPasswordExpiresAt?: string;
  public usedAt?: string;

  public tableName = 'passwordResetTokens';

  constructor(options) {
    super(options.id, options.createdAt, options.createdById, options.modified, options.modifiedById, options.errors);
    this.userId = options.userId;
    this.resetPasswordToken = options.resetPasswordToken;
    this.resetPasswordExpiresAt = options.resetPasswordExpiresAt;
    this.usedAt = options.usedAt;
  }

  // Verify that the token record has all required fields and that the expiration date is valid and in the future
  async isValid(): Promise<boolean> {
  await super.isValid();

  if (!this.userId) this.addError('userId', 'User can\'t be blank');
  if (!this.resetPasswordToken) this.addError('resetPasswordToken', 'Reset token can\'t be blank');

  if (!this.resetPasswordExpiresAt) {
    this.addError('resetPasswordExpiresAt', 'Expiration date can\'t be blank');
  } else if (isNaN(new Date(this.resetPasswordExpiresAt).getTime())) {
    this.addError('resetPasswordExpiresAt', 'Expiration date is not a valid date');
  } else if (new Date(this.resetPasswordExpiresAt).getTime() <= Date.now()) {
    this.addError('resetPasswordExpiresAt', 'Expiration date must be in the future');
  }

  return Object.keys(this.errors).length === 0;
}
  // Save this new reset token record
  async create(context: MyContext): Promise<PasswordResetToken> {
    const reference = 'PasswordResetToken.create';

    if (await this.isValid()) {
      const newId = await PasswordResetToken.insert(context, this.tableName, this, reference);
      const created = await PasswordResetToken.findById(reference, context, newId);
      context.logger.debug(prepareObjectForLogs({ id: created?.id, userId: this.userId }), reference);
      return created;
    }
    context.logger.debug(prepareObjectForLogs({ id: this.id, userId: this.userId, errors: this.errors}), reference);
    return this;
  }

  // Mark this token as consumed
  async markUsed(context: MyContext): Promise<boolean> {
    const reference = 'PasswordResetToken.markUsed';
    if (!this.id) {
      context.logger.debug(prepareObjectForLogs({ id: this.id }), `${reference} - no id, skipping`);
      return false;
    }
    this.usedAt = getCurrentDate();
    const updated = await PasswordResetToken.update(context, this.tableName, this, reference);
    context.logger.debug(prepareObjectForLogs({ id: this.id, success: !!updated }), reference);
    return !!updated;
  }

  // Invalidate any previous outstanding tokens for a user, then create and save a new one
  static async createForUser(
    context: MyContext,
    userId: number,
    resetToken: string,
    expiresAt: string
  ): Promise<PasswordResetToken | null> {
     const reference = 'PasswordResetToken.createForUser';

    if (!userId || !resetToken || !expiresAt) {
      context.logger.error(`${reference} called with missing arguments for userId ${userId}`);
      return null;
    }

    // Supersede any prior unused tokens for this user
    await PasswordResetToken.query(
      context,
      'UPDATE passwordResetTokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [getCurrentDate(), userId.toString()],
      `${reference} - invalidatePrevious`
    );

    const newToken = new PasswordResetToken({ userId, resetPasswordToken: resetToken, resetPasswordExpiresAt: expiresAt });
    const saved = await newToken.create(context);

    context.logger.debug(prepareObjectForLogs({ userId, savedId: saved?.id }), reference);
    return saved?.id ? saved : null;
  }

  // Find the still-valid token by the passwordResetToken record ID
  static async findById(reference: string, context: MyContext, id: number): Promise<PasswordResetToken | null> {
    const sql = 'SELECT * FROM passwordResetTokens WHERE id = ?';
    const results = await PasswordResetToken.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new PasswordResetToken(results[0]) : null;
  }

  // Find valid token using the hashed token value, only if it has not expired and has not been used
  static async findValidByToken(context: MyContext, resetToken: string): Promise<PasswordResetToken | null> {
    const sql = `
      SELECT * FROM passwordResetTokens
      WHERE resetPasswordToken = ?
        AND resetPasswordExpiresAt > NOW()
        AND usedAt IS NULL
    `;
    const reference = 'PasswordResetToken.findValidByToken';
    const results = await PasswordResetToken.query(context, sql, [resetToken], reference);
    return Array.isArray(results) && results.length > 0 ? new PasswordResetToken(results[0]) : null;
  }
}