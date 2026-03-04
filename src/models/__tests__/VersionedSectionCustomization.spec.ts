import { MyContext } from "../../context";
import { VersionedSectionCustomization } from "../VersionedSectionCustomization";
import { MySqlModel } from "../MySqlModel";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("VersionedSectionCustomization", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should create a VersionedSectionCustomization with all properties", () => {
      const options = {
        id: 1,
        created: new Date(),
        createdById: 10,
        modified: new Date(),
        modifiedById: 20,
        errors: {},
        versionedTemplateCustomizationId: 100,
        versionedSectionId: 300,
        guidance: "Test guidance",
      };

      const customization = new VersionedSectionCustomization(options);

      expect(customization.id).toBe(1);
      expect(customization.versionedTemplateCustomizationId).toBe(100);
      expect(customization.versionedSectionId).toBe(300);
      expect(customization.guidance).toBe("Test guidance");
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when versionedTemplateCustomizationId is null", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: null,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });

    it("should add error when sectionCustomizationId is null", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: null,
        versionedSectionId: 300,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.sectionCustomizationId).toBe("Section customization can't be blank");
    });

    it("should add error when versionedSectionId is null", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedSectionId).toBe("Versioned section can't be blank");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: null,
        sectionCustomizationId: 200,
        versionedSectionId: null,
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
      expect(customization.errors.versionedSectionId).toBe("Versioned section can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from guidance", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
        guidance: "  Test guidance  ",
      });
      customization.prepForSave();
      expect(customization.guidance).toBe("Test guidance");
    });
  });

  describe("create", () => {
    it("should create a new VersionedSectionCustomization when valid and does not exist", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          sectionCustomizationId: 200,
          versionedSectionId: 300,
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "versionedSectionCustomizations",
        customization,
        "VersionedSectionCustomization.create"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          sectionCustomizationId: 200,
          versionedSectionId: 300,
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Versioned section has already been customized");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: null,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      const result = await customization.create(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing VersionedSectionCustomization when valid", async () => {
      const customization = new VersionedSectionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
        guidance: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          sectionCustomizationId: 200,
          versionedSectionId: 300,
          guidance: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedSectionCustomizations",
        customization,
        "VersionedSectionCustomization.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidance).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new VersionedSectionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          sectionCustomizationId: 200,
          versionedSectionId: 300,
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedSectionCustomizations",
        customization,
        "VersionedSectionCustomization.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Versioned customization has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedSectionCustomization({
        id: 1,
        versionedTemplateCustomizationId: null,
        versionedSectionId: 300,
      });

      const result = await customization.update(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing VersionedSectionCustomization", async () => {
      const customization = new VersionedSectionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        sectionCustomizationId: 200,
        versionedSectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          sectionCustomizationId: 200,
          versionedSectionId: 300,
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "versionedSectionCustomizations",
        1,
        "VersionedSectionCustomization.delete"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedSectionCustomization({
        versionedTemplateCustomizationId: 100,
        versionedSectionId: 300,
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Versioned customization has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new VersionedSectionCustomization({
        id: 1,
        versionedTemplateCustomizationId: 100,
        versionedSectionId: 300,
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          versionedSectionId: 300,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove the versioned section customization");
    });
  });

  describe("findById", () => {
    it("should find VersionedSectionCustomization by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          versionedSectionId: 300,
          guidance: "Test guidance",
        },
      ]);

      const result = await VersionedSectionCustomization.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedSectionCustomizations WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedSectionCustomization);
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedSectionCustomization.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedSectionCustomization.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedSectionCustomizations WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByVersionedCustomizationAndVersionedSection", () => {
    it("should find VersionedSectionCustomization by versionedTemplateCustomizationId and versionedSectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          versionedSectionId: 300,
        },
      ]);

      const result = await VersionedSectionCustomization.findByVersionedCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedSectionCustomizations
         WHERE versionedTemplateCustomizationId = ? AND versionedSectionId = ?`,
        ["100", "300"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedSectionCustomization);
      expect(result.versionedTemplateCustomizationId).toBe(100);
      expect(result.versionedSectionId).toBe(300);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedSectionCustomization.findByVersionedCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        300
      );

      expect(result).toBeUndefined();
    });

    it("should handle null versionedSectionId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedSectionCustomization.findByVersionedCustomizationAndVersionedSection(
        "test.ref",
        mockContext,
        100,
        null
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedSectionCustomizations
         WHERE versionedTemplateCustomizationId = ? AND versionedSectionId = ?`,
        ["100", undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByVersionedCustomizationId", () => {
    it("should find VersionedSectionCustomizations by versionedTemplateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          versionedSectionId: 300,
        },
      ]);

      const result = await VersionedSectionCustomization.findByVersionedCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedSectionCustomizations
         WHERE versionedTemplateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(VersionedSectionCustomization);
      expect(result[0].versionedTemplateCustomizationId).toBe(100);
      expect(result[0].versionedSectionId).toBe(300);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedSectionCustomization.findByVersionedCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
