import { ReorderSectionsResult, Resolvers } from "../types";
import { MyContext } from "../context";
import { Section } from "../models/Section";
import { VersionedSection } from "../models/VersionedSection";
import { Tag } from "../models/Tag";
import { Template } from "../models/Template";
import { cloneSection, hasPermissionOnSection, updateDisplayOrders } from "../services/sectionService";
import { ForbiddenError, NotFoundError, AuthenticationError, InternalServerError, BadRequestError } from "../utils/graphQLErrors";
import { Question } from "../models/Question";
import { isAdmin, isAuthorized, isSuperAdmin } from "../services/authService";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { normaliseDateTime } from "../utils/helpers";

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
          tags,
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

          // Add any new Tags provided in the request
          const addTagErrors = [];
          if (Array.isArray(tags) && tags.length > 0) {
            for (const item of tags) {
              const tag = await Tag.findById(reference, context, item.id);

              if (!tag) {
                addTagErrors.push(`Tag ${item.id} not found`);
              }

              const wasAdded = tag.addToSection(context, newSection.id)
              if (!wasAdded) {
                addTagErrors.push(tag.name);
              }

            }
          }

          if (addTagErrors.length > 0) {
            newSection.addError('tags', `Saved but we were unable to assign tags: ${addTagErrors.join(', ')}`);
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
              }
            }

            const versionedTags = await Tag.findByVersionedSectionId(reference, context, original.sectionId);
            // Add tags from the copied versionedSection to the section
            if (versionedTags && Array.isArray(versionedTags) && versionedTags.length > 0) {
              const addTagErrors = [];
              for (const tagIn of versionedTags) {
                const tag = await Tag.findById(reference, context, tagIn.id);
                if (tag) {
                  const wasAdded = tag.addToSection(context, newSection.id)
                  if (!wasAdded) {
                    addTagErrors.push(tag.name);
                  }
                }
              }
              if (addTagErrors.length > 0) {
                newSection.addError('tags', `Section created but we were unable to assign tags: ${addTagErrors.join(', ')}`);
              }
            }
          }

          // Update the associated template to set isDirty=1
          await Template.markTemplateAsDirty('Section resolver - addSection', context, templateId);

          // Return newly created section with tags
          return newSection.hasErrors() ? newSection : await Section.findById(reference, context, newSection.id);
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
          tags,
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

          // Get current tags for the section
          const currentTags = await Tag.findBySectionId(reference, context, sectionId);
          const currentTagIds = currentTags.map((tag) => tag.id);

          // Use the helper function to determine which Tags to keep and which to remove
          const { idsToBeRemoved, idsToBeSaved } = Section.reconcileAssociationIds(
            currentTagIds,
            tags ? (tags as Tag[]).map((d) => d.id) : []
          );

          // Delete any Tag associations that were removed
          const removeTagErrors = [];
          for (const id of idsToBeRemoved) {
            const tag = await Tag.findById(reference, context, id as number);
            if (tag) {
              const wasRemoved = tag.removeFromSection(context, updatedSection.id)
              if (!wasRemoved) {
                removeTagErrors.push(tag.name);
              }
            }
          }
          // if any errors were found when adding/removing tags then return them
          if (removeTagErrors.length > 0) {
            updatedSection.addError('tags', `Saved but we were unable to remove tags: ${removeTagErrors.join(', ')}`);
          }

          // Add any new Tag associations
          const addTagErrors = [];
          for (const id of idsToBeSaved) {
            const tag = await Tag.findById(reference, context, id as number);
            if (tag) {
              const wasAdded = tag.addToSection(context, updatedSection.id)
              if (!wasAdded) {
                addTagErrors.push(tag.name);
              }
            }
          }
          if (addTagErrors.length > 0) {
            updatedSection.addError('tags', `Saved but we were unable to assign tags: ${addTagErrors.join(', ')}`);
          }

          // Update the associated template to set isDirty=1
          await Template.markTemplateAsDirty('Section resolver - updateSection', context, sectionData.templateId);

          // Return newly updated section with tags
          return updatedSection.hasErrors() ? updatedSection : await Section.findById(reference, context, updatedSection.id);
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
