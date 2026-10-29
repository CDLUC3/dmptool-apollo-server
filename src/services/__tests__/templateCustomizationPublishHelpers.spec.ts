/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// No jest.unstable_mockModule needed anywhere in this file — every model is
// real, spied per-test via jest.spyOn (matching how the original already
// used jest.spyOn(X.prototype, "create") for the Versioned* classes rather
// than relying on automock-specific constructor behavior).
// ---------------------------------------------------------------------------
import type { MyContext } from "../../context.js";
import type { PublishableCustomization } from "../templateCustomizationPublishHelpers.js";

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { VersionedTemplateCustomization } = await import("../../models/VersionedTemplateCustomization.js");
const { VersionedSection } = await import("../../models/VersionedSection.js");
const { VersionedQuestion } = await import("../../models/VersionedQuestion.js");
const { VersionedCustomSection } = await import("../../models/VersionedCustomSection.js");
const { VersionedCustomQuestion } = await import("../../models/VersionedCustomQuestion.js");
const { CustomSection, PinnedSectionTypeEnum } = await import("../../models/CustomSection.js");
const { CustomQuestion } = await import("../../models/CustomQuestion.js");
const { SectionCustomization } = await import("../../models/SectionCustomization.js");
const { QuestionCustomization } = await import("../../models/QuestionCustomization.js");
const { VersionedSectionCustomization } = await import("../../models/VersionedSectionCustomization.js");
const { VersionedQuestionCustomization } = await import("../../models/VersionedQuestionCustomization.js");
const {
  snapshotCustomizationChildren,
  rollbackPublishedSnapshot,
} = await import("../templateCustomizationPublishHelpers.js");
const { User, UserRole } = await import("../../models/User.js");

// ---------------------------------------------------------------------------
// Cast helpers: jest.spyOn ties itself to each real class's method
// signature, so plain-object fixtures need casting at the point they're
// handed to a spied static method — never at their own declaration.
// ---------------------------------------------------------------------------
type CustomSectionInstance = InstanceType<typeof CustomSection>;
function asCustomSectionList(value: any[]): CustomSectionInstance[] {
  return value as CustomSectionInstance[];
}

type CustomQuestionInstance = InstanceType<typeof CustomQuestion>;
function asCustomQuestionList(value: any[]): CustomQuestionInstance[] {
  return value as CustomQuestionInstance[];
}

type SectionCustomizationInstance = InstanceType<typeof SectionCustomization>;
function asSectionCustomizationList(value: any[]): SectionCustomizationInstance[] {
  return value as SectionCustomizationInstance[];
}

type QuestionCustomizationInstance = InstanceType<typeof QuestionCustomization>;
function asQuestionCustomizationList(value: any[]): QuestionCustomizationInstance[] {
  return value as QuestionCustomizationInstance[];
}

type VersionedTemplateCustomizationInstance = InstanceType<typeof VersionedTemplateCustomization>;
function asVersionedTemplateCustomization(value: any): VersionedTemplateCustomizationInstance {
  return value as VersionedTemplateCustomizationInstance;
}

