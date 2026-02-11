import { MyContext } from "../../context";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus
} from "../../models/TemplateCustomization";
import {
  handleFunderTemplateRepublication,
  handleFunderTemplateArchive
} from "../templateCustomizationService";

jest.mock("../../models/TemplateCustomization");

describe("templateCustomizationService", () => {
  describe("handleFunderTemplateRepublication", () => {
    const mockContext = {} as MyContext;
    const reference = "test-reference";
    const oldVersionedTemplateId = 1;
    const newVersionedTemplateId = 2;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should call handleFunderTemplateArchive when newVersionedTemplateId is undefined", async () => {
      const mockCustomizations: TemplateCustomization[] = [];
      (TemplateCustomization.findByTemplateId as jest.Mock).mockResolvedValue(mockCustomizations);

      const result = await handleFunderTemplateRepublication(
        reference,
        mockContext,
        oldVersionedTemplateId,
        undefined
      );

      expect(TemplateCustomization.findByTemplateId).toHaveBeenCalledWith(
        reference,
        mockContext,
        oldVersionedTemplateId
      );
      expect(result).toBe(0);
    });

    it("should return 0 when no customizations are found", async () => {
      (TemplateCustomization.findByVersionedTemplateId as jest.Mock).mockResolvedValue([]);

      const result = await handleFunderTemplateRepublication(
        reference,
        mockContext,
        oldVersionedTemplateId,
        newVersionedTemplateId
      );

      expect(TemplateCustomization.findByVersionedTemplateId).toHaveBeenCalledWith(
        reference,
        mockContext,
        oldVersionedTemplateId
      );
      expect(result).toBe(0);
    });

    it("should mark customizations as STALE and return count when customizations are found", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockCustomizations = [
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate }
      ] as unknown as TemplateCustomization[];

      (TemplateCustomization.findByVersionedTemplateId as jest.Mock).mockResolvedValue(mockCustomizations);

      const result = await handleFunderTemplateRepublication(
        reference,
        mockContext,
        oldVersionedTemplateId,
        newVersionedTemplateId
      );

      expect(TemplateCustomization.findByVersionedTemplateId).toHaveBeenCalledWith(
        reference,
        mockContext,
        oldVersionedTemplateId
      );
      expect(mockCustomizations[0].migrationStatus).toBe(TemplateCustomizationMigrationStatus.STALE);
      expect(mockCustomizations[1].migrationStatus).toBe(TemplateCustomizationMigrationStatus.STALE);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith(mockContext, true);
      expect(result).toBe(2);
    });
  });

  describe("handleFunderTemplateArchive", () => {
    const mockContext = {} as MyContext;
    const reference = "test-reference";
    const templateId = 1;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return 0 when no customizations are found", async () => {
      (TemplateCustomization.findByTemplateId as jest.Mock).mockResolvedValue([]);

      const result = await handleFunderTemplateArchive(
        reference,
        mockContext,
        templateId
      );

      expect(TemplateCustomization.findByTemplateId).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateId
      );
      expect(result).toBe(0);
    });

    it("should mark customizations as ORPHANED and return count when customizations are found", async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockCustomizations = [
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.STALE, update: mockUpdate }
      ] as unknown as TemplateCustomization[];

      (TemplateCustomization.findByTemplateId as jest.Mock).mockResolvedValue(mockCustomizations);

      const result = await handleFunderTemplateArchive(
        reference,
        mockContext,
        templateId
      );

      expect(TemplateCustomization.findByTemplateId).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateId
      );
      expect(mockCustomizations[0].migrationStatus).toBe(TemplateCustomizationMigrationStatus.ORPHANED);
      expect(mockCustomizations[1].migrationStatus).toBe(TemplateCustomizationMigrationStatus.ORPHANED);
      expect(mockCustomizations[2].migrationStatus).toBe(TemplateCustomizationMigrationStatus.ORPHANED);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenCalledWith(mockContext, true);
      expect(result).toBe(3);
    });
  });
});
