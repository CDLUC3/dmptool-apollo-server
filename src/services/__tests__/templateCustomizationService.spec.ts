import { MyContext } from "../../context";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationStatus,
} from "../../models/TemplateCustomization";
import {
  handleFunderTemplateRepublication,
  handleFunderTemplateArchive,
  markTemplateCustomizationAsDirty,
  getValidatedCustomization
} from "../templateCustomizationService";
import { ForbiddenError, NotFoundError } from "../../utils/graphQLErrors";
import { User, UserRole } from "../../models/User";
import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock("../../models/TemplateCustomization");
jest.mock("../templateCustomizationService", () => ({
  ...jest.requireActual("../templateCustomizationService"),
  hasPermissionOnTemplateCustomization: jest.fn(),
}));

describe("templateCustomizationService", () => {
  describe('getValidatedCustomization helper', () => {
    let user: User;
    let mockContext = {} as MyContext;
    const reference = "test-reference";
    const templateCustomizationId = 1;

    beforeEach(async () => {
      jest.clearAllMocks();

      user = new User({
        id: casual.integer(1, 999),
        givenName: casual.first_name,
        surName: casual.last_name,
        role: UserRole.RESEARCHER,
        affiliationId: casual.url,
      });

      (user.getEmail as jest.Mock) = jest.fn().mockResolvedValue(casual.email);

      mockContext = await buildMockContextWithToken(logger, user);
    });

    it("should return customization when found and user has permission", async () => {
      const mockCustomization = {
        id: templateCustomizationId,
        templateId: 1,
        affiliationId: user.affiliationId
      } as TemplateCustomization;

      (TemplateCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);

      const result = await getValidatedCustomization(
        reference,
        mockContext,
        templateCustomizationId
      );

      expect(TemplateCustomization.findById).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
      expect(result).toBe(mockCustomization);
    });

    it("should throw NotFoundError when customization is not found", async () => {
      (TemplateCustomization.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        getValidatedCustomization(reference, mockContext, templateCustomizationId)
      ).rejects.toThrow(NotFoundError());

      expect(TemplateCustomization.findById).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
    });

    it("should throw ForbiddenError when user lacks permission", async () => {
      const mockCustomization = {
        id: templateCustomizationId,
        templateId: 1,
        affiliationId: "different-affiliation"
      } as TemplateCustomization;

      (TemplateCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);

      await expect(
        getValidatedCustomization(reference, mockContext, templateCustomizationId)
      ).rejects.toThrow(ForbiddenError());

      expect(TemplateCustomization.findById).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
    });
  });

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

  describe("markTemplateCustomizationAsDirty", () => {
    const mockContext = {
      logger: {
        error: jest.fn()
      }
    } as unknown as MyContext;
    const reference = "test-reference";
    const templateCustomizationId = 1;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should successfully mark template customization as dirty", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockEntity = {} as any;
      (TemplateCustomization.markAsDirty as jest.Mock).mockResolvedValue(true);

      await markTemplateCustomizationAsDirty(
        reference,
        mockContext,
        templateCustomizationId,
        mockEntity
      );

      expect(TemplateCustomization.markAsDirty).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
      expect(mockContext.logger.error).not.toHaveBeenCalled();
    });

    it("should log error when marking fails and entity does not support addError", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockEntity = {} as any;
      (TemplateCustomization.markAsDirty as jest.Mock).mockResolvedValue(false);

      await markTemplateCustomizationAsDirty(
        reference,
        mockContext,
        templateCustomizationId,
        mockEntity
      );

      expect(TemplateCustomization.markAsDirty).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        {templateCustomizationId},
        `Unable to update TemplateCustomization timestamp`
      );
    });

    it("should log error and add error to entity when marking fails and entity supports addError", async () => {
      const mockAddError = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockEntity = { addError: mockAddError } as any;
      (TemplateCustomization.markAsDirty as jest.Mock).mockResolvedValue(false);

      await markTemplateCustomizationAsDirty(
        reference,
        mockContext,
        templateCustomizationId,
        mockEntity
      );

      expect(TemplateCustomization.markAsDirty).toHaveBeenCalledWith(
        reference,
        mockContext,
        templateCustomizationId
      );
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        {templateCustomizationId},
        `Unable to update TemplateCustomization timestamp`
      );
      expect(mockAddError).toHaveBeenCalledWith(
        'general',
        `Unable to update TemplateCustomization timestamp`
      );
    });
  });
});
