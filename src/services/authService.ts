import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { MyContext } from "../context";
import { UserRole } from "../models/User";
import { JWTAccessToken } from "./tokenService";
import { prepareObjectForLogs } from "../logger";
import { AuthenticatedResolverType } from "../types/general";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError
} from "../utils/graphQLErrors";
import { isNullOrUndefined } from "../utils/helpers";

/**
 * Wraps an Apollo Server resolver to ensure that the user is authenticated and
 * has the correct role.
 *
 * @param reference A string to help identify the caller to help with logging.
 * @param authLevel The desired authentication level. Defaults to UserRole.RESEARCHER.
 * @param resolver The Apollo Server resolver to wrap.
 * @returns The wrapped Apollo Server resolver.
 */
export const authenticatedResolver = <TResult, TArgs, TParent = Record<PropertyKey, never>>(
  reference: string,
  authLevel: UserRole = UserRole.RESEARCHER,
  resolver: AuthenticatedResolverType<TResult, TArgs, TParent>
): AuthenticatedResolverType<TResult, TArgs, TParent> => {
  return async (parent: TParent, args: TArgs, context: MyContext, info: GraphQLResolveInfo): Promise<TResult> => {
    try {
      if ((authLevel === UserRole.ADMIN && !isAdmin(context.token))
        || (authLevel === UserRole.SUPERADMIN && !isSuperAdmin(context.token))
        || (authLevel === UserRole.RESEARCHER && !isAuthorized(context.token))
      ) {
        throw context?.token ? ForbiddenError() : AuthenticationError();
      }

      // 2. Execute the actual resolver logic
      return await resolver(parent, args, context, info);

    } catch (err) {
      if (err instanceof GraphQLError) throw err;

      context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
      throw InternalServerError('Something went wrong');
    }
  };
};

/**
 * Checks the JWT token to see if it contains a user id. Note that the Apollo
 * Server and Express middleware will ensure that the token is valid and has not
 * expired.
 *
 * @param token The JWT token to check
 * @returns true if the user is authenticated
 */
export const isAuthorized = (token: JWTAccessToken): boolean => {
    return !isNullOrUndefined(token) && !isNullOrUndefined(token.id);
}

/**
 * Checks the JWT token to see if the current user is an affiliation administrator
 *
 * @param token The JWT token to check
 * @returns true if the user is an affiliation administrator
 */
export const isAdmin = (token: JWTAccessToken): boolean => {
  if(isAuthorized(token) && token.affiliationId) {
    return [UserRole.ADMIN.toString(), UserRole.SUPERADMIN.toString()].includes(token?.role);
  }
  return false;
}

/**
 * Checks the JWT token to see if the current user is a super admin
 *
 * @param token The JWT token to check
 * @returns true if the user is a super admin
 */
export const isSuperAdmin = (token: JWTAccessToken): boolean => {
  return isAuthorized(token) && token?.role === UserRole.SUPERADMIN;
}
