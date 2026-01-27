
import { prepareObjectForLogs } from '../logger';
import { Resolvers } from "../types";
import { DEFAULT_DMPTOOL_LICENSE_URL, License } from "../models/License";
import { MyContext } from '../context';
import { isAdmin, isSuperAdmin } from '../services/authService';
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from '../utils/graphQLErrors';
import { GraphQLError } from 'graphql';
import { isNullOrUndefined, normaliseDateTime } from '../utils/helpers';

export const resolvers: Resolvers = {
  Query: {
    // returns all licenses
    licenses: async (_, __, context: MyContext): Promise<License[]> => {
      const reference = 'licenses resolver';
      try {
        return await License.all(reference, context);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // returns a list of recommended licenses
    recommendedLicenses: async (_, { recommended }, context: MyContext): Promise<License[]> => {
      const reference = 'recommendedLicenses resolver';
      try {
        return await License.recommended(reference, context, recommended);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a single license
    license: async (_, { uri }, context: MyContext): Promise<License> => {
      const reference = 'license resolver';
      try {
        return await License.findByURI(reference, context, uri);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new license
    addLicense: async (_, { name, uri, description, recommended }, context: MyContext) => {
      const reference = 'addLicense resolver';
      try {
        if (isAdmin(context.token)) {
          const newLicense = new License({ name, uri, description, recommended});

          // Only a SuperAdmin can define a default recommended license
          if (!isSuperAdmin(context.token)) {
            newLicense.recommended = false;
          }

          const created = await newLicense.create(context);

          if (created?.id) {
            return created;
          }

          // A null was returned so add a generic error and return it
          if (!newLicense.errors['general']) {
            newLicense.addError('general', 'Unable to create License');
          }
          return newLicense;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing license
    updateLicense: async (_, { uri, name, description, recommended }, context) => {
      const reference = 'updateLicense resolver';
      try {
        // If the user is a an admin and its a DMPTool managed license (no updates to licenses managed elsewhere!)
        if (isAdmin(context.token) && uri.startsWith(DEFAULT_DMPTOOL_LICENSE_URL)) {
          const license = await License.findByURI(reference, context, uri);
          if (isNullOrUndefined(license)) {
            throw NotFoundError();
          }

          const toUpdate = new License({ id: license.id, uri: license.uri, name, description, recommended });

          // Only a SuperAdmin can define a default recommended license, so leave as-is
          if (!isSuperAdmin(context.token)) {
            toUpdate.recommended = license.recommended;
          }

          return await toUpdate.update(context);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // remove an existing license
    removeLicense: async (_, { uri }, context) => {
      const reference = 'removeLicense resolver';
      try {
        // If the user is an admin and its a DMPTool managed license (no removals of licenses managed elsewhere!)
        if (isAdmin(context.token) && uri.startsWith(DEFAULT_DMPTOOL_LICENSE_URL)) {
          const license = await License.findByURI(reference, context, uri);
          if (isNullOrUndefined(license)) {
            throw NotFoundError();
          }

          // TODO: We should do a check to see if it has been used and then either NOT allow the deletion
          //       or notify that it is being done and to what DMPs
          return await license.delete(context);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // merge two licenses
    mergeLicenses: async (_, { licenseToKeepId, licenseToRemoveId }, context) => {
      const reference = 'mergeLicenses resolver';
      try {
        if (isSuperAdmin(context.token)) {
          const toKeep = await License.findById(reference, context, licenseToKeepId);
          const toRemove = await License.findById(reference, context, licenseToRemoveId);

          if (!toKeep || !toRemove) {
            throw NotFoundError();
          }
          //No removals of licenses managed elsewhere!
          if (!toRemove.uri.startsWith(DEFAULT_DMPTOOL_LICENSE_URL)) {
            throw ForbiddenError();
          }

          // Only modify the one we want to keep if it is a DMP Tool managed license!
          if (toKeep.uri.startsWith(DEFAULT_DMPTOOL_LICENSE_URL)) {
            // Merge the description in if the one we want to keep does not have one
            if (!toKeep.description) {
              toKeep.description = toRemove.description
            }
            // If the one being removed is recommended then make sure the one we keep is recommended
            if (toRemove.recommended) {
              toKeep.recommended = true;
            }
            await toKeep.update(context);
          }

          // TODO: We will need to update the identifiers for any project outputs that ref the one being removed!

          // Delete the one we want to remove
          await toRemove.delete(context);
          return toKeep;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  License: {
    created: (parent: License) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: License) => {
      return normaliseDateTime(parent.modified);
    }
  }
};
