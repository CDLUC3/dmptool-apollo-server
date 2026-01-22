import {prepareObjectForLogs} from '../logger';
import {RelatedWorkStatsResults, Resolvers} from '../types';
import {MyContext} from '../context';
import {isAuthorized} from '../services/authService';
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from '../utils/graphQLErrors';
import {
  RelatedWork,
  RelatedWorkSearchResult,
  RelatedWorkSearchResults,
  Work,
  WorkVersion
} from '../models/RelatedWork';
import {GraphQLError} from 'graphql';
import {Project} from '../models/Project';
import {hasPermissionOnProject} from '../services/projectService';
import {Plan} from '../models/Plan';
import {isNullOrUndefined, normaliseDateTime} from '../utils/helpers';
import {
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from '../types/general';
import {openSearchFindWorkByIdentifier} from "../services/openSearchService";
import {generalConfig} from "../config/generalConfig";

export const resolvers: Resolvers = {
  Query: {
    // Get all the related works for a project or plan
    async relatedWorks(
      _,
      { id, idType, filterOptions, paginationOptions },
      context: MyContext,
    ): Promise<RelatedWorkSearchResults<RelatedWorkSearchResult>> {
      const reference = 'relatedWorks resolver';
      try {
        if (!isAuthorized(context.token)) {
          throw AuthenticationError();
        }

        let projectId = undefined;
        let planId = undefined;

        if(idType === "PLAN_ID"){
          const plan = await Plan.findById(reference, context, id);
          if (!plan) throw NotFoundError();
          planId = id;
          projectId = plan?.projectId;
        } else if (idType === "PROJECT_ID") {
          projectId = id;
        }

        if (projectId == null) {
          throw NotFoundError();
        }

        const project = await Project.findById(reference, context, projectId);
        if(!project) {
          throw NotFoundError();
        }

        if(!(await hasPermissionOnProject(context, project))) {
          throw ForbiddenError();
        }

        const pagOpts =
          !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
            ? (paginationOptions as PaginationOptionsForOffsets)
            : ({ ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors);

        return await RelatedWorkSearchResult.search(
            reference,
            context,
            projectId,
            planId,
            undefined,
            filterOptions,
            pagOpts,
          );
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Find related works by an identifier, e.g. DOI
    async findWorkByIdentifier(
      _,
      { planId, doi, paginationOptions },
      context: MyContext,
    ): Promise<RelatedWorkSearchResults<RelatedWorkSearchResult>> {
      const reference = 'findWorkByIdentifier resolver';

      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (plan) {
            const pagOpts =
              !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
                ? (paginationOptions as PaginationOptionsForOffsets)
                : ({ ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors);
            const project = await Project.findById(reference, context, plan.projectId);
            const limit = Math.min(pagOpts.limit ?? generalConfig.defaultSearchLimit, generalConfig.maximumSearchLimit);
            if (project && (await hasPermissionOnProject(context, project))) {
              if(!planId || !doi){
                return {
                  items: [],
                  limit: limit,
                  totalCount: 0,
                  currentOffset: 0,
                  hasNextPage: false,
                  hasPreviousPage: false,
                  availableSortFields: [],
                  statusOnlyCount: 0,
                  workTypeCounts: [],
                  confidenceCounts: [],
                };
              }

              // Check to see if we can find this work in our database first
              const existingWorks = await RelatedWorkSearchResult.search(reference, context, plan.projectId, planId, doi, {}, pagOpts);
              if (existingWorks.items.length > 0) {
                return existingWorks;
              }

              // Otherwise lookup the work in OpenSearch
              const openSearchWorks =  await openSearchFindWorkByIdentifier(
                context,
                doi,
                limit,
              );

              // Convert OpenSearch results to related works
              return {
                items: openSearchWorks.map((os)=> {
                  return {
                    id: null,
                    planId: planId,
                    planTitle: null,
                    workVersion: {
                      id: null,
                      work: {
                        id: null,
                        doi: os.doi,
                      },
                      hash: os.hash,
                      workType: os.workType,
                      publicationDate: os.publicationDate,
                      title: os.title,
                      abstractText: os.abstractText,
                      authors: os.authors,
                      institutions: os.institutions,
                      funders: os.funders,
                      awards: os.awards,
                      publicationVenue: os.publicationVenue,
                      sourceName: os.source.name,
                      sourceUrl: os.source.url,
                    },
                    sourceType: "USER_ADDED",
                    status: "PENDING",
                    modified: null,
                  } as RelatedWorkSearchResult
                }),
                limit: limit,
                totalCount: openSearchWorks.length,
                currentOffset: 0,
                hasNextPage: false,
                hasPreviousPage: false,
                availableSortFields: [],
                statusOnlyCount: 0,
                workTypeCounts: [],
                confidenceCounts: [],
              };
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Get related works stats per plan
    async relatedWorksByPlanStats(
      _,
      { planId },
      context: MyContext,
    ): Promise<RelatedWorkStatsResults> {
      const reference = 'relatedWorksByPlanStats resolver';

      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (plan) {
            const project = await Project.findById(reference, context, plan.projectId);
            if (project && (await hasPermissionOnProject(context, project))) {
              return await RelatedWork.statsByPlanId(
                reference,
                context,
                planId,
              );
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Get related works stats per project
    async relatedWorksByProjectStats(
      _,
      { projectId },
      context: MyContext,
    ): Promise<RelatedWorkStatsResults> {
      const reference = 'relatedWorksByPlanStats resolver';

      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          if (project && (await hasPermissionOnProject(context, project))) {
            return await RelatedWork.statsByProjectId(
              reference,
              context,
              projectId,
            );
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // Add a related work to a research project
    async upsertRelatedWork(_, { input }, context: MyContext): Promise<RelatedWorkSearchResult> {
      const reference = 'addRelatedWork resolver';
      try {
        if (isAuthorized(context.token)) {
          let relatedWorkId;

          // Check if user has permission to modify project
          const plan = await Plan.findById(reference, context, input.planId);
          if (plan) {
            const project = await Project.findById(reference, context, plan.projectId);
            if (project && (await hasPermissionOnProject(context, project))) {
              // Check if user has already added a related work with this DOI, and just update status
              let relatedWork = await RelatedWork.findByDOI(reference, context, input.planId, input.doi);
              if(relatedWork){
                let toUpdate = new RelatedWork({ ...relatedWork, status: input.status });
                toUpdate = await toUpdate.update(context);
                relatedWorkId = toUpdate.id;
              } else  {
                // Fetch or create work
                let work = await Work.findByDoi(reference, context, input.doi);
                if (!work) {
                  work = new Work({ doi: input.doi });
                  work = await work.create(context);
                }

                // Fetch or create work version
                let workVersion = await WorkVersion.findByDoiAndHash(reference, context, input.doi, input.hash);
                if (!workVersion) {
                  // Lookup work in OpenSearch
                  const openSearchWorks =  await openSearchFindWorkByIdentifier(
                    context,
                    input.doi,
                    2, // We should currently only be getting 1 result
                  );
                  if (openSearchWorks.length == 0)
                  {
                    throw InternalServerError(`Could not create workVersion because could not find DOI ${input.doi} in OpenSearch`);
                  } else if (openSearchWorks.length > 1)
                  {
                    throw InternalServerError(`Could not create workVersion because multiple works were found for DOI ${input.doi} in OpenSearch`);
                  }

                  // Create work version
                  const os = openSearchWorks[0];
                  workVersion = new WorkVersion({
                    hash: Buffer.from(os.hash, 'hex'),
                    workType: os.workType,
                    publicationDate: os.publicationDate,
                    title: os.title,
                    abstractText: os.abstractText,
                    authors: os.authors,
                    institutions: os.institutions,
                    funders: os.funders,
                    awards: os.awards,
                    publicationVenue: os.publicationVenue,
                    sourceName: os.source.name,
                    sourceUrl: os.source.url,
                  });
                  workVersion.workId = work.id;
                  workVersion = await workVersion.create(context, work.doi);
                }
                if (isNullOrUndefined(workVersion) || workVersion.hasErrors())
                {
                  throw InternalServerError('Unable to create or find workVersion');
                }

                // Create related work
                relatedWork = new RelatedWork({
                  planId: input.planId,
                  workVersionId: workVersion.id,
                  sourceType: 'USER_ADDED',
                  score: 1.0,
                  scoreMax: 1.0,
                  status: input.status,
                  doiMatch: {found: false, score: 0.0, sources: []},
                  contentMatch: {score: 0.0, titleHighlight: null, abstractHighlights: []},
                  authorMatches: [],
                  institutionMatches: [],
                  funderMatches: [],
                  awardMatches: [],
                });
                relatedWork = await relatedWork.create(context);
                if (isNullOrUndefined(relatedWork.id)) {
                  throw InternalServerError('Unable to create related work');
                }
                relatedWorkId = relatedWork.id
              }

              // Fetch and return RelatedWorkSearchResult
              return await RelatedWorkSearchResult.findById(reference, context, relatedWorkId);
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Add a related work to a research project
    async addRelatedWorkManual(_, { input }, context: MyContext): Promise<RelatedWorkSearchResult> {
      const reference = 'addRelatedWorkManual resolver';
      try {
        if (isAuthorized(context.token)) {
          // Check if user has permission to modify project
          const plan = await Plan.findById(reference, context, input.planId);
          if (plan) {
            const project = await Project.findById(reference, context, plan.projectId);
            if (project && (await hasPermissionOnProject(context, project))) {
              // Fetch or create work
              let work = await Work.findByDoi(reference, context, input.doi);
              if (!work) {
                work = new Work({ doi: input.doi });
                work = await work.create(context);
              }

              // Fetch or create work version
              let workVersion = await WorkVersion.findByDoiAndHash(reference, context, input.doi, input.hash);
              if (!workVersion) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { planId, doi, ...options } = input;
                workVersion = new WorkVersion(options);
                workVersion.workId = work.id;
                workVersion = await workVersion.create(context, work.doi);
              }
              if (isNullOrUndefined(workVersion) || workVersion.hasErrors())
              {
                throw InternalServerError('Unable to create or find workVersion');
              }

              // Create related work
              let relatedWork = new RelatedWork({
                planId: input.planId,
                workVersionId: workVersion.id,
                status: 'ACCEPTED',
                score: 1.0,
                scoreMax: 1.0,
                sourceType: 'USER_ADDED',
              });
              relatedWork = await relatedWork.create(context);
              if (isNullOrUndefined(relatedWork.id)) {
                throw InternalServerError('Unable to create related work');
              }

              // Fetch and return RelatedWorkSearchResult
              return await RelatedWorkSearchResult.findById(reference, context, relatedWork.id);
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update a related work status on the research project
    async updateRelatedWorkStatus(_, { input }, context: MyContext): Promise<RelatedWorkSearchResult> {
      const reference = 'updateRelatedWorkStatus resolver';
      try {
        if (isAuthorized(context.token)) {
          const relatedWork = await RelatedWork.findById(reference, context, input.id);
          if (!relatedWork) {
            throw NotFoundError('Related work not found');
          }

          const plan = await Plan.findById(reference, context, relatedWork.planId);
          if (!plan) {
            throw NotFoundError('Plan not found');
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (project && (await hasPermissionOnProject(context, project))) {
            let toUpdate = new RelatedWork({ ...relatedWork, ...input });
            toUpdate = await toUpdate.update(context);

            // Fetch and return RelatedWorkSearchResult
            return await RelatedWorkSearchResult.findById(reference, context, toUpdate.id);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },
  RelatedWorkSearchResult: {
    created: (parent: RelatedWorkSearchResult) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: RelatedWorkSearchResult) => {
      return normaliseDateTime(parent.modified);
    },
  },
};
