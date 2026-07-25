import crypto from 'crypto';
import { Resolvers } from "../types";
import { MyContext } from '../context';
import { User } from '../models/User';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { hashToken, getFutureDate } from '../utils/helpers';
import { generalConfig } from '../config/generalConfig';
import { sendResetPasswordEmail } from '../services/emailService'; // wherever this lives
import { ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { GraphQLError } from "graphql";
import { prepareObjectForLogs } from "../logger";
import { UserEmail } from "../models/UserEmail";

export const resolvers: Resolvers = {
  Query: {
    validatePasswordResetToken: async (_, { token }, context: MyContext): Promise<boolean> => {
      const reference = 'validatePasswordResetToken resolver';
      try {
        const hashedToken = hashToken(token);
        const resetTokenRecord = await PasswordResetToken.findValidByToken(context, hashedToken);
        if (!resetTokenRecord) return false;

        const user = await User.findById(reference, context, resetTokenRecord.userId);
        return !!(user && user.active && !user.locked);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        return false;
      }
    },
  },
  Mutation: {
    sendPasswordResetEmail: async (_, { email }, context: MyContext): Promise<boolean> => {
      const reference = 'sendPasswordResetEmail resolver';
      try {
        const userEmail = await UserEmail.findByEmail(reference, context, email);
        const user = userEmail[0] ? await User.findById(reference, context, userEmail[0].userId) : null;

        if (user && user.active && !user.locked) {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const hashedToken = hashToken(rawToken);
          const expiresAt = getFutureDate(generalConfig.passwordResetTokenExpiryMilliseconds);

          await PasswordResetToken.createForUser(context, user.id, hashedToken, expiresAt);
          await sendResetPasswordEmail(context, user, userEmail[0].email, rawToken);
        }
        return true;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        return true;
      }
    },

    resetPassword: async (_, { token, newPassword }, context: MyContext): Promise<boolean> => {
      const reference = 'resetPassword resolver';
      try {
        const hashedToken = hashToken(token);
        // Find the active token record for the provided hashed token
        const resetTokenRecord = await PasswordResetToken.findValidByToken(context, hashedToken);
        if (!resetTokenRecord) {
          throw ForbiddenError(); // Invalid or expired token
        }

        const user = await User.findById(reference, context, resetTokenRecord.userId);
        if (!user || !user.active || user.locked) {
          throw ForbiddenError();
        }

        const passwordSet = await user.setPassword(context, newPassword);
        if (!passwordSet) {
          throw InternalServerError();
        }

        await resetTokenRecord.markUsed(context);

        return true;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },
};