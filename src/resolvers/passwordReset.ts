
import { Resolvers } from "../types";
import { MyContext } from '../context';
import { User } from '../models/User';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { hashToken } from '../utils/helpers';
import { sendResetPasswordEmail } from '../services/emailService'; // wherever this lives
import { ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { GraphQLError } from "graphql";
import { prepareObjectForLogs } from "../logger";
import { UserEmail } from "../models/UserEmail";

export const resolvers: Resolvers = {
  Query: {
    // Validate the reset token for a password reset request
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
    // Send a password reset email to the user with a valid account
    sendPasswordResetEmail: async (_, { email }, context: MyContext): Promise<boolean> => {
      const reference = 'sendPasswordResetEmail resolver';
      try {
        // We will only allow reset for user's primary
        const userEmails = await UserEmail.findByEmail(reference, context, email);
        const matchingEmail = userEmails.find(
          userEmail => userEmail.email === email
        );

        if (!matchingEmail || !matchingEmail.isPrimary) {
          return true; // Don't reveal whether the email exists or is primary
        }

        const user = await User.findById(reference, context, matchingEmail.userId);

        if (user && user.active && !user.locked) {
          const created = await PasswordResetToken.createForUser(context, user.id);
          if (!created) {
            context.logger.error(prepareObjectForLogs({ userId: user.id }), `${reference} - failed to create reset token`);
            return true; // exits here — sendResetPasswordEmail is skipped
          }
          await sendResetPasswordEmail(context, user, matchingEmail.email, created.rawToken);
        }
        return true;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        return true;
      }
    },
    // Reset the user's password using a valid reset token
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

        const marked = await resetTokenRecord.markUsed(context);
        if (!marked) {
          context.logger.error(prepareObjectForLogs({ tokenId: resetTokenRecord.id }), `${reference} - failed to mark token as used`);
        }

        return true;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },
};