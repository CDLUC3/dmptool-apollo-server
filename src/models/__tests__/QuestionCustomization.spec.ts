import { MyContext } from "../../context";
import { QuestionCustomization } from "../QuestionCustomization";
import { MySqlModel } from "../MySqlModel";
import { TemplateCustomizationMigrationStatus } from "../TemplateCustomization";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("QuestionCustomization", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a QuestionCustomization with all properties", () => {
      const options = {
        id: 1,
        created: new Date(),
        createdById: 10,
        modified: new Date(),
        modifiedById: 20,
        errors: {},
        templateCustomizationId: 100,
        questionId: 300,
        migrationStatus: "STALE",
        sampleText: "Test sample text",
        guidanceText: "Test guidance",
      };

      const customization = new QuestionCustomization(options);

      expect(customization.id).toBe(1);
      expect(customization.templateCustomizationId).toBe(100);
      expect(customization.questionId).toBe(300);
      expect(customization.migrationStatus).toBe("STALE");
      expect(customization.guidanceText).toBe("Test guidance");
      expect(customization.sampleText).toBe("Test sample text");
    });

    it("should set default migrationStatus to OK when not provided", () => {
      const options = {
        id: 1,
        templateCustomizationId: 100,
        questionId: 300,
      };

      const customization = new QuestionCustomization(options);

      expect(customization.migrationStatus).toBe(TemplateCustomizationMigrationStatus.OK);
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when templateCustomizationId is null", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: null,
        questionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
    });

    it("should add error when questionId is null", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.questionId).toBe("Question can't be blank");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: null,
        questionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
      expect(customization.errors.questionId).toBe("Question can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from guidanceText and sampleText", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
        guidanceText: "  Test guidance  ",
        sampleText: "  Test sample text  ",
      });
      customization.prepForSave();
      expect(customization.guidanceText).toBe("Test guidance");
      expect(customization.sampleText).toBe("Test sample text");
    });
  });

  describe("create", () => {
    it("should create a new QuestionCustomization when valid and does not exist", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
        guidanceText: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
          guidanceText: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "questionCustomizations",
        customization,
        "QuestionCustomization.create"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Question has already been customized");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: null,
        questionId: 300,
      });

      const result = await customization.create(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing QuestionCustomization when valid", async () => {
      const customization = new QuestionCustomization({
        id: 1,
        templateCustomizationId: 100,
        questionId: 300,
        guidanceText: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
          guidanceText: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "questionCustomizations",
        customization,
        "QuestionCustomization.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidanceText).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new QuestionCustomization({
        id: 1,
        templateCustomizationId: 100,
        questionId: 300,
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "questionCustomizations",
        customization,
        "QuestionCustomization.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Question customization has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new QuestionCustomization({
        id: 1,
        templateCustomizationId: null,
        questionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing QuestionCustomization", async () => {
      const customization = new QuestionCustomization({
        id: 1,
        templateCustomizationId: 100,
        questionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "questionCustomizations",
        1,
        "QuestionCustomization.delete"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new QuestionCustomization({
        templateCustomizationId: 100,
        questionId: 300,
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Question customization has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new QuestionCustomization({
        id: 1,
        templateCustomizationId: 100,
        questionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove the question customization");
    });
  });

  describe("findById", () => {
    it("should find QuestionCustomization by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
          guidanceText: "Test guidance",
        },
      ]);

      const result = await QuestionCustomization.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM questionCustomizations WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(QuestionCustomization);
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await QuestionCustomization.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await QuestionCustomization.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM questionCustomizations WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationAndQuestion", () => {
    it("should find QuestionCustomization by templateCustomizationId and questionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);

      const result = await QuestionCustomization.findByCustomizationAndQuestion(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM questionCustomizations
         WHERE templateCustomizationId = ? AND questionId = ?`,
        ["100", "300"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(QuestionCustomization);
      expect(result.templateCustomizationId).toBe(100);
      expect(result.questionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await QuestionCustomization.findByCustomizationAndQuestion(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(result).toBeUndefined();
    });

    it("should handle null questionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await QuestionCustomization.findByCustomizationAndQuestion(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM questionCustomizations
         WHERE templateCustomizationId = ? AND questionId = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find QuestionCustomizations by templateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          questionId: 300,
        },
      ]);

      const result = await QuestionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM questionCustomizations WHERE templateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(QuestionCustomization);
      expect(result[0].templateCustomizationId).toBe(100);
      expect(result[0].questionId).toBe(300);
    });

    it("should return an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await QuestionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
