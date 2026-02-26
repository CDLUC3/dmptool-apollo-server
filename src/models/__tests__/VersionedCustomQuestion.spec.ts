import { MyContext } from "../../context";
import { PinnedSectionTypeEnum } from "../CustomSection";
import { PinnedQuestionTypeEnum } from "../CustomQuestion";
import { VersionedCustomQuestion } from "../VersionedCustomQuestion";
import { MySqlModel } from "../MySqlModel";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("VersionedCustomQuestion", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a VersionedCustomQuestion with all properties", () => {
      const options: VersionedCustomQuestion = new VersionedCustomQuestion({
        id: 1,
        created: new Date().toISOString(),
        createdById: 10,
        modified: new Date().toISOString(),
        modifiedById: 20,
        errors: {},
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedVersionedQuestionId: 400,

        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        requirementText: "Test requirements",
        guidanceText: "Test guidance",
        sampleText: "Test sample text",
        useSampleTextAsDefault: false,
        required: false
      });

      const customization = new VersionedCustomQuestion(options);

      expect(customization.id).toBe(1);
      expect(customization.versionedTemplateCustomizationId).toBe(100);
      expect(customization.customQuestionId).toBe(200);
      expect(customization.versionedSectionType).toBe("BASE");
      expect(customization.versionedSectionId).toBe(300);
      expect(customization.pinnedVersionedQuestionType).toBe("CUSTOM");
      expect(customization.pinnedVersionedQuestionId).toBe(400);
      expect(customization.questionText).toBe("Test Question");
      expect(customization.json).toEqual(JSON.stringify({
        type: "text",
        attributes: { maxLength: 100 },
        meta: { schemaVersion: "1.0" }
      }));
      expect(customization.requirementText).toBe("Test requirements");
      expect(customization.guidanceText).toBe("Test guidance");
      expect(customization.sampleText).toBe("Test sample text");
      expect(customization.useSampleTextAsDefault).toBe(false);
      expect(customization.required).toBe(false);
    });

    it("should set default values when not provided", () => {
      const options = {
        id: 1,
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedVersionedQuestionId: 400,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      };

      const customization = new VersionedCustomQuestion(options);

      expect(customization.useSampleTextAsDefault).toBe(false);
      expect(customization.required).toBe(false);
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when versionedTemplateCustomizationId is null", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: null,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });

    it("should add error when customQuestionId is null", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: null,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.customQuestionId).toBe("Custom question can't be blank");
    });

    it("should add error when questionText is undefined", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        questionText: null,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.questionText).toBe("Question text can't be blank");
    });

    it("should add error when versionedSectionType is undefined", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: null,
        versionedSectionId: 300,
        questionText: 'Test Question',
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedSectionId).toBe("Must be attached to either a version of a custom section or a funder section");
    });

    it("should add error when versionedSectionId is undefined", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: null,
        questionText: 'Test Question',
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedSectionId).toBe("Must be attached to either a version of a custom section or a funder section");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: null,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        questionText: null,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
      expect(customization.errors.questionText).toBe("Question text can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from fields", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
        requirementText: "  Test requirements    ",
        sampleText: "  Test sample text  ",
        guidanceText: "  Test guidance  ",
      });
      customization.prepForSave();
      expect(customization.questionText).toBe("Test Question");
      expect(customization.sampleText).toBe("Test sample text");
      expect(customization.requirementText).toBe("Test requirements");
      expect(customization.guidanceText).toBe("Test guidance");
    });
  });

  describe("create", () => {
    it("should create a new VersionedCustomQuestion when valid and does not exist", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "  Test Question ",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomQuestions",
        customization,
        "VersionedCustomQuestion.create"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "  Test Question ",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Custom question version already exists");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: null,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
      });

      const result = await customization.create(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing VersionedCustomQuestion when valid", async () => {
      const customization = new VersionedCustomQuestion({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedVersionedQuestionId: 400,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Updated question",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedVersionedQuestionId: 400,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Updated question",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomQuestions",
        customization,
        "VersionedCustomQuestion.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.questionText).toBe("Updated question");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new VersionedCustomQuestion({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedVersionedQuestionId: 400,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedVersionedQuestionId: 400,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "  Test Question ",
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomQuestions",
        customization,
        "VersionedCustomQuestion.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Custom question version has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedCustomQuestion({
        id: 1,
        versionedTemplateCustomizationId: null,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing VersionedCustomQuestion", async () => {
      const customization = new VersionedCustomQuestion({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomQuestions",
        1,
        "VersionedCustomQuestion.delete"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedCustomQuestion({
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Custom question has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new VersionedCustomQuestion({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customQuestionId: 200,
        versionedSectionType: PinnedSectionTypeEnum.BASE,
        versionedSectionId: 300,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove custom question");
    });
  });

  describe("findById", () => {
    it("should find VersionedCustomQuestion by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await VersionedCustomQuestion.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedCustomQuestions WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedCustomQuestion);
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomQuestion.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomQuestion.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedCustomQuestions WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find VersionedCustomQuestions by versionedTemplateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await VersionedCustomQuestion.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedCustomQuestions
         WHERE versionedTemplateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(VersionedCustomQuestion);
      expect(result[0].versionedTemplateCustomizationId).toBe(100);
      expect(result[0].versionedSectionId).toBe(300);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomQuestion.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });

  describe("findByCustomizationSectionAndQuestion", () => {
    it("should find VersionedCustomQuestion by customization, section and question", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customQuestionId: 200,
          versionedSectionType: PinnedSectionTypeEnum.BASE,
          versionedSectionId: 300,
          pinnedVersionedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedVersionedQuestionId: 400,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await VersionedCustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        200,
        PinnedSectionTypeEnum.BASE,
        300,
        PinnedQuestionTypeEnum.CUSTOM,
        400
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedCustomQuestions
         WHERE versionedTemplateCustomizationId = ? AND customQuestionId = ?
           AND versionedSectionType = ? AND versionedSectionId = ?
           AND pinnedVersionedQuestionType = ? AND pinnedVersionedQuestionId = ?`,
        ["1", "200", "BASE", "300", "CUSTOM", "400"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedCustomQuestion);
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        200,
        PinnedSectionTypeEnum.BASE,
        300,
        PinnedQuestionTypeEnum.CUSTOM,
        400
      );

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        200,
        PinnedSectionTypeEnum.BASE,
        300,
        null,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedCustomQuestions
         WHERE versionedTemplateCustomizationId = ? AND customQuestionId = ?
           AND versionedSectionType = ? AND versionedSectionId = ?
           AND pinnedVersionedQuestionType = ? AND pinnedVersionedQuestionId = ?`,
        ["1", "200", "BASE", "300", null, null],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });
});
