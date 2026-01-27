import { Resolvers, TemplateSearchResults } from "../types";
import { Template, TemplateSearchResult, TemplateVisibility } from "../models/Template";
import { Affiliation } from "../models/Affiliation";
import { TemplateCollaborator } from "../models/Collaborator";
import { Section } from "../models/Section";
import { VersionedSection } from '../models/VersionedSection';
import { VersionedQuestion } from "../models/VersionedQuestion";
import { User, UserRole } from '../models/User';
import { MyContext } from "../context";
import { cloneTemplate, generateTemplateVersion, hasPermissionOnTemplate } from "../services/templateService";
import { cloneSection } from "../services/sectionService";
import { cloneQuestion } from "../services/questionService";
import { isAdmin, isSuperAdmin } from "../services/authService";
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from "../utils/graphQLErrors";
import { VersionedTemplate, TemplateVersionType } from "../models/VersionedTemplate";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { generalConfig } from "../config/generalConfig";
import { PaginationOptionsForCursors, PaginationOptionsForOffsets, PaginationType } from "../types/general";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";

export const resolvers: Resolvers = {
  Query: {
    // Get the Templates that belong to the current user's affiliation (user must be an Admin)
    myTemplates: async (_, { term, paginationOptions }, context: MyContext): Promise<TemplateSearchResults> => {
      const reference = 'myTemplates resolver';
      try {
        if (isAdmin(context.token)) {
          const opts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
                      ? paginationOptions as PaginationOptionsForOffsets
                      : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          return await TemplateSearchResult.findByAffiliationIdAndTerm(
            reference,
            context,
            context.token.affiliationId,
            term,
            opts,
          );
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Get the specified Template (user must be an Admin)
    //    - called by the Template Overview page
    template: async (_, { templateId }, context: MyContext): Promise<Template> => {
      const reference = 'template resolver';
      try {
        if (isAdmin(context.token)) {
          const template = await Template.findById(reference, context, templateId);
          if (template) {
            // Verify that the current user has permission to access the Template
            if (await hasPermissionOnTemplate(context, template)) {
              return template;
            }
            throw ForbiddenError();
          }
          throw NotFoundError();
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
    // Add a new template by copying an existing one or starting from scratch (copyFromTemplateId left blank).
    //    - called by the Template Builder - prior template selection page AND the initial page
    addTemplate: async (_, { name, copyFromTemplateId }, context: MyContext): Promise<Template> => {
      const reference = 'addTemplate resolver';
      try {
        if (isAdmin(context.token)) {
          let template: Template;
          if (copyFromTemplateId) {
            // Fetch the VersionedTemplate we are cloning
            const original = await VersionedTemplate.findVersionedTemplateById(reference, context, copyFromTemplateId);
            template = cloneTemplate(context.token?.id, context.token.affiliationId, original);
            template.name = name;
          }
          if (!template) {
            // Create a new blank template
            template = new Template({ name, ownerId: context.token.affiliationId });
          }

          // Create new template
          const newTemplate = await template.create(context);
          const templateId = newTemplate.id;

          // Add generic error
          if (!newTemplate || newTemplate.hasErrors()) {
            template.addError('general', 'Unable to create Template');
          }

          if (templateId && copyFromTemplateId && !newTemplate.hasErrors()) {
            // Fetch and copy versionedSections to sections table for new template
            const versionedSections = await VersionedSection.findByTemplateId(reference, context, copyFromTemplateId);
            for (const versionedSection of versionedSections) {
              const versionedSectionId = versionedSection.id;
              const section = cloneSection(context.token?.id, templateId, versionedSection)
              if (section && !section.hasErrors()) {
                const newSection = await section.create(context, templateId);
                const sectionId = newSection.id;

                //Fetch and copy all related versionedQuestions to copy to questions table for new template
                const versionedQuestions = await VersionedQuestion.findByVersionedSectionId(
                  reference,
                  context,
                  versionedSectionId
                );
                for (const versionedQuestion of versionedQuestions) {
                  const question = await cloneQuestion(context.token?.id, templateId, sectionId, versionedQuestion);
                  if (question) {
                    const newQuestion = await question.create(context);
                    if (newQuestion && newQuestion.hasErrors()) {
                      context.logger.error(`${reference} failed to clone question`);
                      newTemplate.addError('questions', 'Created Template but unable to clone all questions');
                    }
                  }
                }
              } else {
                context.logger.error(`${reference} failed to clone section`);
                newTemplate.addError('sections', 'Created Template but unable to clone all sections');
              }
            }
          }


          return newTemplate;
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update the specified template
    //    - called by the Template options page
    updateTemplate: async (_, { templateId, name, bestPractice }, context: MyContext): Promise<Template> => {
      const reference = 'updateTemplate resolver';
      try {
        if (isAdmin(context.token)) {
          const template = await Template.findById(reference, context, templateId);

          // Need to create an instance of template in order to access the "update" method below
          const templateInstance = new Template({ ...template });

          // Only allow the bestPractice flag to be changed if the user is a Super admin!
          templateInstance.bestPractice = isSuperAdmin(context.token) && bestPractice !== undefined
            ? bestPractice
            : template.bestPractice;

          if (templateInstance) {
            if (await hasPermissionOnTemplate(context, template)) {
              // Update the fields and then save
              templateInstance.name = name;
              const updated = await templateInstance.update(context);
              if (!updated || updated.hasErrors()) {
                updated?.addError('general', 'Unable to update Template');
              }

              return updated.hasErrors() ? updated : Template.findById(reference, context, templateId);
            }
          }
          throw NotFoundError();
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Unpublish the template.
    //    - called by the Template options page
    archiveTemplate: async (_, { templateId }, context: MyContext): Promise<Template> => {
      const reference = 'archiveTemplate resolver';
      try {
        if (isAdmin(context.token)) {
          const template = await Template.findById(reference, context, templateId);

          if (template) {
            // Need to create an instance of template in order to access the "update" or "delete" method below
            const templateInstance = new Template({ ...template });

            if (await hasPermissionOnTemplate(context, template)) {
              // Check if there are any plans associated with any versionedTemplate for this template
              const hasPlans = await VersionedTemplate.hasAssociatedPlans(reference, context, templateId);

              if (hasPlans) {
                // Template has associated plans, so unpublish it instead of deleting
                templateInstance.latestPublishVersion = null;
                templateInstance.latestPublishDate = null;
                templateInstance.isDirty = true;

                const updated = await templateInstance.update(context);
                if (!updated || updated.hasErrors()) {
                  updated?.addError('general', 'Unable to unpublish Template');
                }

                // Set all related versionedTemplates to inactive
                if (updated && !updated.hasErrors()) {
                  await VersionedTemplate.deactivateByTemplateId(reference, context, templateId);
                }

                return updated;
              } else {
                // No plans associated, safe to delete the template
                const deleted = await templateInstance.delete(context);
                if (!deleted) {
                  templateInstance.addError('general', 'Unable to delete Template');
                }
                return templateInstance;
              }
            }
          }
          throw NotFoundError();
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Publish the template or save as a draft
    //     - called from the Template overview page
    createTemplateVersion: async (_, { templateId, comment, versionType, latestPublishVisibility }, context: MyContext): Promise<Template> => {
      const reference = 'createTemplateVersion resolver';
      try {
        if (isAdmin(context.token)) {
          const template = await Template.findById(reference, context, templateId);
          // Need to create an instance of template in order to access the "update" method below
          const templateInstance = new Template({ ...template });

          if (templateInstance) {
            if (await hasPermissionOnTemplate(context, template)) {
              const versions = await VersionedTemplate.findByTemplateId(reference, context, templateId);

              let versionedTemplate: VersionedTemplate | null = null;
              try {
                versionedTemplate = await generateTemplateVersion(
                  context,
                  templateInstance,
                  versions,
                  context.token.id,
                  comment,
                  latestPublishVisibility as TemplateVisibility,
                  TemplateVersionType[versionType]
                );
              } catch (err) {
                templateInstance.addError('general', err.message);
                return templateInstance;
              }

              // If the versionedTemplate is not null then the versioning process succeeded
              if (versionedTemplate && !versionedTemplate.hasErrors()) {
                // Reload the template and return it.
                return await Template.findById(reference, context, templateId);
              }

              // Add generic error
              templateInstance.addError('general', 'Unable to version the Template');
              return templateInstance;
            }
          }
          throw NotFoundError();
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  TemplateSearchResult: {
    // Resolver for ownerDisplayName based on owner.displayName
    ownerDisplayName: async (parent: TemplateSearchResult, _, context: MyContext): Promise<string | null> => {
      if (parent.ownerId) {
        const owner = await Affiliation.findByURI('TemplateSearchResult.owner', context, parent.ownerId);
        return owner?.displayName || null;
      }
      return null;
    },
  },

  Template: {
    // Chained resolver to fetch the Affiliation info for the user
    owner: async (parent: Template, _, context: MyContext): Promise<Affiliation> => {
      if (parent.ownerId) {
        return await Affiliation.findByURI('Chained Template.owner', context, parent.ownerId);
      }
      return null;
    },

    // Chained resolver to fetch the TemplateCollaborators
    collaborators: async (parent: Template, _, context: MyContext): Promise<TemplateCollaborator[]> => {
      if (parent.id) {
        return await TemplateCollaborator.findByTemplateId('Chained Template.collaborators', context, parent.id);
      }
      return [];
    },

    // Allow the GraphQL client to fetch the template when querying for a Section
    sections: async (parent: Template, _, context: MyContext): Promise<Section[]> => {
      if (parent.id) {
        return await Section.findByTemplateId('Chained Template.sections', context, parent.id);
      }
      return [];
    },

    // Chained resolver to fetch the admins associated with the template's owner
    admins: async (parent: Template, _, context: MyContext): Promise<User[]> => {
      if (parent.ownerId) {
        const opts = { type: PaginationType.CURSOR, cursor: null, limit: generalConfig.maximumSearchLimit };
        const results = await User.findByAffiliationId('Chained Template.admins', context, parent.ownerId, null, opts);
        return Array.isArray(results.items) ? results.items.filter((user) => user.role === UserRole.ADMIN) : [];
      }
      return [];
    },

    created: (parent: Template) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Template) => {
      return normaliseDateTime(parent.modified);
    }
  },
};
