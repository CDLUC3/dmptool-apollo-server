import { MyContext } from "../context";
import { VersionedTemplateCustomization } from "../models/VersionedTemplateCustomization";
import { VersionedSection } from "../models/VersionedSection";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { VersionedCustomSection } from "../models/VersionedCustomSection";
import { VersionedCustomQuestion } from "../models/VersionedCustomQuestion";
import { VersionedSectionCustomization } from "../models/VersionedSectionCustomization";
import { VersionedQuestionCustomization } from "../models/VersionedQuestionCustomization";
import { CustomSection, PinnedSectionTypeEnum } from "../models/CustomSection";
import { CustomQuestion } from "../models/CustomQuestion";
import { SectionCustomization } from "../models/SectionCustomization";
import { QuestionCustomization } from "../models/QuestionCustomization";

/**
 * A minimal interface representing the shape of a TemplateCustomization that
 * the helpers need to read from and write errors onto. Using an interface here
 * (rather than importing the class) avoids a circular dependency:
 *   TemplateCustomization → helpers → TemplateCustomization
 */
export interface PublishableCustomization {
  id?: number;
  currentVersionedTemplateId: number;
  addError(field: string, message: string): void;
  hasErrors(): boolean;
}

/**
 * Snapshot all child customization records into their versioned counterparts.
 * Any failure adds an error onto the customization object rather than throwing.
 *
 * @param reference The reference string for logging.
 * @param context The Apollo context.
 * @param customization The TemplateCustomization being published.
 * @param created The newly created VersionedTemplateCustomization snapshot.
 */
