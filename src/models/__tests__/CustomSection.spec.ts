import {MyContext} from "../../context";
import {CustomSection, PinnedSectionTypeEnum} from "../CustomSection";
import {MySqlModel} from "../MySqlModel";
import {TemplateCustomizationMigrationStatus} from "../TemplateCustomization";

jest.mock("../MySqlModel", () => ({
  ...jest.requireActual("../MySqlModel"),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe("CustomSection", () => {
  let mockContext: MyContext;

  beforeEach(() => {
    mockContext = {} as MyContext;
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a CustomSection with all properties", () => {
      const options: CustomSection = new CustomSection({
        id: 1,
        created: new Date().toISOString(),
        createdById: 10,
        modified: new Date().toISOString(),
        modifiedById: 20,
        errors: {},
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        migrationStatus: TemplateCustomizationMigrationStatus.STALE,
        name: "Test Section",
        introduction: "Test introduction",
        requirements: "Test requirements",
        guidance: "Test guidance",
      });

      const customization = new CustomSection(options);

      expect(customization.id).toBe(1);
      expect(customization.templateCustomizationId).toBe(100);
      expect(customization.pinnedSectionType).toBe("CUSTOM");
      expect(customization.pinnedSectionId).toBe(200);
      expect(customization.migrationStatus).toBe("STALE");
      expect(customization.name).toBe("Test Section");
      expect(customization.introduction).toBe("Test introduction");
      expect(customization.requirements).toBe("Test requirements");
      expect(customization.guidance).toBe("Test guidance");
    });

    it("should set default migrationStatus to OK when not provided", () => {
      const options = {
        id: 1,
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200
      };

      const customization = new CustomSection(options);

      expect(customization.migrationStatus).toBe(TemplateCustomizationMigrationStatus.OK);
    });
  });

  describe("isValid", () => {
    it("should return true when all required fields are present", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
        name: "Test Section",
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(true);
      expect(Object.keys(customization.errors).length).toBe(0);
    });

    it("should add error when templateCustomizationId is null", async () => {
      const customization = new CustomSection({
        templateCustomizationId: null,
        name: "Test Section"
      });

      const isValid = await customization.isValid();

      expect(isValid).toBe(false);
      expect(customization.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("prepareForSave", () => {
    it("should trim leading/trailing spaces from fields", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
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
    it("should create a new CustomSection when valid and does not exist", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);
      const mockInsert = jest.spyOn(MySqlModel, "insert").mockResolvedValue(1);
      jest.spyOn(MySqlModel, "query").mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(mockInsert).toHaveBeenCalledWith(
        mockContext,
        "customSections",
        customization,
        "CustomSection.create"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when customization already exists", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
        guidance: "Test guidance",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await customization.create(mockContext);

      expect(result.errors.general).toBe("Custom section already exists");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new CustomSection({
        templateCustomizationId: null,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
        guidance: "Test guidance",
      });

      const result = await customization.create(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("update", () => {
    it("should update an existing CustomSection when valid", async () => {
      const customization = new CustomSection({
        id: 1,
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
        guidance: "Updated guidance",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
          guidance: "Updated guidance",
        },
      ]);

      const result = await customization.update(mockContext);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "customSections",
        customization,
        "CustomSection.update",
        [],
        false
      );
      expect(result.id).toBe(1);
      expect(result.guidance).toBe("Updated guidance");
    });

    it("should pass noTouch parameter correctly", async () => {
      const customization = new CustomSection({
        id: 1,
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      const mockUpdate = jest.spyOn(MySqlModel, "update").mockResolvedValue(undefined);
      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
        },
      ]);

      await customization.update(mockContext, true);

      expect(mockUpdate).toHaveBeenCalledWith(
        mockContext,
        "customSections",
        customization,
        "CustomSection.update",
        [],
        true
      );
    });

    it("should add error when id is not set", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.general).toBe("Custom section has never been saved");
    });

    it("should return customization with errors when invalid", async () => {
      const customization = new CustomSection({
        id: 1,
        templateCustomizationId: null,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      const result = await customization.update(mockContext);

      expect(result.errors.templateCustomizationId).toBe("Customization can't be blank");
    });
  });

  describe("delete", () => {
    it("should delete an existing CustomSection", async () => {
      const customization = new CustomSection({
        id: 1,
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
        },
      ]);
      const mockDelete = jest.spyOn(MySqlModel, "delete").mockResolvedValue(true);

      const result = await customization.delete(mockContext);

      expect(mockDelete).toHaveBeenCalledWith(
        mockContext,
        "customSections",
        1,
        "CustomSection.delete"
      );
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should add error when id is not set", async () => {
      const customization = new CustomSection({
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Custom section has never been saved");
    });

    it("should add error when delete fails", async () => {
      const customization = new CustomSection({
        id: 1,
        templateCustomizationId: 100,
        pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
        pinnedSectionId: 200,
        name: "Test Section",
      });

      jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
        },
      ]);
      jest.spyOn(MySqlModel, "delete").mockResolvedValue(false);

      const result = await customization.delete(mockContext);

      expect(result.errors.general).toBe("Failed to remove the custom section");
    });
  });

  describe("findById", () => {
    it("should find CustomSection by id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
          name: "Test Section",
          guidance: "Test guidance",
        },
      ]);

      const result = await CustomSection.findById("test.ref", mockContext, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM customSections WHERE id = ?",
        ["1"],
        "test.ref"
      );
      expect(result).toBeInstanceOf(CustomSection);
      expect(result.id).toBe(1);
      expect(result.templateCustomizationId).toBe(100);
    });

    it("should return undefined when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomSection.findById("test.ref", mockContext, 999);

      expect(result).toBeUndefined();
    });

    it("should handle null id", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomSection.findById("test.ref", mockContext, null);

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        "SELECT * FROM customSections WHERE id = ?",
        [undefined],
        "test.ref"
      );
      expect(result).toBeUndefined();
    });
  });

  describe("findByCustomizationId", () => {
    it("should find CustomSections by templateCustomizationId", async () => {
      const mockQuery = jest.spyOn(MySqlModel, "query").mockResolvedValue([
        {
          id: 1,
          templateCustomizationId: 100,
          pinnedSectionType: PinnedSectionTypeEnum.CUSTOM,
          pinnedSectionId: 200,
        },
      ]);

      const result = await CustomSection.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(mockQuery).toHaveBeenCalledWith(
        mockContext,
        `SELECT * FROM customSections WHERE templateCustomizationId = ?`,
        ["100"],
        "test.ref"
      );

      expect(result.length).toBe(1);
      expect(result[0]).toBeInstanceOf(CustomSection);
      expect(result[0].templateCustomizationId).toBe(100);
      expect(result[0].pinnedSectionId).toBe(200);
    });

    it("should return be an empty array when not found", async () => {
      jest.spyOn(MySqlModel, "query").mockResolvedValue([]);

      const result = await CustomSection.findByCustomizationId(
        "test.ref",
        mockContext,
        100
      );

      expect(result).toEqual([]);
    });
  });
});
