import { MyContext } from "../../context";
import { SectionCustomization } from "../SectionCustomization";
import { MySqlModel } from "../MySqlModel";
import { TemplateCustomizationMigrationStatus } from "../TemplateCustomization";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("SectionCustomization", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a SectionCustomization with all properties", () => {
      const options = {
        id: 1,
        created: new Date(),
        createdById: 10,
        modified: new Date(),
        modifiedById: 20,
        errors: {},
        templateCustomizationId: 100,
        sectionId: 300,
        migrationStatus: "STALE",
        guidance: "Test guidance",
      };

      const customization = new SectionCustomization(options);

      expect(customization.id).toBe(1);
      expect(customization.templateCustomizationId).toBe(100);
      expect(customization.sectionId).toBe(300);
      expect(customization.migrationStatus).toBe("STALE");
      expect(customization.guidance).toBe("Test guidance");
    });

    it("should set default migrationStatus to OK when not provided", () => {
      const options = {
        id: 1,
        templateCustomizationId: 100,
        sectionId: 300,
      };

      const customization = new SectionCustomization(options);

      expect(customization.migrationStatus).toBe(TemplateCustomizationMigrationStatus.OK);
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when templateCustomizationId is null", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: null,
        sectionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
    });

    it("should add error when sectionId is null", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.sectionId).toBe("Section can't be blank");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: null,
        sectionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
      expect(customization.errors.sectionId).toBe("Section can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from guidance", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
        guidance: "  Test guidance  ",
      });
      customization.prepForSave();
      expect(customization.guidance).toBe("Test guidance");
    });
  });

  describe("create", () => {
    it("should create a new SectionCustomization when valid and does not exist", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "sectionCustomizations",
        customization,
        "SectionCustomization.create"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Section has already been customized");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: null,
        sectionId: 300,
      });

      const result = await customization.create(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing SectionCustomization when valid", async () => {
      const customization = new SectionCustomization({
        id: 1,
        templateCustomizationId: 100,
        sectionId: 300,
        guidance: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
          guidance: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "sectionCustomizations",
        customization,
        "SectionCustomization.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidance).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new SectionCustomization({
        id: 1,
        templateCustomizationId: 100,
        sectionId: 300,
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "sectionCustomizations",
        customization,
        "SectionCustomization.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Section customization has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new SectionCustomization({
        id: 1,
        templateCustomizationId: null,
        sectionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing SectionCustomization", async () => {
      const customization = new SectionCustomization({
        id: 1,
        templateCustomizationId: 100,
        sectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "sectionCustomizations",
        1,
        "SectionCustomization.delete"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new SectionCustomization({
        templateCustomizationId: 100,
        sectionId: 300,
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Section customization has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new SectionCustomization({
        id: 1,
        templateCustomizationId: 100,
        sectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove section customization");
    });
  });

  describe("findById", () => {
    it("should find SectionCustomization by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
          guidance: "Test guidance",
        },
      ]);

      const result = await SectionCustomization.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM sectionCustomizations WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(SectionCustomization);
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM sectionCustomizations WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationAndSection", () => {
    it("should find SectionCustomization by templateCustomizationId and sectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      const result = await SectionCustomization.findByCustomizationAndSection(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM sectionCustomizations
         WHERE templateCustomizationId = ? AND sectionId = ?`,
        ["100", "300"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(SectionCustomization);
      expect(result.templateCustomizationId).toBe(100);
      expect(result.sectionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndSection(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(result).toBeUndefined();
    });

    it("should handle null sectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndSection(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM sectionCustomizations
         WHERE templateCustomizationId = ? AND sectionId = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationAndVersionedSection", () => {
    it("should find SectionCustomization by templateCustomizationId and versionedSectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      const result = await SectionCustomization.findByCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        500
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT sc.* FROM sectionCustomizations sc
         INNER JOIN versionedSections vs ON sc.sectionId = vs.sectionId
         WHERE sc.templateCustomizationId = ? AND vs.id = ?`,
        ["100", "500"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(SectionCustomization);
      expect(result.templateCustomizationId).toBe(100);
      expect(result.sectionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        500
      );

      expect(result).toBeUndefined();
    });

    it("should handle null versionedSectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT sc.* FROM sectionCustomizations sc
         INNER JOIN versionedSections vs ON sc.sectionId = vs.sectionId
         WHERE sc.templateCustomizationId = ? AND vs.id = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationAndVersionedQuestion", () => {
    it("should find SectionCustomization by templateCustomizationId and versionedQuestionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      const result = await SectionCustomization.findByCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        600
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT sc.* FROM sectionCustomizations sc
         INNER JOIN versionedSections vs ON sc.sectionId = vs.sectionId
         INNER JOIN versionedQuestions vq ON vs.id = vq.versionedSectionId
         WHERE sc.templateCustomizationId = ? AND vq.id = ?`,
        ["100", "600"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(SectionCustomization);
      expect(result.templateCustomizationId).toBe(100);
      expect(result.sectionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        600
      );

      expect(result).toBeUndefined();
    });

    it("should handle null versionedQuestionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationAndVersionedQuestion(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT sc.* FROM sectionCustomizations sc
         INNER JOIN versionedSections vs ON sc.sectionId = vs.sectionId
         INNER JOIN versionedQuestions vq ON vs.id = vq.versionedSectionId
         WHERE sc.templateCustomizationId = ? AND vq.id = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find SectionCustomizations by templateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          sectionId: 300,
        },
      ]);

      const result = await SectionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM sectionCustomizations WHERE templateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(SectionCustomization);
      expect(result[0].templateCustomizationId).toBe(100);
      expect(result[0].sectionId).toBe(300);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await SectionCustomization.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
