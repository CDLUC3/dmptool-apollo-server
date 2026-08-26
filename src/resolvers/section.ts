import { ReorderSectionsResult, Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { Section } from "../models/Section.js";
import { VersionedSection } from "../models/VersionedSection.js";
import { Tag } from "../models/Tag.js";
import { Template } from "../models/Template.js";
import { cloneSection, hasPermissionOnSection, updateDisplayOrders } from "../services/sectionService.js";
import { ForbiddenError, NotFoundError, AuthenticationError, InternalServerError, BadRequestError } from "../utils/graphQLErrors.js";
import { Question } from "../models/Question.js";
import { isAdmin, isAuthorized, isSuperAdmin } from "../services/authService.js";
import { prepareObjectForLogs } from "../logger.js";
import { GraphQLError } from "graphql";
import { VersionedQuestion } from "../models/VersionedQuestion.js";
import { normaliseDateTime } from "../utils/helpers.js";

export const resolvers: Resolvers = {
  Query: {
    // return all of the sections for the specified template
    sections: async (_, { templateId }, context: MyContext): Promise<Section[]> => {
      const reference = 'sections resolver';
      try {
        if (isAuthorized(context?.token)) {
          return await Section.findByTemplateId(reference, context, templateId);
        }

        throw AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a specific section
    section: async (_, { sectionId }, context: MyContext): Promise<Section> => {
      const reference = 'section resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Section.findById(reference, context, sectionId);
        }

        throw AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },

  Mutation: {
    // add a new section
    addSection: async (
      _,
      {
        input: {
          templateId,
          name,
          copyFromVersionedSectionId,
          introduction,
          requirements,
          guidance,
          displayOrder
        }
      },
      context: MyContext
    ): Promise<Section> => {
      const reference = 'addSection resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnSection(context, templateId)) {
          let section = new Section({ name, templateId, introduction, requirements, guidance, displayOrder });

          // if a copyFromVersionedSectionId is provided, clone the section
          let original: VersionedSection;

          if (copyFromVersionedSectionId) {
            original = await VersionedSection.findById(reference, context, copyFromVersionedSectionId);
            if (!original) {
              throw NotFoundError('Unable to copy the specified section');
            }

            section = cloneSection(context.token?.id, templateId, original);
            section.name = name;
            const maxDisplayOrder = await Section.findMaxDisplayOrder(reference, context, templateId);
            section.displayOrder = maxDisplayOrder + 1;
          }

          // create the new section
          const newSection = await section.create(context, templateId);

          // if the section was not created, return the errors
          if (!newSection?.id) {
            // A null was returned so add a generic error and return it
            if (!section.errors['general']) {
              section.addError('general', 'Unable to create the section');
            }
            return section;
          }

          // if a copyFromVersionedSectionId is provided, clone all the questions
          if (copyFromVersionedSectionId && original) {
            const versionedQuestions = await VersionedQuestion.findByVersionedSectionId(
              reference,
              context,
              original.id
            );

            // Add questions from the copied versionedSection to the section
            for (const versionedQuestion of versionedQuestions) {
              const newQuestion = new Question({
                ...versionedQuestion,
                isDirty: true,
                sourceQuestionId: versionedQuestion.questionId,
                sectionId: newSection.id,
                templateId: templateId,
                id: undefined, // ensure the id is not set since we're creating a new question
              });

              const addedQuestion = await newQuestion.create(context);

              if (!addedQuestion?.id) {
                // A null was returned so add a generic error and return it
                if (!newQuestion.errors['general']) {
                  newQuestion.addError('general', 'Unable to create the question');
                }
              } else {
                // Copy the source versioned question's tags onto the newly cloned question
                const sourceTags = await Tag.findByVersionedQuestionId(reference, context, versionedQuestion.id);
                for (const tag of sourceTags) {
                  const wasAdded = await tag.addToQuestion(context, addedQuestion.id);
                  if (!wasAdded) {
                    context.logger.error(`${reference} failed to copy tag ${tag.id} to cloned question ${addedQuestion.id}`);
                    newQuestion.addError('general', 'Question created but unable to copy all tags');
                  }
                }
              }
            }
          }

          // Update the associated template to set isDirty=1
          await Template.markTemplateAsDirty('Section resolver - addSection', context, templateId);

          // Return newly created section
          return await Section.findById(reference, context, newSection.id);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing section
    updateSection: async (
      _,
      {
        input: {
          sectionId,
          name,
          introduction,
          requirements,
          guidance,
          displayOrder,
          bestPractice
        }
      },
      context: MyContext
    ): Promise<Section> => {
      const reference = 'updateSection resolver';
      try {
        // Get Section based on provided sectionId
        const sectionData = await Section.findById('section resolver', context, sectionId);

        // Throw Not Found error if Section is not found
        if (!sectionData) {
          throw NotFoundError('Section not found');
        }

        // Check that user has permission to update this section
        if (isAdmin(context?.token) && await hasPermissionOnSection(context, sectionData.templateId)) {
          const section = new Section({
            id: sectionData.id,
            templateId: sectionData.templateId,
            createdById: sectionData.createdById,
            name: name,
            introduction: introduction,
            requirements: requirements,
            guidance: guidance,
            displayOrder: displayOrder,
            isDirty: true  // Mark as dirty for update
          });

          // Only allow the bestPractice flag to be changed if the user is a Super admin!
          section.bestPractice = isSuperAdmin(context.token) ? bestPractice : sectionData.bestPractice;

          const updatedSection = await section.update(context);

          if (!updatedSection?.id) {
            // A null was returned so add a generic error and return it
            if (!section.errors['general']) {
              section.addError('general', 'Unable to update the section');
            }
            return section;
          }

          // Update the associated template to set isDirty=1
          await Template.markTemplateAsDirty('Section resolver - updateSection', context, sectionData.templateId);

          // Return newly updated section
          return await Section.findById(reference, context, updatedSection.id);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Change the section's display order
    updateSectionDisplayOrder: async (
      _,
      { sectionId, newDisplayOrder },
      context: MyContext
    ): Promise<ReorderSectionsResult> => {
      const reference = 'updateSectionDisplayOrder resolver';
      try {
        if (isAdmin(context.token)) {
          // Find the section that is being repositioned
          const section = await Section.findById(reference, context, sectionId);

          if (!section) {
            throw NotFoundError();
          }

          // Check that the new display order has actually changed
          if (section.displayOrder === newDisplayOrder) {
            throw BadRequestError('The new display order is the same as the current one');
          }

          // Check that user has permission to update this section
          if (await hasPermissionOnSection(context, section.templateId)) {
            try {
              // Reorder the sections
              const reorderedSections = await updateDisplayOrders(
                context,
                section.templateId,
                sectionId,
                newDisplayOrder
              );

              await Template.markTemplateAsDirty(reference, context, section.templateId);

              return { sections: reorderedSections ?? [] };

            } catch (err) {
              context.logger.error(prepareObjectForLogs(err), `${reference} failed: sectionId: ${sectionId}`);
              return { sections: [], errors: { general: err.message } };
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

    // remove a section
    removeSection: async (_, { sectionId }, context: MyContext): Promise<Section> => {
      const reference = 'removeSection resolver';
      try {
        // Retrieve existing Section
        const sectionData = await Section.findById(reference, context, sectionId);

        // Throw Not Found error if Section is not found
        if (!sectionData) {
          throw NotFoundError('Section not found');
        }

        if (isAdmin(context?.token) && await hasPermissionOnSection(context, sectionData.templateId)) {
          //Need to create a new instance of Section so that it recognizes the 'delete' function of that instance
          const section = new Section({ ...sectionData, id: sectionId });

          const deleted = await section.delete(context);

          if (!deleted || deleted.hasErrors()) {
            section.addError('general', 'Unable to delete the section');
          }

          // Update the associated template to set isDirty=1
          await Template.markTemplateAsDirty('Section resolver - removeSection', context, sectionData.templateId);

          return section.hasErrors() ? section : deleted;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Section: {
    // Chained resolver to fetch the Affiliation info for the user
    tags: async (parent: Section, _, context: MyContext): Promise<Tag[]> => {
      return await Tag.findBySectionId('Chained Section.tags', context, parent.id);
    },
    template: async (parent: Section, _, context: MyContext): Promise<Template> => {
      return await Template.findById('Chained Section.template', context, parent.templateId);
    },
    questions: async (parent: Section, _, context: MyContext): Promise<Question[]> => {
      return await Question.findBySectionId('Chained Section.questions', context, parent.id)
    },
    created: (parent: Section) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Section) => {
      return normaliseDateTime(parent.modified);
    }
  }
};
