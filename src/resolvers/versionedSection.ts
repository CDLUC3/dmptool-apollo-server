import { Resolvers, VersionedSectionSearchResults } from "../types";
import { MyContext } from "../context";
import { VersionedSection, VersionedSectionSearchResult } from "../models/VersionedSection";
import { VersionedCustomSection } from "../models/VersionedCustomSection";
import { Section } from "../models/Section";
import { Tag } from "../models/Tag";
import { VersionedTemplate } from "../models/VersionedTemplate";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { isAuthorized } from "../services/authService";
import { VersionedCustomQuestion } from "../models/VersionedCustomQuestion";

export const resolvers: Resolvers = {
  Query: {
    // Get all of the versionedSection records for the given sectionId
    sectionVersions: async (_, { sectionId }, context: MyContext): Promise<VersionedSection[]> => {
      const reference = 'sectionVersions resolver';
      try {
        // Find versionedSections with matching sectionId
        return await VersionedSection.findBySectionId(reference, context, sectionId);
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Get all of the published versionedSections with the given name
    publishedSections: async (_, { term, paginationOptions }, context: MyContext): Promise<VersionedSectionSearchResults> => {
      const reference = 'publishedSections resolver';
      try {
        const opts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
          ? paginationOptions as PaginationOptionsForOffsets
          : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

        // Find published versionedSections with similar names for the current user
        return await VersionedSectionSearchResult.search(reference, context, term, opts);
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Get a specific VersionedSection
    publishedSection: async (_, { versionedSectionId }, context: MyContext): Promise<VersionedSection> => {
      const reference = 'publishedSection resolver';
      try {
        if (isAuthorized(context.token)) {
          return await VersionedSection.findById(reference, context, versionedSectionId);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Get published, custom section
    publishedCustomSection: async (
      _,
      { customSectionId, planId },
      context: MyContext
    ): Promise<VersionedCustomSection> => {
      const reference = 'publishedCustomSection resolver';
      try {
        if (!isAuthorized(context.token)) {
          throw context?.token ? ForbiddenError() : AuthenticationError();
        }

        const affiliationId = context.token.affiliationId;
        if (!affiliationId) throw ForbiddenError();

        const result = await VersionedCustomSection.findByPlanAndSectionId(
          reference,
          context,
          planId,
          customSectionId,
          affiliationId
        );

        if (!result) {
          throw NotFoundError(`Custom section with ID ${customSectionId} not found`);
        }

        return result;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },


  VersionedSection: {
    // Chained resolver to fetch the Section related to VersionedSection
    section: async (parent: VersionedSection, _, context: MyContext): Promise<Section> => {
      return await Section.findById('VersionedSection resolver', context, parent.sectionId);
    },
    // Chained resolver to fetch the versionedTemplate that the VersionedSection belongs to
    versionedTemplate: async (parent: VersionedSection, _, context: MyContext): Promise<VersionedTemplate> => {
      return await VersionedTemplate.findVersionedTemplateById('VersionSection resolver', context, parent.versionedTemplateId);
    },
    // Chained resolver to fetch the Tags belonging to VersionedSection
    tags: async (parent: VersionedSection, _, context: MyContext): Promise<Tag[]> => {
      return await Tag.findBySectionId('updateSection resolver', context, parent.sectionId);
    },
    // Chained resolver to return the VersionedQuestions associated with this VersionedSection
    versionedQuestions: async (parent: VersionedSection, _, context: MyContext): Promise<VersionedQuestion[]> => {
      return await VersionedQuestion.findByVersionedSectionId(
        'Chained VersionedSection.versionedQuestions',
        context,
        parent.id
      );
    },
    created: (parent: VersionedSection) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedSection) => {
      return normaliseDateTime(parent.modified);
    }
  },
  VersionedCustomSection: {
    questions: async (parent: VersionedCustomSection, _, context: MyContext): Promise<VersionedCustomQuestion[]> => {
      return await VersionedCustomQuestion.findByVersionedCustomSectionId(
        'Chained VersionedCustomSection.questions',
        context,
        parent.id
      );
    },
    created: (parent: VersionedCustomSection) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedCustomSection) => {
      return normaliseDateTime(parent.modified);
    }
  }
};
