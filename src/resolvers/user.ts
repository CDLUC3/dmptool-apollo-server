import { Resolvers, UserSearchResults } from "../types";
import { MyContext } from '../context';
import { User, UserRole } from '../models/User';
import { UserEmail } from "../models/UserEmail";
import { Affiliation } from '../models/Affiliation';
import { Plan } from '../models/Plan';
import { isAdmin, isAuthorized, isSuperAdmin } from "../services/authService";
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from "../utils/graphQLErrors";
import { defaultLanguageId } from "../models/Language";
import { anonymizeUser, mergeUsers } from "../services/userService";
import { processOtherAffiliationName } from "../services/affiliationService";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'u.surName',
  email: 'ue.email',
  role: 'u.role',
  active: 'u.active',
  created: 'u.created',
  lastActivity: 'u.last_sign_in',
  organization: 'a.name',
};

export const resolvers: Resolvers = {
  Query: {
    // returns the current User
    me: async (_, __, context: MyContext): Promise<User> => {
      const reference = 'me resolver';
      try {
        if (isAuthorized(context?.token)) {
          return await User.findById(reference, context, context.token.id);
        }
        throw AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Should only be callable by an Admin. Super returns all users, Admin gets only
    // the users associated with their affiliationId
    users: async (_, { term, role, paginationOptions }, context): Promise<UserSearchResults> => {
      const reference = 'users resolver';

      try {
        // Map the frontend column id to a SQL field before building opts
        if (paginationOptions?.sortField) {
          paginationOptions.sortField = SORT_FIELD_MAP[paginationOptions.sortField] ?? 'u.created';
        }

        const opts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
          ? paginationOptions as PaginationOptionsForOffsets
          : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

        if (isSuperAdmin(context.token)) {
          return await User.search(reference, context, term, opts, role as unknown as UserRole,);

        } else if (isAdmin(context.token)) {
          return await User.findByAffiliationIdAndUserRole(reference, context, context.token.affiliationId, term, role as unknown as UserRole, opts);
        }

        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // This query should only be available to Admins. Super can get any user and Admin can get
    // only users associated with their affiliationId
    user: async (_, { userId }, context: MyContext): Promise<User> => {
      const reference = 'user resolver';
      try {
        if (isAdmin(context.token)) {
          const user = await User.findById(reference, context, userId);
          if (!user) {
            throw NotFoundError();
          }
          // Make sure the Admin is from the same Affiliation or the user is a SuperAdmin
          if (context.token?.affiliationId === user.affiliationId || isSuperAdmin(context.token)) {
            return user;
          }
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // Update the current user's information
    updateUserProfile: async (_, { input: {
      givenName,
      surName,
      affiliationId,
      otherAffiliationName,
      languageId,
    } }, context: MyContext): Promise<User> => {
      const reference = 'updateUserProfile resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          // Either use the affiliationId provided or create one
          if (otherAffiliationName) {
            const affiliation = await processOtherAffiliationName(context, otherAffiliationName);
            if (affiliation.hasErrors()) {
              const err = affiliation.errors?.general ?? 'Unable to save the affiliation at this time';
              user.addError('otherAffiliationName', err);
              return user;
            }
            user.affiliationId = affiliation.uri;
          } else {
            user.affiliationId = affiliationId;
          }

          user.givenName = givenName;
          user.surName = surName;
          user.languageId = languageId || defaultLanguageId;
          const updated = await new User(user).update(context);
          if (!updated || updated.hasErrors()) {
            user.addError('general', 'Unable to save the profile changes at this time');
          }
          return user.hasErrors() ? user : updated;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update the current user's email notifications
    updateUserNotifications: async (_, { input: {
      notify_on_comment_added,
      notify_on_template_shared,
      notify_on_feedback_complete,
      notify_on_plan_shared,
      notify_on_plan_visibility_change,
    } }, context: MyContext): Promise<User> => {
      const reference = 'updateUserNotifications resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          user.notify_on_comment_added = notify_on_comment_added || true;
          user.notify_on_template_shared = notify_on_template_shared || true;
          user.notify_on_feedback_complete = notify_on_feedback_complete || true;
          user.notify_on_plan_shared = notify_on_plan_shared || true;
          user.notify_on_plan_visibility_change = notify_on_plan_visibility_change || true;
          const updated = await new User(user).update(context);
          if (!updated || updated.hasErrors()) {
            user.addError('general', 'Unable to save the notification settings at this time');
          }
          return user.hasErrors() ? user : updated;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Anonymize the current user's account (essentially deletes their account without orphaning things)
    removeUser: async (_, __, context: MyContext): Promise<User> => {
      const reference = 'removeUser resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }
          const updated = await anonymizeUser(context, user);
          if (!updated || updated.hasErrors()) {
            user.addError('general', 'Unable to remove your account at this time');
          }
          return user.hasErrors() ? user : updated;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Set the user's ORCID
    setUserOrcid: async (_, { orcid }, context: MyContext): Promise<User> => {
      const reference = 'setUserOrcid resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          user.orcid = orcid;
          const updated = await new User(user).update(context);
          if (!updated || updated.hasErrors()) {
            user.addError('general', 'Unable to save the ORCID at this time');
          }
          return user.hasErrors() ? user : updated;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Add an email address for the current user
    addUserEmail: async (_, { email, isPrimary }, context: MyContext): Promise<UserEmail> => {
      const reference = 'addUserEmail resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }
          const userEmail = new UserEmail({ userId: context.token.id, email: email, isPrimary: isPrimary || false });
          const created = await userEmail.create(context);
          if (!created || created.hasErrors()) {
            userEmail.addError('general', 'Unable to add the email at this time');
          }
          return userEmail.hasErrors() ? userEmail : created;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Remove an email address from the current user
    removeUserEmail: async (_, { email }, context: MyContext): Promise<UserEmail> => {
      const ref = 'removeUserEmail resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(ref, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          const userEmail = await UserEmail.findByUserIdAndEmail(ref, context, context.token.id, email);
          if (!userEmail) {
            throw NotFoundError();
          }

          const deleted = await new UserEmail(userEmail).delete(context);
          if (!deleted || deleted.hasErrors()) {
            userEmail.addError('general', 'Unable to remove the email at this time');
          }
          return userEmail.hasErrors() ? userEmail : deleted;
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${ref}`);
        throw InternalServerError();
      }
    },

    // Designate the email as the current user's primary email address
    setPrimaryUserEmail: async (_, { email }, context: MyContext): Promise<UserEmail[]> => {
      const ref = 'setPrimaryUserEmail resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(ref, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          const userEmails = await UserEmail.findByUserId(ref, context, context.token.id);
          const existing = userEmails.find((entry) => { return entry.email === email });
          const originalState = { ...existing };
          const oldPrimary = userEmails.find((entry) => { return Boolean(entry.isPrimary) === true });

          if (!existing) {
            throw NotFoundError();
          }

          existing.isPrimary = true;
          const updated = await new UserEmail(existing).update(context);
          if (updated && !updated.hasErrors()) {
            // Update old primary record to isPrimary = false, if the new one was updated successfullly
            if (oldPrimary) {
              oldPrimary.isPrimary = false;
              await new UserEmail(oldPrimary).update(context);
            }

            if (await User.update(context, new User(user).tableName, user, ref, ['password'])) {
              return await UserEmail.findByUserId(ref, context, user.id);
            }
          } else {
            // On error, revert to the original state
            const mergedData = { ...existing, ...originalState, errors: updated.errors };
            const originalWithErrors = new UserEmail(mergedData);

            // Set errors explicitly to avoid being overwritten by the UserEmail instance initialization
            originalWithErrors.errors = updated.errors || {};

            return [originalWithErrors];
          }

          throw InternalServerError('Unable to remove the email at this time');
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${ref}`);
        throw InternalServerError();
      }
    },

    // Change the current user's password
    updatePassword: async (_, { oldPassword, newPassword, email }, context: MyContext): Promise<User> => {
      const reference = 'updatePassword resolver';
      try {
        if (isAuthorized(context?.token)) {
          const user = await User.findById(reference, context, context.token.id);
          // Only continue if the user is active and not locked
          if (!user || !user.active || user.locked) {
            throw ForbiddenError();
          }

          const updated = await new User(user).updatePassword(context, oldPassword, newPassword, email);
          if (!updated || updated.hasErrors()) {
            user.addError('general', 'Unable to update the password at this time');
          }
          return user.hasErrors() ? user : User.findById(reference, context, context.token.id);
        }
        // Unauthenticated
        throw AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Deactivate the specified user Account (SuperAdmin and Admin only)
    deactivateUser: async (_, { userId }, context: MyContext): Promise<User> => {
      const reference = 'deactivateUser resolver';
      try {
        if (isAdmin(context.token)) {
          const result = await User.findById(reference, context, userId);

          if (!result) {
            throw NotFoundError();
          }

          // For some reason these are being returned a Objects and not User!
          const user = new User(result);
          // Only continue if the current user's affiliation matches the user OR they are SuperAdmin
          if (context.token.affiliationId === user.affiliationId || isSuperAdmin(context.token)) {
            user.active = false;
            const updated = await User.update(context, new User(user).tableName, user, reference, ['password']);

            if (!updated || updated.hasErrors()) {
              user.addError('general', 'Unable to deactivate the user at this time');
            }
            // Return the result, because updated will not return a User since they are now inactive
            return user.hasErrors() ? user : await User.findById(reference, context, userId);
          }
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Reactivate the specified user Account (SuperAdmin and Admin only)
    activateUser: async (_, { userId }, context: MyContext): Promise<User> => {
      const reference = 'activateUser resolver';
      try {
        if (isAdmin(context.token)) {
          const result = await User.findById(reference, context, userId);

          if (!result) {
            throw NotFoundError();
          }

          // For some reason these are being returned a Objects and not User!
          const user = new User(result);
          // Only continue if the current user's affiliation matches the user OR they are SuperAdmin
          if (context.token.affiliationId === user.affiliationId || isSuperAdmin(context.token)) {
            user.active = true;
            const updated = await User.update(context, user.tableName, user, reference, ['password']);

            if (!updated || updated.hasErrors()) {
              user.addError('general', 'Unable to activate the user at this time');
            }
            return user.hasErrors() ? user : await User.findById(reference, context, userId);
          }
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Merge the 2 user accounts (SuperAdmin and Admin only)
    mergeUsers: async (_, { userIdToBeMerged, userIdToKeep }, context: MyContext): Promise<User> => {
      const reference = 'mergeUsers resolver';
      try {
        if (isAdmin(context.token)) {
          const userToMerge = await User.findById(reference, context, userIdToBeMerged);
          const userToKeep = await User.findById(reference, context, userIdToKeep);

          if (!userToMerge || !userToKeep) {
            throw NotFoundError();
          }

          // Only continue if the current user's affiliation matches the user OR they are SuperAdmin
          const affil = context.token.affiliationId;
          if (
            (affil === userToMerge.affiliationId && affil === userToKeep.affiliationId) ||
            isSuperAdmin(context.token)
          ) {
            const merged = await mergeUsers(context, userToMerge, userToKeep);
            if (!merged || merged.hasErrors()) {
              userToKeep.addError('general', 'Unable to merge the users at this time');
            }

            return userToKeep.hasErrors() ? userToKeep : merged;
          }
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  User: {
    // Chained resolver to fetch the Affiliation info for the user
    affiliation: async (parent: User, _, context): Promise<Affiliation> => {
      return await Affiliation.findByURI('Chained User.affiliation', context, parent.affiliationId);
    },
    // Chained resolver to fetch the secondary email addresses
    emails: async (parent: User, _, context): Promise<UserEmail[]> => {
      return await UserEmail.findByUserId('Chained User.emails', context, parent.id);
    },
    // Chained resolver to fetch the primary email address
    email: async (parent: User, _, context): Promise<string | null> => {
      const primaryEmail = await UserEmail.findPrimaryByUserId('Chained User.email', context, parent.id);
      return primaryEmail ? primaryEmail.email : null;
    },
    // Chained resolver to fetch plans associated with the user
    plans: async (parent: User, _, context): Promise<Plan[]> => {
      console.log("***User ID in User.plans resolver: ", parent.id);
      return await Plan.findByUserId('Chained User.plans', context, parent.id);
    },
    last_sign_in: (parent: User) => {
      return normaliseDateTime(parent.last_sign_in);
    },
    created: (parent: User) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: User) => {
      return normaliseDateTime(parent.modified);
    }
  },
};
