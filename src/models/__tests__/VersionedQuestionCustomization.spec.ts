import { MyContext } from "../../context";
import { VersionedQuestionCustomization } from "../VersionedQuestionCustomization";
import { MySqlModel } from "../MySqlModel";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("VersionedQuestionCustomization", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  describe("constructor", () => {
    it("should create a VersionedQuestionCustomization with all properties", () => {
      const options = {
        id: 1,
        created: new Date(),
        createdById: 10,
        modified: new Date(),
        modifiedById: 20,
        errors: {},
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
        sampleText: "Test sample text",
        guidanceText: "Test guidance",
      };

      const customization = new VersionedQuestionCustomization(options);

      expect(customization.id).toBe(1);
      expect(customization.versionedTemplateCustomizationId).toBe(100);
      expect(customization.versionedQuestionId).toBe(300);
      expect(customization.guidanceText).toBe("Test guidance");
      expect(customization.sampleText).toBe("Test sample text");
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when versionedTemplateCustomizationId is null", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: null,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });

    it("should add error when questionCustomizationId is null", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: null,
        versionedQuestionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.questionCustomizationId).toBe("Versioned question customization can't be blank");
    });

    it("should add error when versionedQuestionId is null", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedQuestionId).toBe("Versioned question can't be blank");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: null,
        questionCustomizationId: 200,
        versionedQuestionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
      expect(customization.errors.versionedQuestionId).toBe("Versioned question can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from guidanceText and sampleText", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
        guidanceText: "  Test guidance  ",
        sampleText: "  Test sample text  ",
      });
      customization.prepForSave();
      expect(customization.guidanceText).toBe("Test guidance");
      expect(customization.sampleText).toBe("Test sample text");
    });
  });

  describe("create", () => {
    it("should create a new VersionedQuestionCustomization when valid and does not exist", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
        guidanceText: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
          guidanceText: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "versionedQuestionCustomizations",
        customization,
        "VersionedQuestionCustomization.create"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Question has already been customized");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: null,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const result = await customization.create(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing VersionedQuestionCustomization when valid", async () => {
      const customization = new VersionedQuestionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
        guidanceText: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
          guidanceText: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedQuestionCustomizations",
        customization,
        "VersionedQuestionCustomization.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidanceText).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new VersionedQuestionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedQuestionCustomizations",
        customization,
        "VersionedQuestionCustomization.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Versioned question customization has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedQuestionCustomization({
        id: 1,
        versionedTemplateCustomizationId: null,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing VersionedQuestionCustomization", async () => {
      const customization = new VersionedQuestionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "versionedQuestionCustomizations",
        1,
        "VersionedQuestionCustomization.delete"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedQuestionCustomization({
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Versioned question customization has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new VersionedQuestionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        questionCustomizationId: 200,
        versionedQuestionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove the versioned question customization");
    });
  });

  describe("findById", () => {
    it("should find VersionedQuestionCustomization by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
          guidanceText: "Test guidance",
        },
      ]);

      const result = await VersionedQuestionCustomization.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedQuestionCustomizations WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedQuestionCustomization);
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedQuestionCustomization.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedQuestionCustomization.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedQuestionCustomizations WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByVersionedCustomizationAndVersionedQuestion", () => {
    it("should find VersionedQuestionCustomization by versionedTemplateCustomizationId and versionedQuestionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          questionCustomizationId: 200,
          versionedQuestionId: 300,
        },
      ]);

      const result = await VersionedQuestionCustomization.findByVersionedCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedQuestionCustomizations
         WHERE versionedTemplateCustomizationId = ? AND versionedQuestionId = ?`,
        ["100", "300"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedQuestionCustomization);
      expect(result.versionedTemplateCustomizationId).toBe(100);
      expect(result.versionedQuestionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedQuestionCustomization.findByVersionedCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(result).toBeUndefined();
    });

    it("should handle null versionedQuestionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedQuestionCustomization.findByVersionedCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedQuestionCustomizations
         WHERE versionedTemplateCustomizationId = ? AND versionedQuestionId = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find VersionedQuestionCustomizations by versionedTemplateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          versionedQuestionId: 300,
        },
      ]);

      const result = await VersionedQuestionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedQuestionCustomizations
         WHERE versionedTemplateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(VersionedQuestionCustomization);
      expect(result[0].versionedTemplateCustomizationId).toBe(100);
      expect(result[0].versionedQuestionId).toBe(300);
    });

    it("should return an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedQuestionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
