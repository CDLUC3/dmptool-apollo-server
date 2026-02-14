import { prepareObjectForLogs } from '../logger';
import { RepositorySearchResults, Resolvers } from "../types";
import { DEFAULT_DMPTOOL_REPOSITORY_URL, Repository, RepositoryType } from "../models/Repository";
import { MyContext } from '../context';
import { isAdmin, isAuthorized, isSuperAdmin } from '../services/authService';
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from '../utils/graphQLErrors';
import { ResearchDomain } from '../models/ResearchDomain';
import {
  isNullOrUndefined,
  normaliseDateTime,
} from '../utils/helpers';
import { GraphQLError } from 'graphql';
import { PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from '../types/general';
import { RepositoryService } from '../services/repositoryService';
import {
  isCustomRepository,
  isRe3DataRepository,
  RepositorySourceType,
} from '../types/repository';
import { openSearchFindRe3DataSubjects, openSearchFindRe3DataRepositoryTypes } from '../services/openSearchService';

export const resolvers: Resolvers = {
  Query: {
    // searches both custom and re3data repositories
    repositories: async (_, { input }, context: MyContext): Promise<RepositorySearchResults> => {
      const reference = 'repositories resolver';
      try {
        if (isAuthorized(context.token)) {
          const {
            term,
            subjects,
            keyword,
            repositoryType,
            paginationOptions,
          } = input;
          // Convert string repository type (e.g., "multidisciplinary") to enum value (e.g., "MULTI_DISCIPLINARY")
          let repoType = null;
          if (repositoryType) {
            // Map database format strings to enum values
            const typeMap: Record<string, string> = {
              'disciplinary': RepositoryType.DISCIPLINARY,
              'generalist': RepositoryType.GENERALIST,
              'institutional': RepositoryType.INSTITUTIONAL,
              'other': RepositoryType.OTHER,
              'governmental': RepositoryType.GOVERNMENTAL,
              'government': RepositoryType.GOVERNMENTAL, // alternate spelling
              'govermental': RepositoryType.GOVERNMENTAL, // misspelling support
              'project-related': RepositoryType.PROJECT_RELATED,
              'multidisciplinary': RepositoryType.MULTI_DISCIPLINARY,
            };

            repoType = typeMap[repositoryType.toLowerCase()];
          }

          const opts = !isNullOrUndefined(paginationOptions) &&
            paginationOptions.type === PaginationType.OFFSET
            ? (paginationOptions as PaginationOptionsForOffsets)
            : {
              ...paginationOptions,
              type: PaginationType.CURSOR,
            } as PaginationOptionsForCursors;

          const results = await RepositoryService.searchCombined(
            reference,
            context,
            term,
            subjects,
            keyword,
            repoType,
            opts,
          );

          // Cast results to RepositorySearchResults
          // items array contains Repository model instances or Re3DataRepositoryRecord objects
          // which will be resolved to proper GraphQL types by field resolvers
          return {
            ...results,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: results.items as any,
          } as RepositorySearchResults;
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    // return a single custom repository
    repository: async (_, { uri }, context: MyContext) => {
      const reference = 'repository resolver';
      try {
        if (isAuthorized(context.token)) {
          const repo = await Repository.findByURI(reference, context, uri);
          // Field resolvers will add the source field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return repo as any;
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    // return all distinct subject area keywords across all repositories
    repositorySubjectAreas: async (_, __, context: MyContext): Promise<string[]> => {
      const reference = 'repositorySubjectAreas resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Repository.findAllDistinctKeywords(
            reference,
            context,
          );
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    // Return custom repositories matching a list of unique URIs
    repositoriesByURIs: async (_, { uris }, context: MyContext) => {
      const reference = 'repositoriesByURIs resolver';
      try {
        if (isAuthorized(context.token)) {
          const repos = await Repository.findByURIs(reference, context, uris);
          // Field resolvers will add the source field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return repos as any;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    // Return re3data repositories matching a list of unique URIs
    re3byURIs: async (_, { uris }, context: MyContext) => {
      const reference = 're3byURIs resolver';
      try {
        if (isAuthorized(context.token)) {
          const repos = await RepositoryService.searchRe3DataByURIs(
            reference,
            context,
            uris,
          );
          // Field resolvers will add the source field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return repos as any;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    // Return all distinct subject strings from re3data with optional counts
    re3SubjectList: async (_, { input }, context: MyContext) => {
      const reference = 're3SubjectList resolver';
      try {
        if (isAuthorized(context.token)) {
          const includeCount = input?.includeCount ?? false;
          const maxResults = input?.maxResults ?? 100;

          const subjectData = await openSearchFindRe3DataSubjects(
            context,
            includeCount,
            maxResults,
          );

          return {
            subjects: subjectData.map((item) => ({
              subject: item.subject,
              count: item.count,
            })),
            totalCount: subjectData.length,
          };
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    re3RepositoryTypesList: async (_, { input }, context: MyContext) => {
      const reference = 're3RepositoryTypesList resolver';
      try {
        if (isAuthorized(context.token)) {
          const includeCount = input?.includeCount ?? false;
          const maxResults = input?.maxResults ?? 100;

          const typeData = await openSearchFindRe3DataRepositoryTypes(
            context,
            includeCount,
            maxResults,
          );

          return {
            types: typeData.map((item) => ({
              type: item.type,
              count: item.count,
            })),
            totalCount: typeData.length,
          };
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new custom Repository
    addRepository: async (_, { input }, context: MyContext) => {
      const reference = 'addRepository resolver';
      try {
        if (isAuthorized(context.token)) {
          const newRepo = new Repository(input);
          const created = await newRepo.create(context);

          if (!created?.id) {
            // A null was returned so add a generic error and return it
            if (!newRepo.errors['general']) {
              newRepo.addError('general', 'Unable to create Repository');
            }
            return { ...newRepo, source: RepositorySourceType.CUSTOM };
          }

          // If any ResearchDomains were specified and there were no errors creating the record
          if (Array.isArray(input.researchDomainIds)) {
            if (created && !created.hasErrors()) {
              const addErrors = [];
              // Add any researchDomains associations
              for (const id of input.researchDomainIds) {
                const domain = await ResearchDomain.findById(
                  reference,
                  context,
                  id,
                );
                if (domain) {
                  const wasAdded = await domain.addToRepository(
                    context,
                    created.id,
                  );
                  if (!wasAdded) {
                    addErrors.push(domain.name);
                  }
                }
              }
              // if any errors were found when adding/removing tags then return them
              if (addErrors.length > 0) {
                created.addError(
                  'researchDomains',
                  `Created but unable to assign domains: ${addErrors.join(', ')}`,
                );
              }
            }
          }
          const result = created.hasErrors()
            ? created
            : await Repository.findById(reference, context, created.id);
          // Field resolvers will add the source field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return result as any;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    updateRepository: async (_, { input }, context) => {
      const reference = 'updateRepository resolver';
      try {
        const repo = await Repository.findById(
          reference,
          context,
          input.id,
        );
        if (!repo) {
          throw NotFoundError();
        }

        // If the user is an admin and its a DMPTool added repository (no updates to repos managed elsewhere!)
        if (
          isAdmin(context.token) &&
          repo.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)
        ) {
          const toUpdate = new Repository(input);
          const updated = await toUpdate.update(context);

          // If there were no errors creating the record
          if (updated && !updated.hasErrors()) {
            // Fetch all of the current ResearchDomains associated with this MetadataStandard
            const researchDomains =
              await ResearchDomain.findByRepositoryId(
                reference,
                context,
                repo.id,
              );
            const currentDomainIds = researchDomains
              ? researchDomains.map((d) => d.id)
              : [];

            // Use the helper function to determine which ResearchDomains to keep
            const { idsToBeRemoved, idsToBeSaved } =
              Repository.reconcileAssociationIds(
                currentDomainIds,
                input.researchDomainIds,
              );

            const associationErrors = [];
            // Delete any ResearchDomain associations that were removed
            const removeErrors = [];
            for (const id of idsToBeRemoved) {
              const dom = await ResearchDomain.findById(
                reference,
                context,
                id,
              );
              if (dom) {
                const wasRemoved = dom.removeFromRepository(
                  context,
                  updated.id,
                );
                if (!wasRemoved) {
                  removeErrors.push(dom.name);
                }
              }
            }
            // if any errors were found when adding/removing tags then return them
            if (removeErrors.length > 0) {
              associationErrors.push(
                `unable to remove domains: ${removeErrors.join(', ')}`,
              );
            }

            // Add any new ResearchDomain associations
            const addErrors = [];
            for (const id of idsToBeSaved) {
              const dom = await ResearchDomain.findById(
                reference,
                context,
                id,
              );
              if (dom) {
                const wasAdded = dom.addToRepository(context, updated.id);
                if (!wasAdded) {
                  addErrors.push(dom.name);
                }
              }
            }
            // if any errors were found when adding/removing tags then return them
            if (addErrors.length > 0) {
              associationErrors.push(
                `unable to assign domains: ${addErrors.join(', ')}`,
              );
            }

            // If any errors were encountered adding/removing associations
            if (associationErrors.length > 0) {
              updated.addError(
                'researchDomains',
                `Updated but ${associationErrors.join('; ')}`,
              );
            }

            // Reload since the research domains may have changed
            const result = updated.hasErrors()
              ? updated
              : await Repository.findById(reference, context, repo.id);
            // Field resolvers will add the source field
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return result as any;
          }
          // Otherwise there were errors so return the object with errors
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return updated as any;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    removeRepository: async (_, { repositoryId }, context) => {
      const reference = 'removeRepository resolver';
      try {
        const repo = await Repository.findById(
          'updateRepository resolver',
          context,
          repositoryId,
        );
        if (!repo) {
          throw NotFoundError();
        }

        // No removal of repositories managed outside the DMP Tool!
        if (
          isAdmin(context.token) &&
          repo.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)
        ) {
          try {
            // TODO: We should do a check to see if it has been used and then either NOT allow the deletion
            //       or notify that it is being done and to what DMPs
            const deleted = await repo.delete(context);

            if (!deleted || deleted.hasErrors()) {
              repo.addError('general', 'Unable to delete the repository');
            }

            // No need to remove the related research domain associations the DB will cascade the deletion
            const result = repo.hasErrors() ? repo : deleted;
            // Field resolvers will add the source field
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return result as any;
          } catch (err) {
            context.logger.error(
              prepareObjectForLogs(err),
              `Failure in removeRepository`,
            );
            throw InternalServerError();
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },

    mergeRepositories: async (
      _,
      { repositoryToKeepId, repositoryToRemoveId },
      context,
    ) => {
      const reference = 'mergeRepositorys resolver';
      try {
        if (isSuperAdmin(context.token)) {
          const toKeep = await Repository.findById(
            reference,
            context,
            repositoryToKeepId,
          );
          const toRemove = await Repository.findById(
            reference,
            context,
            repositoryToRemoveId,
          );

          if (!toKeep || !toRemove) {
            throw NotFoundError();
          }
          //No removals of standards managed elsewhere!
          if (!toRemove.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)) {
            throw ForbiddenError();
          }

          // Only modify the one we want to keep if it is a DMP Tool managed standard!
          if (!toKeep.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)) {
            // Merge the description and website in if the one we want to keep does not have them
            if (!toKeep.description) {
              toKeep.description = toRemove.description;
            }
            if (!toKeep.website) {
              toKeep.website = toRemove.description;
            }
            // Merge the keywords
            if (
              toRemove.keywords &&
              Array.isArray(toRemove.keywords)
            ) {
              toRemove.keywords
                .filter((k) => !toKeep.keywords.includes(k))
                .forEach((key) => toKeep.keywords.push(key));
            }
            // Merge the repositoryTypes
            if (
              toRemove.repositoryTypes &&
              Array.isArray(toRemove.repositoryTypes)
            ) {
              toRemove.repositoryTypes
                .filter((rt) => !toKeep.repositoryTypes.includes(rt))
                .forEach((typ) => toKeep.repositoryTypes.push(typ));
            }
            // Merge the researchDomains
            if (
              toRemove.researchDomains &&
              Array.isArray(toRemove.researchDomains)
            ) {
              toRemove.researchDomains
                .filter((rd) => !toKeep.researchDomains.includes(rd))
                .forEach((dom) => toKeep.researchDomains.push(dom));
            }
            await toKeep.update(context);
          }

          // TODO: We will need to update the identifiers for any project outputs that ref the one being removed!

          // Delete the one we want to remove
          await toRemove.delete(context);
          // Field resolvers will add the source field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return toKeep as any;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },
  },

  // Handle union type resolution
  Repository: {
    __resolveType(obj) {
      if (isCustomRepository(obj)) {
        return 'CustomRepository';
      }
      if (isRe3DataRepository(obj)) {
        return 'Re3DataRepository';
      }
      return null;
    },
  },

  CustomRepository: {
    source: () => RepositorySourceType.CUSTOM,
    // Convert numeric ID to string for compatibility with Re3DataRepository
    id: (parent) => {
      return String(parent.id);
    },
    // Alias types to repositoryTypes for compatibility with Re3DataRepository
    types: (parent) => {
      return parent.repositoryTypes || [];
    },
    repositoryTypes: (parent) => {
      return parent.repositoryTypes || [];
    },
    researchDomains: async (
      parent,
      _,
      context: MyContext,
    ) => {
      // parent.id is the original numeric ID from the database
      // Convert to number in case it's already been stringified
      const repoId = typeof parent.id === 'number' ? parent.id : parseInt(parent.id, 10);
      return await ResearchDomain.findByRepositoryId(
        'Chained CustomRepository.researchDomains',
        context,
        repoId,
      );
    },
    created: (parent) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent) => {
      return normaliseDateTime(parent.modified);
    },
  },

  Re3DataRepository: {
    source: () => RepositorySourceType.RE3DATA,
    // Alias repositoryTypes to types for compatibility with CustomRepository
    repositoryTypes: (parent) => {
      return parent.types || [];
    },
    types: (parent) => {
      return parent.types || [];
    },
  },
};


