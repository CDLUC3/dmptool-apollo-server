import { MyContext } from "../../context";
import { VersionedTemplateCustomization } from "../../models/VersionedTemplateCustomization";
import { VersionedSection } from "../../models/VersionedSection";
import { VersionedQuestion } from "../../models/VersionedQuestion";
import { VersionedCustomSection } from "../../models/VersionedCustomSection";
import { VersionedCustomQuestion } from "../../models/VersionedCustomQuestion";
import { CustomSection, PinnedSectionTypeEnum } from "../../models/CustomSection";
import { CustomQuestion } from "../../models/CustomQuestion";
import { SectionCustomization } from "../../models/SectionCustomization";
import { QuestionCustomization } from "../../models/QuestionCustomization";
import {
  PublishableCustomization,
  snapshotCustomizationChildren,
  rollbackPublishedSnapshot,
} from "../templateCustomizationPublishHelpers";
import { User, UserRole } from "../../models/User";
import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock("../../models/VersionedTemplateCustomization");
jest.mock("../../models/VersionedSection");
jest.mock("../../models/VersionedQuestion");
jest.mock("../../models/VersionedCustomSection");
jest.mock("../../models/VersionedCustomQuestion");
jest.mock("../../models/VersionedSectionCustomization");
jest.mock("../../models/VersionedQuestionCustomization");
jest.mock("../../models/CustomSection");
jest.mock("../../models/CustomQuestion");
jest.mock("../../models/SectionCustomization");
jest.mock("../../models/QuestionCustomization");

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
    (user.getEmail as jest.Mock) = jest.fn().mockResolvedValue(casual.email);
    mockContext = await buildMockContextWithToken(logger, user);
  });

  describe("snapshotCustomizationChildren", () => {
    let customization: PublishableCustomization;
    let created: VersionedTemplateCustomization;

    beforeEach(() => {
      customization = {
        id: 1,
        currentVersionedTemplateId: 10,
        addError: jest.fn(),
        hasErrors: jest.fn().mockReturnValue(false),
      };
      created = new VersionedTemplateCustomization({ id: 99 });
    });

    it("should do nothing when there are no custom sections, questions, or customizations", async () => {
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).not.toHaveBeenCalled();
    });

    it("should add error when versioning a custom section fails", async () => {
      const mockSection = { id: 5, name: "My Section" };
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([mockSection]);
      (CustomQuestion.findByCustomizationAndSectionId as jest.Mock).mockResolvedValue([]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);

      const failedSection = new VersionedCustomSection({ errors: { general: "DB error" } });
      (failedSection.hasErrors as jest.Mock) = jest.fn().mockReturnValue(true);
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
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([mockSection]);
      (CustomQuestion.findByCustomizationAndSectionId as jest.Mock).mockResolvedValue([mockQuestion]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);

      const okSection = new VersionedCustomSection({ id: 50 });
      (okSection.hasErrors as jest.Mock) = jest.fn().mockReturnValue(false);
      jest.spyOn(VersionedCustomSection.prototype, "create").mockResolvedValue(okSection);
      const failedQuestion = new VersionedCustomQuestion({ errors: { general: "DB error" } });
      (failedQuestion.hasErrors as jest.Mock) = jest.fn().mockReturnValue(true);
      jest.spyOn(VersionedCustomQuestion.prototype, "create").mockResolvedValue(failedQuestion);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to version custom question in section: ${mockSection.name}`
      );
    });

    it("should add error when versioning a section customization and versioned section lookup fails", async () => {
      const mockSectionCust = { id: 7, sectionId: 20, guidance: "Some guidance" };
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([mockSectionCust]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (VersionedSection.query as jest.Mock).mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to find versioned section for sectionId: ${mockSectionCust.sectionId}`
      );
    });

    it("should add error when versioning a question customization and versioned question lookup fails", async () => {
      const mockQuestionCust = { id: 8, questionId: 30, guidanceText: null, sampleText: null };
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([mockQuestionCust]);
      (VersionedQuestion.query as jest.Mock).mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).toHaveBeenCalledWith(
        "general",
        `Unable to find versioned question for questionId: ${mockQuestionCust.questionId}`
      );
    });

    it("should successfully snapshot all children without errors", async () => {
      (CustomSection.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (CustomQuestion.findByCustomizationAndSectionType as jest.Mock).mockResolvedValue([]);
      (SectionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);
      (QuestionCustomization.findByCustomizationId as jest.Mock).mockResolvedValue([]);

      await snapshotCustomizationChildren(reference, mockContext, customization, created);

      expect(customization.addError).not.toHaveBeenCalled();
    });
  });

  describe("rollbackPublishedSnapshot", () => {
    it("should delete the snapshot and cascade to child rows without restoring a prior version", async () => {
      (VersionedTemplateCustomization.delete as jest.Mock).mockResolvedValue(true);

      await rollbackPublishedSnapshot(mockContext, 99, undefined);

      expect(VersionedTemplateCustomization.delete).toHaveBeenCalledWith(
        mockContext,
        VersionedTemplateCustomization.tableName,
        99,
        "rollbackPublishedSnapshot"
      );
      expect(VersionedTemplateCustomization.findById).not.toHaveBeenCalled();
    });

    it("should re-activate the prior published version when priorPublishedVersionId is provided", async () => {
      (VersionedTemplateCustomization.delete as jest.Mock).mockResolvedValue(true);

      const priorVer = new VersionedTemplateCustomization({ id: 50, active: false });
      priorVer.update = jest.fn().mockResolvedValue({ ...priorVer, active: true });
      (VersionedTemplateCustomization.findById as jest.Mock).mockResolvedValue(priorVer);

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
      (VersionedTemplateCustomization.delete as jest.Mock).mockResolvedValue(true);
      (VersionedTemplateCustomization.findById as jest.Mock).mockResolvedValue(null);

      await rollbackPublishedSnapshot(mockContext, 99, 50);

      expect(VersionedTemplateCustomization.findById).toHaveBeenCalled();
    });
  });
});
