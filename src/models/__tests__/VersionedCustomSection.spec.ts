import { MyContext } from "../../context";
import { PinnedSectionTypeEnum } from "../CustomSection";
import { VersionedCustomSection } from "../VersionedCustomSection";
import { MySqlModel } from "../MySqlModel";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("VersionedCustomSection", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a VersionedCustomSection with all properties", () => {
      const options: VersionedCustomSection = new VersionedCustomSection({
        id: 1,
        created: new Date().toISOString(),
        createdById: 10,
        modified: new Date().toISOString(),
        modifiedById: 20,
        errors: {},
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
        introduction: "Test introduction",
        requirements: "Test requirements",
        guidance: "Test guidance",
      });

      const customization = new VersionedCustomSection(options);

      expect(customization.id).toBe(1);
      expect(customization.versionedTemplateCustomizationId).toBe(100);
      expect(customization.customSectionId).toBe(200);
      expect(customization.pinnedVersionedSectionType).toBe("CUSTOM");
      expect(customization.pinnedVersionedSectionId).toBe(300);
      expect(customization.name).toBe("Test Section");
      expect(customization.introduction).toBe("Test introduction");
      expect(customization.requirements).toBe("Test requirements");
      expect(customization.guidance).toBe("Test guidance");
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        name: "Test Section",
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when versionedTemplateCustomizationId is null", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: null,
        customSectionId: 200,
        name: "Test Section"
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });

    it("should add error when customSectionId is null", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: null,
        name: "Test Section"
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.customSectionId).toBe("Section customization can't be blank");
    });

    it("should add error when name is undefined", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        name: null
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.name).toBe("Name can't be blank");
    });

    it("should add multiple errors when multiple fields are missing", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: null,
        customSectionId: 200,
        name: null
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
      expect(customization.errors.name).toBe("Name can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from fields", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        name: "  Test Section    ",
        introduction: "  Test introduction  ",
        requirements: "  Test requirements  ",
        guidance: "  Test guidance  ",
      });
      customization.prepForSave();
      expect(customization.name).toBe("Test Section");
      expect(customization.introduction).toBe("Test introduction");
      expect(customization.requirements).toBe("Test requirements");
      expect(customization.guidance).toBe("Test guidance");
    });
  });

  describe("create", () => {
    it("should create a new VersionedCustomSection when valid and does not exist", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomSections",
        customization,
        "VersionedCustomSection.create"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Custom section version already exists");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: null,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
        guidance: "Test guidance",
      });

      const result = await customization.create(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing VersionedCustomSection when valid", async () => {
      const customization = new VersionedCustomSection({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
        guidance: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
          guidance: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomSections",
        customization,
        "VersionedCustomSection.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidance).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new VersionedCustomSection({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomSections",
        customization,
        "VersionedCustomSection.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Custom section version has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new VersionedCustomSection({
        id: 1,
        versionedTemplateCustomizationId: null,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.versionedTemplateCustomizationId).toBe("Versioned customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing VersionedCustomSection", async () => {
      const customization = new VersionedCustomSection({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "versionedCustomSections",
        1,
        "VersionedCustomSection.delete"
      );
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new VersionedCustomSection({
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Custom section has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new VersionedCustomSection({
        id: 1,
        versionedTemplateCustomizationId: 100,
        customSectionId: 200,
        pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedVersionedSectionId: 300,
        name: "Test Section",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
        customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove the custom section version");
    });
  });

  describe("findById", () => {
    it("should find VersionedCustomSection by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await VersionedCustomSection.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedCustomSections WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(VersionedCustomSection);
      expect(result.id).toBe(1);
      expect(result.versionedTemplateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomSection.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomSection.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM versionedCustomSections WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find VersionedCustomSections by versionedTemplateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          versionedTemplateCustomizationId: 100,
          customSectionId: 200,
          pinnedVersionedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedVersionedSectionId: 300,
        },
      ]);

      const result = await VersionedCustomSection.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM versionedCustomSections
         WHERE versionedTemplateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(VersionedCustomSection);
      expect(result[0].versionedTemplateCustomizationId).toBe(100);
      expect(result[0].pinnedVersionedSectionId).toBe(300);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await VersionedCustomSection.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
