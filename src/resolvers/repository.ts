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
  stringToEnumValue
} from '../utils/helpers';
import { GraphQLError } from 'graphql';
import { PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from '../types/general';

export const resolvers: Resolvers = {
  Query: {
    // searches the repositories table or returns all repos if no criteria is specified
    repositories: async (_, { input }, context: MyContext): Promise<RepositorySearchResults> => {
      const reference = 'repositories resolver';
      try {
        if (isAuthorized(context.token)) {
          const { term, researchDomainId, keyword, repositoryType, paginationOptions } = input
          const repoType = stringToEnumValue(RepositoryType, repositoryType);

          const opts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
            ? paginationOptions as PaginationOptionsForOffsets
            : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          return await Repository.search(reference, context, term, researchDomainId, keyword, repoType, opts);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a single repository
    repository: async (_, { uri }, context: MyContext): Promise<Repository> => {
      const reference = 'repository resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Repository.findByURI(reference, context, uri);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return all distinct subject area keywords across all repositories
    repositorySubjectAreas: async (_, __, context: MyContext): Promise<string[]> => {
      const reference = 'repositorySubjectAreas resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Repository.findAllDistinctKeywords(reference, context);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new Repository
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
            return newRepo;
          }

          // If any ResearchDomains were specified and there were no errors creating the record
          if (Array.isArray(input.researchDomainIds)) {
            if (created && !created.hasErrors()) {
              const addErrors = [];
              // Add any researchDomains associations
              for (const id of input.researchDomainIds) {
                const domain = await ResearchDomain.findById(reference, context, id);
                if (domain) {
                  const wasAdded = await domain.addToRepository(context, created.id);
                  if (!wasAdded) {
                    addErrors.push(domain.name);
                  }
                }
              }
              // if any errors were found when adding/removing tags then return them
              if (addErrors.length > 0) {
                created.addError('researchDomains', `Created but unable to assign domains: ${addErrors.join(', ')}`);
              }
            }
          }
          return created.hasErrors() ? created : await Repository.findById(reference, context, created.id);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    updateRepository: async (_, { input }, context): Promise<Repository> => {
      const reference = 'updateRepository resolver';
      try {
        const repo = await Repository.findById(reference, context, input.id);
        if (!repo) {
          throw NotFoundError();
        }

        // If the user is a an admin and its a DMPTool added repository (no updates to repos managed elsewhere!)
        if (isAdmin(context.token) && repo.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)) {
          const toUpdate = new Repository(input);
          const updated = await toUpdate.update(context);

          // If there were no errors creating the record
          if (updated && !updated.hasErrors()) {
            // Fetch all of the current ResearchDomains associated with this MetadataStandard
            const researchDomains = await ResearchDomain.findByRepositoryId(
              reference,
              context,
              repo.id
            );
            const currentDomainIds = researchDomains ? researchDomains.map((d) => d.id) : [];

            // Use the helper function to determine which ResearchDomains to keep
            const { idsToBeRemoved, idsToBeSaved } = Repository.reconcileAssociationIds(
              currentDomainIds,
              input.researchDomainIds
            );

            const associationErrors = [];
            // Delete any ResearchDomain associations that were removed
            const removeErrors = [];
            for (const id of idsToBeRemoved) {
              const dom = await ResearchDomain.findById(reference, context, id);
              if (dom) {
                const wasRemoved = dom.removeFromRepository(context, updated.id);
                if (!wasRemoved) {
                  removeErrors.push(dom.name);
                }
              }
            }
            // if any errors were found when adding/removing tags then return them
            if (removeErrors.length > 0) {
              associationErrors.push(`unable to remove domains: ${removeErrors.join(', ')}`);
            }

            // Add any new ResearchDomain associations
            const addErrors = [];
            for (const id of idsToBeSaved) {
              const dom = await ResearchDomain.findById(reference, context, id);
              if (dom) {
                const wasAdded = dom.addToRepository(context, updated.id);
                if (!wasAdded) {
                  addErrors.push(dom.name);
                }
              }
            }
            // if any errors were found when adding/removing tags then return them
            if (addErrors.length > 0) {
              associationErrors.push(`unable to assign domains: ${addErrors.join(', ')}`);
            }

            // If any errors were encountered adding/removing associations
            if (associationErrors.length > 0) {
              updated.addError('researchDomains', `Updated but ${associationErrors.join('; ')}`);
            }

            // Reload since the research domains may have changed
            return updated.hasErrors() ? updated : await Repository.findById(reference, context, repo.id);
          }
          // Otherwise there were errors so return the object with errors
          return updated;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    removeRepository: async (_, { repositoryId }, context): Promise<Repository> => {
      const reference = 'removeRepository resolver';
      try {
        const repo = await Repository.findById('updateRepository resolver', context, repositoryId);
        if (!repo) {
          throw NotFoundError();
        }

        // No removal of repositories managed outside the DMP Tool!
        if (isAdmin(context.token) && repo.uri.startsWith(DEFAULT_DMPTOOL_REPOSITORY_URL)) {
          try {
            // TODO: We should do a check to see if it has been used and then either NOT allow the deletion
            //       or notify that it is being done and to what DMPs
            const deleted = await repo.delete(context);

            if (!deleted || deleted.hasErrors()) {
              repo.addError('general', 'Unable to delete the repository');
            }

            // No need to remove the related research domain associations the DB will cascade the deletion
            return repo.hasErrors() ? repo : deleted;
          } catch (err) {
            context.logger.error(prepareObjectForLogs(err), `Failure in removeRepository`);
            throw InternalServerError();
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    mergeRepositories: async (_, { repositoryToKeepId, repositoryToRemoveId }, context): Promise<Repository> => {
      const reference = 'mergeRepositorys resolver';
      try {
        if (isSuperAdmin(context.token)) {
          const toKeep = await Repository.findById(reference, context, repositoryToKeepId);
          const toRemove = await Repository.findById(reference, context, repositoryToRemoveId);

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
              toKeep.description = toRemove.description
            }
            if (!toKeep.website) {
              toKeep.website = toRemove.description
            }
            // Merge the keywords
            if (toRemove.keywords && Array.isArray(toRemove.keywords)) {
              toRemove.keywords.filter((k) => !toKeep.keywords.includes(k))
                .forEach((key) => toKeep.keywords.push(key));
            }
            // Merge the repositoryTypes
            if (toRemove.repositoryTypes && Array.isArray(toRemove.repositoryTypes)) {
              toRemove.repositoryTypes.filter((rt) => !toKeep.repositoryTypes.includes(rt))
                .forEach((typ) => toKeep.repositoryTypes.push(typ));
            }
            // Merge the researchDomains
            if (toRemove.researchDomains && Array.isArray(toRemove.researchDomains)) {
              toRemove.researchDomains.filter((rd) => !toKeep.researchDomains.includes(rd))
                .forEach((dom) => toKeep.researchDomains.push(dom));
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

  Repository: {
    researchDomains: async (parent: Repository, _, context: MyContext): Promise<ResearchDomain[]> => {
      return await ResearchDomain.findByRepositoryId(
        'Chained Repository.researchDomains',
        context,
        parent.id
      );
    },
    created: (parent: Repository) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Repository) => {
      return normaliseDateTime(parent.modified);
    }
  },
};
