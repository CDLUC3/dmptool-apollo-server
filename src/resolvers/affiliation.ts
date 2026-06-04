import {
  AffiliationEmailDomainInput, AffiliationInput,
  AffiliationLinkInput,
  AffiliationLogoUpload,
  AffiliationSearchResults,
  Resolvers,
  ResolversParentTypes
} from "../types";
import {MyContext} from '../context';
import {
  Affiliation,
  AffiliationProvenance,
  AffiliationSearch,
  AffiliationType,
  PopularFunder
} from '../models/Affiliation';
import {
  authenticatedResolver,
  isAdmin,
  isSuperAdmin
} from "../services/authService";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import {
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from "../types/general";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { GuidanceGroup } from "../models/GuidanceGroup";
import {
  getAffiliationsWithGuidanceForTemplate
} from "../services/guidanceService";
import {
  CDN_BASE_URL,
  getPresignedURLForAffiliationLogo
} from "../datasources/s3";
import { UserRole } from "../models/User";
import {
  reconcileAffiliationEmailDomains,
  reconcileAffiliationLinks
} from "../services/affiliationService";
import {AffiliationLink} from "../models/AffiliationLink";
import {AffiliationEmailDomain} from "../models/AffiliationEmailDomain";

export const resolvers: Resolvers = {
  Query: {
    // get all affiliation types/categories
    affiliationTypes: async (): Promise<string[]> => {
      return Object.values(AffiliationType);
    },

    // returns an array of Affiliations that match the search criteria
    affiliations: async (_, { name, funderOnly, paginationOptions }, context: MyContext): Promise<AffiliationSearchResults> => {
      const reference = 'affiliations resolver';
      try {
        const opts = !isNullOrUndefined(paginationOptions) && paginationOptions?.type === PaginationType.OFFSET
          ? paginationOptions as PaginationOptionsForOffsets
          : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

        return await AffiliationSearch.search(reference, context, name, funderOnly ?? false, opts);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // returns managed affiliations with published guidance for a specific template
    managedAffiliationsWithGuidance: async (
      _,
      { name, versionedTemplateId, paginationOptions },
      context: MyContext
    ): Promise<AffiliationSearchResults> => {
      const reference = 'managedAffiliationsWithGuidance resolver';
      try {
        // Get affiliation URIs that have guidance for the specified template
        const affiliationUris = await getAffiliationsWithGuidanceForTemplate(
          context,
          versionedTemplateId
        );

        // If no affiliations have guidance, return empty results
        if (affiliationUris.length === 0) {
          return {
            items: [],
            totalCount: 0,
            hasNextPage: false,
            currentOffset: 0
          };
        }

        const opts = !isNullOrUndefined(paginationOptions) && paginationOptions?.type === PaginationType.OFFSET
          ? paginationOptions as PaginationOptionsForOffsets
          : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

        // Search for affiliations matching the URIs and name filter
        return await AffiliationSearch.searchManagedWithPublishedGuidance(
          reference,
          context,
          name ?? undefined,
          affiliationUris,
          opts
        );
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Returns the specified Affiliation by id
    affiliationById: async (_, { affiliationId }, context: MyContext): Promise<Affiliation> => {
      const reference = 'affiliationById resolver';
      try {
        return await Affiliation.findById(reference, context, affiliationId);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Returns the specified Affiliation by URI
    affiliationByURI: async (_, { uri }, context: MyContext): Promise<Affiliation> => {
      const reference = 'affiliationByURI resolver';
      try {
        return await Affiliation.findByURI(reference, context, uri);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Returns the most popular funders
    popularFunders: async (_, __, context: MyContext): Promise<PopularFunder[]> => {
      const reference = 'popularFunders resolver';
      try {
        return await PopularFunder.top5(context);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },

  Mutation: {
    /**
     * Add a new affiliation.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the AffiliationInput
     * @param context The Apollo context
     * @returns The Affiliation (with errors if applicable)
     * @throws NotFoundError when the Affiliation is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error occurred
     */
    addAffiliation: authenticatedResolver(
      'addAffiliation resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AffiliationInput },
        context: MyContext
      ): Promise<Affiliation> => {
        const reference = 'addAffiliation resolver';
        try {
          const affiliation = new Affiliation(input);

          // Only SuperAdmins are allowed to set these properties
          if (!isSuperAdmin(context.token)) {
            affiliation.name = input.displayName;
            affiliation.managed = false;
            affiliation.active = true;
            affiliation.types = null;
            affiliation.ssoEntityId = null;
            // @ts-expect-error transient input-only field used by resolver logic
            affiliation.ssoEmailDomains = [];
          }

          const created = await affiliation.create(context);

          if (created?.id) {
            // If the creation was successful reconcile any AffiliationLinks
            const links: AffiliationLink[] = input.subHeaderLinks.map((shl: AffiliationLinkInput): AffiliationLink => {
              return new AffiliationLink(shl);
            })
            await reconcileAffiliationLinks(context, reference, created, links);

            // If the user is a superAdmin, also reconcile any AffiliationEmailDomains
            const superAdmin: boolean = isSuperAdmin(context.token);
            if (superAdmin) {
              const domains: AffiliationEmailDomain[] = input.ssoEmailDomains.map((ed: AffiliationEmailDomainInput): AffiliationEmailDomain => {
                return new AffiliationEmailDomain(ed);
              })
              await reconcileAffiliationEmailDomains(context, reference, created, domains);
            }

            return created;
          }

          // A null was returned so add a generic error and return it
          if (!affiliation.errors['general']) {
            affiliation.addError('general', 'Unable to create Affiliation');
          }
          return affiliation;
        } catch (err) {
          if (err instanceof GraphQLError) throw err;

          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      }),

    /**
     * ADMIN ONLY: Update the specified Affiliation. SuperAdmins may update any
     *             affiliation, Admins may only update their own.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the AffiliationInput
     * @param context The Apollo context
     * @returns The Affiliation (with errors if applicable)
     * @throws NotFoundError when the Affiliation is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error occurred
     */
    updateAffiliation: authenticatedResolver(
      'updateAffiliation resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AffiliationInput },
        context: MyContext
      ): Promise<Affiliation> => {
        const reference = 'updateAffiliation resolver';
        try {
          const existing: Affiliation = input.id ? await Affiliation.findById(reference, context, input.id) : null;

          // If the record doesn't exist
          if (!existing) {
            throw NotFoundError();
          }

          // If the current user is a superAdmin or an Admin and this is their Affiliation
          const superAdmin: boolean = isSuperAdmin(context.token);
          if (superAdmin || (isAdmin(context.token) && context.token.affiliationId === existing.uri)) {
            const affiliation = new Affiliation(input);

            // Since we pass around the URI for affiliations instead of the id we need to set it here
            if (!affiliation.id) {
              affiliation.id = existing.id;
            }

            // Only SuperAdmins are allowed to set these properties
            if (!superAdmin) {
              affiliation.name = existing.name;
              affiliation.managed = existing.managed;
              affiliation.active = existing.active;
              affiliation.types = existing.types;
              affiliation.ssoEntityId = existing.ssoEntityId;
              // @ts-expect-error transient input-only field used by resolver logic
              affiliation.ssoEmailDomains = existing.ssoEmailDomains;
            }

            const updated: Affiliation = await affiliation.update(context);
            if (updated && !updated.hasErrors()) {
              // If the update was successful reconcile any AffiliationLinks
              const links: AffiliationLink[] = input.subHeaderLinks.map((shl: AffiliationLinkInput): AffiliationLink => {
                return new AffiliationLink(shl);
              })
              await reconcileAffiliationLinks(context, reference, updated, links);

              // If the user is a superAdmin, also reconcile any AffiliationEmailDomains
              if (superAdmin) {
                const domains: AffiliationEmailDomain[] = input.ssoEmailDomains.map((ed: AffiliationEmailDomainInput): AffiliationEmailDomain => {
                  return new AffiliationEmailDomain(ed);
                })
                await reconcileAffiliationEmailDomains(context, reference, updated, domains);
              }
            }
            return updated;
          }
          throw context?.token ? ForbiddenError() : AuthenticationError();
        } catch (err) {
          if (err instanceof GraphQLError) throw err;

          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      }),

    /**
     * SUPER ADMIN ONLY: Remove the specified Affiliation
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the affiliation id
     * @param context The Apollo context
     * @returns The Affiliation (with errors if applicable)
     * @throws NotFoundError when the Affiliation is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error occurred
     */
    removeAffiliation: authenticatedResolver(
      'removeAffiliation resolver',
      UserRole.SUPERADMIN,
      async (
        _: Record<PropertyKey, never>,
        { affiliationId }: { affiliationId: number },
        context: MyContext
      ): Promise<Affiliation> => {
        const reference = 'removeAffiliation resolver';
        try {
          // If the current user is a superAdmin
          if (isSuperAdmin(context.token)) {
            const affiliation = await Affiliation.findById(reference, context, affiliationId);

            // If the URI does not exist, throw an error
            if (!affiliation) {
              throw NotFoundError();
            }

            // If the affiliation is managed by the DMP Tool then we can delete it
            if (affiliation.provenance === AffiliationProvenance.DMPTOOL) {
              return await affiliation.delete(context);
            }
          }
          throw context?.token ? ForbiddenError() : AuthenticationError();
        } catch (err) {
          if (err instanceof GraphQLError) throw err;

          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      }),

    /**
     * ADMIN ONLY: Get a presigned URL that can be used to upload an Affiliation logo.
     *             The URL and fields returned are used to upload the logo to S3.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the affiliation URI and the file name of the logo
     * @param context The Apollo context
     * @returns The Affiliation (with errors if applicable)
     * @throws NotFoundError when the Affiliation is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error occurred
     */
    generateLogoUploadURL: authenticatedResolver(
      'generateLogoUploadURL resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { affiliationURI, fileName, contentType }: {
          affiliationURI: string,
          fileName: string,
          contentType: string
        },
        context: MyContext
      ): Promise<AffiliationLogoUpload> => {
        // Make sure the current user's affiliation matches the one specified if they are an ADMIN
        if (context.token.role === UserRole.ADMIN && context.token.affiliationId === affiliationURI) {
          return await getPresignedURLForAffiliationLogo(context.logger, affiliationURI, fileName, contentType);
        }
        throw ForbiddenError();
      }),

    /**
     * ADMIN ONLY: Finalizes the upload of an affiliation logo to the CloudFront CDN S3 bucket.
     *             The logoName should equal the 'key' from the fields returned by the generateLogoUploadURL mutation.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the affiliation URI and the name of the logo (S3 key)
     * @param context The Apollo context
     * @returns The Affiliation (with errors if applicable)
     * @throws NotFoundError when the Affiliation is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error occurred
     */
    finalizeLogoUpload: authenticatedResolver(
      'finalizeLogoUpload resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { affiliationURI, logoName }: { affiliationURI: string, logoName: string },
        context: MyContext
      ): Promise<Affiliation> => {
        // Make sure the current user's affiliation matches the one specified if they are an ADMIN
        if (context.token.role === UserRole.ADMIN && context.token.affiliationId === affiliationURI) {
          const reference = 'finalizeLogoUpload resolver';
          const affiliation = await Affiliation.findByURI(reference, context, affiliationURI);

          if (!affiliation) {
            throw NotFoundError();
          }

          affiliation.logoName = logoName;
          const updated = await affiliation.update(context);
          if (isNullOrUndefined(updated)) {
            affiliation.addError('general', 'Unable to save the logo at this time');
            return affiliation;
          }

          return updated;
        }
        throw ForbiddenError();
      }),
  },

  Affiliation: {
    logoURI: (parent: Affiliation): string => {
      return `${CDN_BASE_URL}${parent.logoName}`;
    },
    guidanceGroups: async (parent: ResolversParentTypes['Affiliation'], _, context: MyContext): Promise<GuidanceGroup[]> => {
      const reference = 'Affiliation.guidanceGroups resolver';
      try {
        // Require authentication
        const requester = context?.token;
        if (!requester) {
          throw AuthenticationError();
        }

        // Fetch all guidance groups for the affiliation
        const groups = await GuidanceGroup.findByAffiliationId(reference, context, parent.uri);

        // Determine once whether the requester can see ALL groups for this affiliation:
        // - Super-admin can see everything
        // - Admin for the target affiliation can see everything for that affiliation
        const canSeeAll = isSuperAdmin(requester) || (isAdmin(requester) && requester.affiliationId === parent.uri);

        if (canSeeAll) {
          return groups;
        }

        // Non-admin users or non-admins for group's affiliation: filter to published only
        // src/resolvers/affiliation.ts (replace the filter body)
        const publishedOnly = groups.filter(g => {
          const record = g as unknown as Record<string, unknown>;
          const latestPublishedDate = typeof record['latestPublishedDate'] === 'string'
            ? (record['latestPublishedDate'] as string)
            : undefined;
          const publishedFlag = typeof record['published'] === 'boolean'
            ? (record['published'] as boolean)
            : undefined;
          return Boolean(latestPublishedDate || publishedFlag);
        }) as GuidanceGroup[];


        return publishedOnly;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    created: (parent: ResolversParentTypes['Affiliation']) => {
      return normaliseDateTime(parent.created ?? null);
    },
    modified: (parent: ResolversParentTypes['Affiliation']) => {
      return normaliseDateTime(parent.modified ?? null);
    }
  }
}