describe("templateCustomizationPublishHelpers", () => {
  let mockContext: MyContext;
  const reference = "test-reference";

  beforeEach(async () => {
    jest.clearAllMocks();
    const user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.ADMIN,
      affiliationId: casual.url,
    });
    jest.spyOn(user, 'getEmail').mockResolvedValue(casual.email);
    mockContext = await buildMockContextWithToken(logger, user);
  });

  describe("snapshotCustomizationChildren", () => {
    let customization: PublishableCustomization;
    let created: VersionedTemplateCustomizationInstance;

    beforeEach(() => {
      customization = {
        id: 1,
        currentVersionedTemplateId: 10,
        addError: jest.fn<(...args: any[]) => void>(),
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
      };
      created = new VersionedTemplateCustomization({ id: 99 });
    });

    it("should do nothing when there are no custom sections, questions, or customizations", async () => {
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).not.toHaveBeenCalled();
    });

    it("should add error when versioning a custom section fails", async () => {
      const mockSection = { id: 5, name: "My Section" };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue(asCustomSectionList([mockSection]));
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);

      const failedSection = new VersionedCustomSection({ errors: { general: "DB error" } });
      jest.spyOn(failedSection, 'hasErrors').mockReturnValue(true);
      jest.spyOn(VersionedCustomSection.prototype, "create").mockResolvedValue(failedSection);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version custom section: ${mockSection.name}`
      );
    });

    it("should add error when versioning a custom question in a custom section fails", async () => {
      const mockSection = { id: 5, name: "My Section" };
      const mockQuestion = {
        id: 10,
        sectionType: PinnedSectionTypeEnum.CUSTOM,
        sectionId: 5,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        questionText: "Q?",
        json: "{}",
        requirementText: null,
        guidanceText: null,
        sampleText: null,
        useSampleTextAsDefault: false,
        required: false,
      };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue(asCustomSectionList([mockSection]));
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionId').mockResolvedValue(asCustomQuestionList([mockQuestion]));
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);

      const okSection = new VersionedCustomSection({ id: 50 });
      jest.spyOn(okSection, 'hasErrors').mockReturnValue(false);
      jest.spyOn(VersionedCustomSection.prototype, "create").mockResolvedValue(okSection);
      const failedQuestion = new VersionedCustomQuestion({ errors: { general: "DB error" } });
      jest.spyOn(failedQuestion, 'hasErrors').mockReturnValue(true);
      jest.spyOn(VersionedCustomQuestion.prototype, "create").mockResolvedValue(failedQuestion);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version custom question in section: ${mockSection.name}`
      );
    });

    it("should add error when versioning a section customization and versioned section lookup fails", async () => {
      const mockSectionCust = { id: 7, sectionId: 20, guidance: "Some guidance" };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue(asSectionCustomizationList([mockSectionCust]));
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(VersionedSection, 'query').mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to find versioned section for sectionId: ${mockSectionCust.sectionId}`
      );
    });

    it("should add error when versioning a question customization and versioned question lookup fails", async () => {
      const mockQuestionCust = { id: 8, questionId: 30, guidanceText: null, sampleText: null };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue(asQuestionCustomizationList([mockQuestionCust]));
      jest.spyOn(VersionedQuestion, 'query').mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to find versioned question for questionId: ${mockQuestionCust.questionId}`
      );
    });

    it("should add error when versioning a BASE custom question fails", async () => {
      const mockQuestion = {
        id: 20,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 7,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        questionText: "Q?",
        json: "{}",
        requirementText: null,
        guidanceText: null,
        sampleText: null,
        useSampleTextAsDefault: false,
        required: false,
      };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue(asCustomQuestionList([mockQuestion]));
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);

      const failedQuestion = new VersionedCustomQuestion({ errors: { general: "DB error" } });
      jest.spyOn(failedQuestion, 'hasErrors').mockReturnValue(true);
      jest.spyOn(VersionedCustomQuestion.prototype, "create").mockResolvedValue(failedQuestion);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version custom question for base section id: ${mockQuestion.sectionId}`
      );
    });

    it("should add error when VersionedSectionCustomization creation fails after section lookup succeeds", async () => {
      const mockSectionCust = { id: 7, sectionId: 20, guidance: "Some guidance" };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue(asSectionCustomizationList([mockSectionCust]));
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(VersionedSection, 'query').mockResolvedValue([{ id: 100 }]);

      const failedSectionCust = new VersionedSectionCustomization({ errors: { general: "DB error" } });
      jest.spyOn(failedSectionCust, 'hasErrors').mockReturnValue(true);
      jest.spyOn(VersionedSectionCustomization.prototype, "create").mockResolvedValue(failedSectionCust);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version section customization for sectionId: ${mockSectionCust.sectionId}`
      );
    });

    it("should add error when VersionedQuestionCustomization creation fails after question lookup succeeds", async () => {
      const mockQuestionCust = { id: 8, questionId: 30, guidanceText: null, sampleText: null };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue(asQuestionCustomizationList([mockQuestionCust]));
      jest.spyOn(VersionedQuestion, 'query').mockResolvedValue([{ id: 200 }]);

      const failedQuestionCust = new VersionedQuestionCustomization({ errors: { general: "DB error" } });
      jest.spyOn(failedQuestionCust, 'hasErrors').mockReturnValue(true);
      jest.spyOn(VersionedQuestionCustomization.prototype, "create").mockResolvedValue(failedQuestionCust);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version question customization for questionId: ${mockQuestionCust.questionId}`
      );
    });

    it("should successfully snapshot all children including section and question customizations", async () => {
      const mockSectionCust = { id: 7, sectionId: 20, guidance: "Some guidance" };
      const mockQuestionCust = { id: 8, questionId: 30, guidanceText: null, sampleText: null };
      jest.spyOn(CustomSection, 'findByCustomizationId').mockResolvedValue([]);
      jest.spyOn(CustomQuestion, 'findByCustomizationAndSectionType').mockResolvedValue([]);
      jest.spyOn(SectionCustomization, 'findByCustomizationId').mockResolvedValue(asSectionCustomizationList([mockSectionCust]));
      jest.spyOn(QuestionCustomization, 'findByCustomizationId').mockResolvedValue(asQuestionCustomizationList([mockQuestionCust]));
      jest.spyOn(VersionedSection, 'query').mockResolvedValue([{ id: 100 }]);
      jest.spyOn(VersionedQuestion, 'query').mockResolvedValue([{ id: 200 }]);

      const okSectionCust = new VersionedSectionCustomization({ id: 70 });
      jest.spyOn(okSectionCust, 'hasErrors').mockReturnValue(false);
      jest.spyOn(VersionedSectionCustomization.prototype, "create").mockResolvedValue(okSectionCust);

      const okQuestionCust = new VersionedQuestionCustomization({ id: 80 });
      jest.spyOn(okQuestionCust, 'hasErrors').mockReturnValue(false);
      jest.spyOn(VersionedQuestionCustomization.prototype, "create").mockResolvedValue(okQuestionCust);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).not.toHaveBeenCalled();
    });
  });

  describe("rollbackPublishedSnapshot", () => {
    it("should delete the snapshot and cascade to child rows without restoring a prior version", async () => {
      jest.spyOn(VersionedTemplateCustomization, 'delete').mockResolvedValue(true);
      const findByIdSpy = jest.spyOn(VersionedTemplateCustomization, 'findById');

      await rollbackPublishedSnapshot(mockContext, 99, undefined);

      expect(VersionedTemplateCustomization.delete).toHaveBeenCalledWith(
        mockContext,
        VersionedTemplateCustomization.tableName,
        99,
        "rollbackPublishedSnapshot"
      );
      expect(findByIdSpy).not.toHaveBeenCalled();
    });

    it("should re-activate the prior published version when priorPublishedVersionId is provided", async () => {
      jest.spyOn(VersionedTemplateCustomization, 'delete').mockResolvedValue(true);

      const priorVer = new VersionedTemplateCustomization({ id: 50, active: false });
      jest.spyOn(priorVer, 'update').mockResolvedValue(
        asVersionedTemplateCustomization({ ...priorVer, active: true })
      );
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(priorVer);

      await rollbackPublishedSnapshot(mockContext, 99, 50);

      expect(VersionedTemplateCustomization.findById).toHaveBeenCalledWith(
        "rollbackPublishedSnapshot",
        mockContext,
        50
      );
      expect(priorVer.active).toBe(true);
      expect(priorVer.update).toHaveBeenCalledWith(mockContext, true);
    });

    it("should not attempt to restore prior version when findById returns null", async () => {
      jest.spyOn(VersionedTemplateCustomization, 'delete').mockResolvedValue(true);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(null);

      await rollbackPublishedSnapshot(mockContext, 99, 50);

      expect(VersionedTemplateCustomization.findById).toHaveBeenCalled();
    });
  });
});