import {
  AddCustomQuestionInput,
  AddQuestionCustomizationInput,
  MoveCustomQuestionInput,
  Resolvers,
  UpdateCustomQuestionInput, UpdateQuestionCustomizationInput
} from "../types";
import { MyContext } from "../context";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus
} from "../models/TemplateCustomization";
import { authenticatedResolver } from "../services/authService";
import { NotFoundError } from "../utils/graphQLErrors";
import {
  getValidatedCustomization,
  markTemplateCustomizationAsDirty
} from "../services/templateCustomizationService";
import { QuestionCustomization } from "../models/QuestionCustomization";
import { CustomQuestion, PinnedQuestionTypeEnum } from "../models/CustomQuestion";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { UserRole } from "../models/User";
import { PinnedSectionTypeEnum } from "../models/CustomSection";
import { VersionedQuestion } from "../models/VersionedQuestion";

export const resolvers: Resolvers = {
  Query: {
    /**
     * ADMIN ONLY: Fetch the specified QuestionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the QuestionCustomization
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws NotFoundError when the QuestionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    questionCustomization: authenticatedResolver(
      'questionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { questionCustomizationId }: { questionCustomizationId: number },
        context: MyContext
      ): Promise<QuestionCustomization> => {
        const ref = 'questionCustomization resolver';

        const customization: QuestionCustomization = await QuestionCustomization.findById(
          ref,
          context,
          questionCustomizationId
        );
        if (!customization) throw NotFoundError();

        // Find the parent template customization and verify the user has access.
        // This will throw a forbidden error if they do not.
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );
        if (isNullOrUndefined(parent)) throw NotFoundError();

        return customization;
      }),

    /**
     * ADMIN ONLY: Fetch the specified CustomQuestion
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the CustomQuestion
     * @param context The Apollo context
     * @returns The CustomQuestion or null
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    customQuestion: authenticatedResolver(
      'customQuestion resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { customQuestionId }: { customQuestionId: number },
        context: MyContext
      ): Promise<CustomQuestion> => {
        const ref = 'customQuestion resolver'
        // Fetch the CustomQuestion
        const customization: CustomQuestion = await CustomQuestion.findById(
          ref,
          context,
          customQuestionId
        );
        if (!customization) throw NotFoundError();

        // Find the parent template customization and verify the user has access.
        // This will throw a forbidden error if they do not.
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );
        if (isNullOrUndefined(parent)) throw NotFoundError();

        return customization;
      }),
  },

  Mutation: {
    /**
     * ADMIN ONLY: Create a new QuestionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { templateCustomizationId, versionedSectionId }
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    addQuestionCustomization: authenticatedResolver(
      'addQuestionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddQuestionCustomizationInput },
        context: MyContext
      ): Promise<QuestionCustomization> => {
        const ref = 'addQuestionCustomization resolver';
        const { templateCustomizationId, versionedQuestionId } = input;

        // Fetch the versioned question
        const question: VersionedQuestion = await VersionedQuestion.findById(
          ref,
          context,
          versionedQuestionId
        );
        if (!question) throw NotFoundError();


        // Fetch the parent template customization and verify that the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          templateCustomizationId
        );

        const customization = new QuestionCustomization({
          templateCustomizationId,
          questionId: question.questionId,
          migrationStatus: TemplateCustomizationMigrationStatus.OK
        });

        // Save the new section customization
        const created: QuestionCustomization = await customization.create(context);

        // If it was successfully created, update the parent's isDirty flag
        if (created && !created.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, created);
        }
        return created;
      }),

    /**
     * ADMIN ONLY: Update the specified QuestionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { questionCustomizationId, guidance }
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    updateQuestionCustomization: authenticatedResolver(
      'updateQuestionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateQuestionCustomizationInput },
        context: MyContext
      ): Promise<QuestionCustomization> => {
        const { questionCustomizationId, guidanceText, sampleText } = input;
        const ref = 'updateQuestionCustomization resolver';

        // Fetch the specified QuestionCustomization
        const customization: QuestionCustomization = await QuestionCustomization.findById(
          ref,
          context,
          questionCustomizationId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent templateCustomization and make sure the user has access
        const parent = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        // Update the guidance
        customization.guidanceText = guidanceText;
        customization.sampleText = sampleText;
        const updated: QuestionCustomization = await customization.update(context);

        // If it was successfully updated, update the parent's isDirty flag
        if (updated && !updated.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, updated);
        }
        return updated;
      }
    ),

    /**
     * ADMIN ONLY: Delete the specified QuestionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the QuestionCustomization to remove
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    removeQuestionCustomization: authenticatedResolver(
      'removeQuestionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { questionCustomizationId }: { questionCustomizationId: number },
        context: MyContext
      ): Promise<QuestionCustomization> => {
        const ref = 'removeQuestionCustomization resolver';
        const customization: QuestionCustomization = await QuestionCustomization.findById(
          ref,
          context,
          questionCustomizationId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent template customization and verify the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        const deleted: QuestionCustomization = await customization.delete(context);
        // If it was successfully deleted, update the parent's isDirty flag
        if (deleted && !deleted.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, deleted);
        }
        return deleted;
      }),

    /**
     * ADMIN ONLY: Create a new CustomQuestion.
     * The section will appear first in the template if the pinnedQuestionId is null
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { templateCustomizationId, pinnedQuestionType,
     * pinnedQuestionId }
     * @param context The Apollo context
     * @returns The CustomQuestion (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    addCustomQuestion: authenticatedResolver(
      'addCustomQuestion resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddCustomQuestionInput },
        context: MyContext
      ): Promise<CustomQuestion> => {
        const ref = 'addCustomQuestion resolver';

        // Fetch the parent template customization and verify the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          input.templateCustomizationId
        );

        const customQuestion = new CustomQuestion({
          ...input,
          migrationStatus: TemplateCustomizationMigrationStatus.OK
        });

        // Save the new custom section
        const created: CustomQuestion = await customQuestion.create(context);

        // If it was successfully created, update the parent's isDirty flag
        if (created && !created.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, created);
        }
        return created;
      }),

    /**
     * ADMIN ONLY: Update the specified CustomQuestion
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { customQuestionId, name, introduction,
     * requirements, guidance }
     * @param context The Apollo context
     * @returns The CustomQuestion (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    updateCustomQuestion: authenticatedResolver(
      'updateCustomQuestion resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateCustomQuestionInput },
        context: MyContext
      ): Promise<CustomQuestion> => {
        const ref = 'updateCustomQuestion resolver';
        const { customQuestionId, questionText, json, requirementText, guidanceText,
          sampleText, useSampleTextAsDefault, required } = input;

        const customization: CustomQuestion = await CustomQuestion.findById(
          ref,
          context,
          customQuestionId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent template customization and verify that the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        // Update the section
        customization.questionText = questionText;
        customization.json = json;
        customization.requirementText = requirementText;
        customization.guidanceText = guidanceText;
        customization.sampleText = sampleText;
        customization.useSampleTextAsDefault = useSampleTextAsDefault;
        customization.required = required;
        const updated: CustomQuestion =  await customization.update(context);

        // If it was successfully updated, update the parent's isDirty flag
        if (updated && !updated.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, updated);
        }
        return updated;
      }),

    /**
     * ADMIN ONLY: Delete the specified CustomQuestion
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the CustomQuestion to remove
     * @param context The Apollo context
     * @returns The original CustomQuestion (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    removeCustomQuestion: authenticatedResolver(
      'updateCustomQuestion resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { customQuestionId }: { customQuestionId: number },
        context: MyContext
      ): Promise<CustomQuestion> => {
        const ref = 'removeCustomQuestion resolver';
        const customization: CustomQuestion = await CustomQuestion.findById(
          ref,
          context,
          customQuestionId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent template customization and verify that the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        const deleted: CustomQuestion = await customization.delete(context);
        // If it was successfully deleted, update the parent's isDirty flag
        if (deleted && !deleted.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, deleted);
        }
        return deleted;
      }),

    /**
     * ADMIN ONLY: Move the specified CustomQuestion by pinning it to the designated section.
     * It will become the first section of the template if newSectionId is `null`.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { customQuestionId, newSectionType, newSectionId }
     * @param context The Apollo context
     * @returns The CustomQuestion (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomQuestion or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    moveCustomQuestion: authenticatedResolver(
      'moveCustomQuestion resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: MoveCustomQuestionInput },
        context: MyContext
      ): Promise<CustomQuestion> => {
        const ref = 'moveCustomQuestion resolver';
        const { customQuestionId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId } = input;

        const customization: CustomQuestion = await CustomQuestion.findById(
          ref,
          context,
          customQuestionId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent template customization and verify the user has access
        const parent: TemplateCustomization = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        const newPinType: PinnedQuestionTypeEnum = PinnedQuestionTypeEnum[pinnedQuestionType];
        // Section info cannot be null, but pinned question info can
        customization.sectionType = PinnedSectionTypeEnum[sectionType];
        customization.sectionId = sectionId;
        customization.pinnedQuestionType = isNullOrUndefined(newPinType) ? null : newPinType;
        customization.pinnedQuestionId = isNullOrUndefined(pinnedQuestionId) ? null : pinnedQuestionId;
        const moved: CustomQuestion = await customization.update(context);

        // If it was successfully moved, update the parent's isDirty flag
        if (moved && !moved.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, moved);
        }

        return moved;
      }),
  },

  QuestionCustomization: {
    /**
     * The VersionedQuestion that the QuestionCustomization applies to
     * @param parent The QuestionCustomization
     * @param _ TArgs not used here
     * @param context The Apollo context
     * @returns The VersionedQuestion
     */
    versionedQuestion: async (
      parent: QuestionCustomization,
      _: Record<PropertyKey, never>,
      context: MyContext
    ): Promise<VersionedQuestion> => {
      const ref = 'QuestionCustomization.versionedQuestion chained resolver';
      if (isNullOrUndefined(parent?.questionId)) return null;

      const customization = await TemplateCustomization.findById(ref, context, parent.templateCustomizationId);
      return isNullOrUndefined(customization)
        ? null
        : await VersionedQuestion.findByVersionedTemplateIdAndQuestionId(
          ref,
          context,
          customization.currentVersionedTemplateId,
          parent.questionId
        );
    },
    /**
     * Format the created date time
     * @param parent The QuestionCustomization
     * @returns the formatted date
     */
    created: (parent: QuestionCustomization): string => {
      return normaliseDateTime(parent.created);
    },
    /**
     * Format the modified date time
     * @param parent The QuestionCustomization
     * @returns the formatted date time
     */
    modified: (parent: QuestionCustomization): string => {
      return normaliseDateTime(parent.modified);
    }
  },

  CustomQuestion: {
    /**
     * Format the created date time
     * @param parent The CustomQuestion
     * @returns the formatted date time
     */
    created: (parent: CustomQuestion): string => {
      return normaliseDateTime(parent.created);
    },
    /**
     * Format the modified date time
     * @param parent The CustomQuestion
     * @returns the formatted date time
     */
    modified: (parent: CustomQuestion): string => {
      return normaliseDateTime(parent.modified);
    }
  },
};
