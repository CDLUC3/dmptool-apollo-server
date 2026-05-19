
import { prepareObjectForLogs } from '../logger';
import { Resolvers } from "../types";
import { MemberRole } from "../models/MemberRole";
import { MyContext } from '../context';
import { isSuperAdmin } from '../services/authService';
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
} from '../utils/graphQLErrors';
import { GraphQLError } from 'graphql';
import { normaliseDateTime } from "../utils/helpers";

export const resolvers: Resolvers = {
  Query: {
    // returns an array of all member roles
    memberRoles: async (_, __, context: MyContext): Promise<MemberRole[]> => {
      const reference = 'memberRoles resolver';
      try {
        return await MemberRole.all(reference, context);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // returns a member role that matches the specified ID
    memberRoleById: async (_, { memberRoleId }, context: MyContext): Promise<MemberRole> => {
      const reference = 'memberRoleById resolver';
      try {
        return await MemberRole.findById(reference, context, memberRoleId);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // returns the member role that matches the specified URL
    memberRoleByURL: async (_, { memberRoleURL }, context: MyContext): Promise<MemberRole> => {
      const reference = 'memberRoleByURL resolver';
      try {
        return await MemberRole.findByURL(reference, context, memberRoleURL);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new MemberRole
    addMemberRole: async (_, { url, label, displayOrder, description }, context) => {
      const reference = 'addMemberRole resolver';
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          const sql = 'INSERT INTO memberRoles (url, label, description, displayOrder) VALUES (?, ?, ?)';
          const resp = await context.dataSources.sqlDataSource.query(context, sql, [url, label, description, displayOrder.toString()]);
          const created = await MemberRole.findById(reference, context, resp[0].insertId);

          if (created?.id) {
            return created;
          }

          // A null was returned so add a generic error and return it
          const newRole = new MemberRole({ url, label, description, displayOrder });
          if (!newRole.errors['general']) {
            newRole.addError('general', 'Unable to create MemberRole');
          }
          return newRole;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing MemberRole
    updateMemberRole: async (_, { id, url, label, displayOrder, description }, context) => {
      const reference = 'updateMemberRole resolver';
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          const sql = 'UPDATE memberRoles SET url = ?, label = ?, description = ?, displayOrder = ?) WHERE id = ?';
          await context.dataSources.sqlDataSource.query(context, sql, [url, label, description, displayOrder.toString(), id.toString()]);
          return await MemberRole.findById(reference, context, id);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // remove a MemberRole
    removeMemberRole: async (_, { id }, context) => {
      const reference = 'removeMemberRole resolver';
      const original = await MemberRole.findById(reference, context, id);
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          const sql = 'DELETE FROM memberRoles WHERE id = ?';
          await context.dataSources.sqlDataSource.query(context, sql, [id.toString()]);
          return original;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  MemberRole: {
    created: (parent: MemberRole) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: MemberRole) => {
      return normaliseDateTime(parent.modified);
    }
  }
};
