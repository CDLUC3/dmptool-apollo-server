import { MySqlModel } from './MySqlModel';
import { MyContext } from '../context';
import { getCurrentDate } from '../utils/helpers';

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

  // Save this new reset token record
  async create(context: MyContext): Promise<PasswordResetToken> {
    const reference = 'PasswordResetToken.create';

    if (await this.isValid()) {
      const newId = await PasswordResetToken.insert(context, this.tableName, this, reference);
      return await PasswordResetToken.findById(reference, context, newId);
    }
    return this;
  }

  // Mark this token as consumed
  async markUsed(context: MyContext): Promise<boolean> {
    if (!this.id) return false;
    this.usedAt = getCurrentDate();
    const updated = await PasswordResetToken.update(context, this.tableName, this, 'PasswordResetToken.markUsed');
    return !!updated;
  }

  // Invalidate any previous outstanding tokens for a user, then create and save a new one
  static async createForUser(
    context: MyContext,
    userId: number,
    resetToken: string,
    expiresAt: string
  ): Promise<PasswordResetToken | null> {
    if (!userId || !resetToken || !expiresAt) {
      context.logger.error(`PasswordResetToken.createForUser called with missing arguments for userId ${userId}`);
      return null;
    }

    // Supersede any prior unused tokens for this user
    await PasswordResetToken.query(
      context,
      'UPDATE passwordResetTokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [getCurrentDate(), userId.toString()],
      'PasswordResetToken.createForUser - invalidatePrevious'
    );

    const newToken = new PasswordResetToken({ userId, resetPasswordToken: resetToken, resetPasswordExpiresAt: expiresAt });
    const saved = await newToken.create(context);
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
    const results = await PasswordResetToken.query(context, sql, [resetToken], 'PasswordResetToken.findValidByToken');
    return Array.isArray(results) && results.length > 0 ? new PasswordResetToken(results[0]) : null;
  }
}