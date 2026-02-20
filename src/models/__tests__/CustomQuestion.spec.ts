import {MyContext} from "../../context";
import {PinnedSectionTypeEnum} from "../CustomSection";
import {CustomQuestion, PinnedQuestionTypeEnum} from "../CustomQuestion";
import {MySqlModel} from "../MySqlModel";
import {TemplateCustomizationMigrationStatus} from "../TemplateCustomization";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("CustomQuestion", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a CustomQuestion with all properties", () => {
      const options: CustomQuestion = new CustomQuestion({
        id: 1,
        created: new Date().toISOString(),
        createdById: 10,
        modified: new Date().toISOString(),
        modifiedById: 20,
        errors: {},
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedQuestionId: 300,
        migrationStatus: TemplateCustomizationMigrationStatus.STALE,

        questionText: "Test Question",
        json: {
          type: "text",
          attributes: {maxLength: 100},
          meta: {schemaVersion: "1.0"}
        },
        requirementText: "Test requirements",
        guidanceText: "Test guidance",
        sampleText: "Test sample text",
        useSampleTextAsDefault: false,
        required: false
      });

      const customization = new CustomQuestion(options);

      expect(customization.id).toBe(1);
      expect(customization.templateCustomizationId).toBe(100);
      expect(customization.sectionType).toBe("BASE");
      expect(customization.sectionId).toBe(200);
      expect(customization.pinnedQuestionType).toBe("CUSTOM");
      expect(customization.pinnedQuestionId).toBe(300);
      expect(customization.migrationStatus).toBe("STALE");
      expect(customization.questionText).toBe("Test Question");
      expect(customization.json).toEqual(JSON.stringify({
        type: "text",
        attributes: {maxLength: 100},
        meta: {schemaVersion: "1.0"}
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
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedQuestionId: 300,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      };

      const customization = new CustomQuestion(options);

      expect(customization.migrationStatus).toBe(TemplateCustomizationMigrationStatus.OK);
      expect(customization.useSampleTextAsDefault).toBe(false);
      expect(customization.required).toBe(false);
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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

    it("should add error when templateCustomizationId is null", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: null,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        questionText: "Test Question",
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
    });

    it("should add error when sectionType is undefined", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: null,
        sectionId: 200,
        questionText: 'Test Question',
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.sectionId).toBe("Must be attached to either a custom section or a funder section");
    });

    it("should add error when sectionId is undefined", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: null,
        questionText: 'Test Question',
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.sectionId).toBe("Must be attached to either a custom section or a funder section");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: null,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: null,
        questionText: 'Test',
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
      expect(customization.errors.sectionId).toBe("Must be attached to either a custom section or a funder section");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from fields", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
    it("should create a new CustomQuestion when valid and does not exist", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
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
        "customQuestions",
        customization,
        "CustomQuestion.create"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "  Test Question ",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Custom question already exists");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: null,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "  Test Question ",
      });

      const result = await customization.create(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing CustomQuestion when valid", async () => {
      const customization = new CustomQuestion({
        id: 1,
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedQuestionId: 300,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedQuestionId: 300,
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
        "customQuestions",
        customization,
        "CustomQuestion.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.questionText).toBe("Updated question");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new CustomQuestion({
        id: 1,
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
        pinnedQuestionId: 300,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedQuestionId: 300,
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
        "customQuestions",
        customization,
        "CustomQuestion.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Custom question has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new CustomQuestion({
        id: 1,
        templateCustomizationId: null,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
        json: {
          type: "text",
          attributes: { maxLength: 100 },
          meta: { schemaVersion: "1.0" }
        },
        questionText: "Test Question",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing CustomQuestion", async () => {
      const customization = new CustomQuestion({
        id: 1,
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
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
        "customQuestions",
        1,
        "CustomQuestion.delete"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new CustomQuestion({
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
      const customization = new CustomQuestion({
        id: 1,
        templateCustomizationId: 100,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 200,
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
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
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
    it("should find CustomQuestion by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await CustomQuestion.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM customQuestions WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(CustomQuestion);
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomQuestion.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomQuestion.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM customQuestions WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find CustomQuestions by templateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await CustomQuestion.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM customQuestions WHERE templateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(CustomQuestion);
      expect(result[0].templateCustomizationId).toBe(100);
      expect(result[0].sectionId).toBe(200);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomQuestion.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });

  describe("findByCustomizationSectionAndQuestion", () => {
    it("should find CustomQuestion by customization, section and question", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionType: PinnedSectionTypeEnum.BASE,
          sectionId: 200,
          pinnedQuestionType: PinnedQuestionTypeEnum.CUSTOM,
          pinnedQuestionId: 300,
          json: {
            type: "text",
            attributes: { maxLength: 100 },
            meta: { schemaVersion: "1.0" }
          },
          questionText: "Test Question",
        },
      ]);

      const result = await CustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        PinnedSectionTypeEnum.BASE,
        200,
        PinnedQuestionTypeEnum.CUSTOM,
        300
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM customQuestions
         WHERE templateCustomizationId = ? AND sectionType = ? AND sectionId = ?
           AND pinnedQuestionType = ? AND pinnedQuestionId = ?`,
        ["1", "BASE", "200", "CUSTOM", "300"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(CustomQuestion);
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        PinnedSectionTypeEnum.BASE,
        200,
        PinnedQuestionTypeEnum.CUSTOM,
        300
      );

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomQuestion.findByCustomizationSectionAndQuestion(
        "test.ref",
        mockContext,
        1,
        PinnedSectionTypeEnum.BASE,
        200,
        null,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM customQuestions
         WHERE templateCustomizationId = ? AND sectionType = ? AND sectionId = ?
           AND pinnedQuestionType = ? AND pinnedQuestionId = ?`,
        ["1", "BASE", "200", null, null],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });
});