export const snapshotCustomizationChildren = async (
  reference: string,
  context: MyContext,
  customization: PublishableCustomization,
  created: VersionedTemplateCustomization
): Promise<void> => {
  // Snapshot custom sections and their questions into versioned equivalents
  const customSections = await CustomSection.findByCustomizationId(
    reference, context, customization.id);

  for (const section of customSections) {
    const versionedSection = new VersionedCustomSection({
      versionedTemplateCustomizationId: created.id,
      customSectionId: section.id,
      pinnedVersionedSectionType: section.pinnedSectionType,
      pinnedVersionedSectionId: section.pinnedSectionId,
      name: section.name,
      introduction: section.introduction,
      requirements: section.requirements,
      guidance: section.guidance,
    });
    const createdSection = await versionedSection.create(context);

    if (!createdSection || createdSection.hasErrors()) {
      customization.addError('general', `Unable to version custom section: ${section.name}`);
      continue;
    }

    // Snapshot custom questions belonging to this custom section
    const customQuestions = await CustomQuestion.findByCustomizationAndSectionId(
      reference, context, customization.id, PinnedSectionTypeEnum.CUSTOM, section.id);

    for (const question of customQuestions) {
      const versionedQuestion = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: created.id,
        customQuestionId: question.id,
        versionedSectionType: question.sectionType,
        versionedSectionId: question.sectionId,
        pinnedVersionedQuestionType: question.pinnedQuestionType ?? null,
        pinnedVersionedQuestionId: question.pinnedQuestionId ?? null,
        questionText: question.questionText,
        json: question.json,
        requirementText: question.requirementText ?? null,
        guidanceText: question.guidanceText ?? null,
        sampleText: question.sampleText ?? null,
        useSampleTextAsDefault: question.useSampleTextAsDefault ?? false,
        required: question.required ?? false,
      });
      const createdQuestion = await versionedQuestion.create(context);

      if (!createdQuestion || createdQuestion.hasErrors()) {
        customization.addError(
          'general',
          `Unable to version custom question in section: ${section.name}`
        );
      }
    }
  }

  // Snapshot custom questions attached to BASE sections (not covered by the loop above)
  const baseCustomQuestions = await CustomQuestion.findByCustomizationAndSectionType(
    reference, context, customization.id, PinnedSectionTypeEnum.BASE);

  for (const question of baseCustomQuestions) {
    const versionedQuestion = new VersionedCustomQuestion({
      versionedTemplateCustomizationId: created.id,
      customQuestionId: question.id,
      versionedSectionType: question.sectionType,
      versionedSectionId: question.sectionId,
      pinnedVersionedQuestionType: question.pinnedQuestionType ?? null,
      pinnedVersionedQuestionId: question.pinnedQuestionId ?? null,
      questionText: question.questionText,
      json: question.json,
      requirementText: question.requirementText ?? null,
      guidanceText: question.guidanceText ?? null,
      sampleText: question.sampleText ?? null,
      useSampleTextAsDefault: question.useSampleTextAsDefault ?? false,
      required: question.required ?? false,
    });
    const createdQuestion = await versionedQuestion.create(context);

    if (!createdQuestion || createdQuestion.hasErrors()) {
      customization.addError(
        'general',
        `Unable to version custom question for base section id: ${question.sectionId}`
      );
    }
  }

  // Snapshot sectionCustomizations into versionedSectionCustomizations
  const sectionCustomizations = await SectionCustomization.findByCustomizationId(
    reference, context, customization.id);

  for (const sectionCust of sectionCustomizations) {
    const versionedSectionRows = await VersionedSection.query(
      context,
      `SELECT id FROM versionedSections
         WHERE sectionId = ? AND versionedTemplateId = ? LIMIT 1`,
      [sectionCust.sectionId.toString(), customization.currentVersionedTemplateId.toString()],
      reference
    );

    if (!versionedSectionRows?.length) {
      customization.addError(
        'general',
        `Unable to find versioned section for sectionId: ${sectionCust.sectionId}`
      );
      continue;
    }

    const versionedSectionCust = new VersionedSectionCustomization({
      versionedTemplateCustomizationId: created.id,
      sectionCustomizationId: sectionCust.id,
      versionedSectionId: versionedSectionRows[0].id,
      guidance: sectionCust.guidance,
      createdById: context.token?.id,
      modifiedById: context.token?.id,
    });
    const createdSectionCust = await versionedSectionCust.create(context);

    if (!createdSectionCust || createdSectionCust.hasErrors()) {
      customization.addError(
        'general',
        `Unable to version section customization for sectionId: ${sectionCust.sectionId}`
      );
    }
  }

  // Snapshot questionCustomizations into versionedQuestionCustomizations
  const questionCustomizations = await QuestionCustomization.findByCustomizationId(
    reference, context, customization.id);

  for (const questionCust of questionCustomizations) {
    const versionedQuestionRows = await VersionedQuestion.query(
      context,
      `SELECT id FROM versionedQuestions
         WHERE questionId = ? AND versionedTemplateId = ? LIMIT 1`,
      [questionCust.questionId.toString(), customization.currentVersionedTemplateId.toString()],
      reference
    );

    if (!versionedQuestionRows?.length) {
      customization.addError(
        'general',
        `Unable to find versioned question for questionId: ${questionCust.questionId}`
      );
      continue;
    }

    const versionedQuestionCust = new VersionedQuestionCustomization({
      versionedTemplateCustomizationId: created.id,
      questionCustomizationId: questionCust.id,
      versionedQuestionId: versionedQuestionRows[0].id,
      guidanceText: questionCust.guidanceText ?? null,
      sampleText: questionCust.sampleText ?? null,
      createdById: context.token?.id,
      modifiedById: context.token?.id,
    });
    const createdQuestionCust = await versionedQuestionCust.create(context);

    if (!createdQuestionCust || createdQuestionCust.hasErrors()) {
      customization.addError(
        'general',
        `Unable to version question customization for questionId: ${questionCust.questionId}`
      );
    }
  }
};

/**
 * Roll back an incomplete published snapshot by deleting the snapshot record.
 * The child tables (versionedCustomSections, versionedCustomQuestions,
 * versionedSectionCustomizations, versionedQuestionCustomizations) are cleaned
 * up automatically via ON DELETE CASCADE on their versionedTemplateCustomizationId
 * FK constraints. Also re-activates the prior published version if one existed.
 *
 * @param context The Apollo context.
 * @param createdVersionId The id of the incomplete VersionedTemplateCustomization.
 * @param priorPublishedVersionId The id of the version to re-activate, if any.
 */
export const rollbackPublishedSnapshot = async (
  context: MyContext,
  createdVersionId: number,
  priorPublishedVersionId: number | undefined
): Promise<void> => {
  const ref = 'rollbackPublishedSnapshot';
  await VersionedTemplateCustomization.delete(
    context,
    VersionedTemplateCustomization.tableName,
    createdVersionId,
    ref
  );
  if (priorPublishedVersionId) {
    const priorVer = await VersionedTemplateCustomization.findById(
      ref, context, priorPublishedVersionId);
    if (priorVer) {
      priorVer.active = true;
      await priorVer.update(context, true);
    }
  }
};
