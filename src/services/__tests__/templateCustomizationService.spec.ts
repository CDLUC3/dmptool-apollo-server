/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import type { MyContext } from "../../context.js";

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
} = await import("../../models/TemplateCustomization.js");
const {
  handleFunderTemplateRepublication,
  handleFunderTemplateArchive,
  markTemplateCustomizationAsDirty,
  getValidatedCustomization
} = await import("../templateCustomizationService.js");
const { ForbiddenError, NotFoundError } = await import("../../utils/graphQLErrors.js");
const { User, UserRole } = await import("../../models/User.js");

// ---------------------------------------------------------------------------
// Cast helpers: jest.spyOn ties itself to TemplateCustomization's real
// method signatures, so plain-object fixtures need casting at the point
// they're handed to a spied static method — never at their own declaration.
// ---------------------------------------------------------------------------
type TemplateCustomizationInstance = InstanceType<typeof TemplateCustomization>;
function asTemplateCustomization(value: any): TemplateCustomizationInstance {
  return value as TemplateCustomizationInstance;
}
function asTemplateCustomizationList(value: any[]): TemplateCustomizationInstance[] {
  return value as TemplateCustomizationInstance[];
}

describe("templateCustomizationService", () => {
  describe('getValidatedCustomization helper', () => {
    let user: InstanceType<typeof User>;
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

      jest.spyOn(user, 'getEmail').mockResolvedValue(casual.email);

      mockContext = await buildMockContextWithToken(logger, user);
    });

    it("should return customization when found and user has permission", async () => {
      const mockCustomization = {
        id: templateCustomizationId,
        templateId: 1,
        affiliationId: user.affiliationId
      };

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(asTemplateCustomization(mockCustomization));

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
      expect(result).toEqual(mockCustomization);
    });

    it("should throw NotFoundError when customization is not found", async () => {
      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(null);

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
      };

      jest.spyOn(TemplateCustomization, 'findById').mockResolvedValue(asTemplateCustomization(mockCustomization));

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
      jest.spyOn(TemplateCustomization, 'findByTemplateId').mockResolvedValue([]);

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
      jest.spyOn(TemplateCustomization, 'findByVersionedTemplateId').mockResolvedValue([]);

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
      const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);
      const mockCustomizations = asTemplateCustomizationList([
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate }
      ]);

      jest.spyOn(TemplateCustomization, 'findByVersionedTemplateId').mockResolvedValue(mockCustomizations);

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
      jest.spyOn(TemplateCustomization, 'findByTemplateId').mockResolvedValue([]);

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
      const mockUpdate = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);
      const mockCustomizations = asTemplateCustomizationList([
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.OK, update: mockUpdate },
        { migrationStatus: TemplateCustomizationMigrationStatus.STALE, update: mockUpdate }
      ]);

      jest.spyOn(TemplateCustomization, 'findByTemplateId').mockResolvedValue(mockCustomizations);

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
      const mockEntity = {} as any;
      jest.spyOn(TemplateCustomization, 'markAsDirty').mockResolvedValue(true);

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
      const mockEntity = {} as any;
      jest.spyOn(TemplateCustomization, 'markAsDirty').mockResolvedValue(false);

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
        { templateCustomizationId },
        `Unable to update TemplateCustomization timestamp`
      );
    });

    it("should log error and add error to entity when marking fails and entity supports addError", async () => {
      const mockAddError = jest.fn();
      const mockEntity = { addError: mockAddError } as any;
      jest.spyOn(TemplateCustomization, 'markAsDirty').mockResolvedValue(false);

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
        { templateCustomizationId },
        `Unable to update TemplateCustomization timestamp`
      );
      expect(mockAddError).toHaveBeenCalledWith(
        'general',
        `Unable to update TemplateCustomization timestamp`
      );
    });
  });
});