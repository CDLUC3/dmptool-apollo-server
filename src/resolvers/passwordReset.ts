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
import { revokeAccessToken, revokeRefreshToken, verifyAccessToken } from '../services/tokenService';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const resolvers: Resolvers = {
  Query: {
    validatePasswordResetToken: async (_, { token }, context: MyContext): Promise<boolean> => {
      const reference = 'validatePasswordResetToken resolver';
      try {
        console.log("***Token", token);
        const hashedToken = hashToken(token);
        console.log("***hashedToken", hashedToken);
        const resetTokenRecord = await PasswordResetToken.findValidByToken(context, hashedToken);
        console.log("***resetTokenRecord", resetTokenRecord);
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

          // If the requester is currently logged in as this same user, log them out now
          if (context.token?.id === user.id && context.token?.jti) {
            await revokeRefreshToken(context, context.token.jti);
            await revokeAccessToken(context, context.token.jti);
          }
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