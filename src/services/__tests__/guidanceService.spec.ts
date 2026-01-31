import * as guidanceService from "../guidanceService";
import { GuidanceGroup } from "../../models/GuidanceGroup";
import { VersionedGuidanceGroup } from "../../models/VersionedGuidanceGroup";
import { Guidance } from "../../models/Guidance";
import { VersionedGuidance } from "../../models/VersionedGuidance";
import { Plan } from "../../models/Plan";
import { User } from "../../models/User";
import { PlanGuidance } from "../../models/Guidance";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock("../../models/GuidanceGroup");
jest.mock("../../models/VersionedGuidanceGroup");
jest.mock("../../models/Guidance");
jest.mock("../../models/VersionedGuidance");
jest.mock("../../models/Plan");
jest.mock("../../models/User");
jest.mock("../../models/Affiliation");
jest.mock("../../models/VersionedTemplate");
jest.mock("../../models/VersionedSection");
jest.mock("../../models/VersionedQuestion");


describe("addPlanGuidanceAffiliation", () => {
  let context: any;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("should create a PlanGuidanceAffiliation and return true if successful", async () => {
    // Mock PlanGuidance.create to resolve to an object with no errors
    (PlanGuidance as any).mockImplementation(function () {
      return {
        create: jest.fn().mockResolvedValue({ hasErrors: () => false })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(true);
  });

  it("should return false if PlanGuidance.create returns an error", async () => {
    (PlanGuidance as any).mockImplementation(function () {
      return {
        create: jest.fn().mockResolvedValue({ hasErrors: () => true })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(false);
  });

  it("should return false and log if PlanGuidance.create throws", async () => {
    (PlanGuidance as any).mockImplementation(function () {
      return {
        create: jest.fn().mockRejectedValue(new Error("fail"))
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(false);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("hasPermissionOnGuidanceGroup", () => {
    let context: any;
  beforeEach(async() => {
    context = await buildMockContextWithToken(logger);
  })
  
  it("returns true if user is from the same org", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    const context = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(context as any, 1);
    expect(result).toBe(true);
  });

  it("returns true if user is super admin", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    const context = { token: { affiliationId: "def", role: "SUPER_ADMIN" } };
    jest.spyOn(guidanceService, "isSuperAdmin" as any).mockReturnValue(true);
    const result = await guidanceService.hasPermissionOnGuidanceGroup(context as any, 1);
    expect(result).toBe(true);
  });

  it("returns false if no group", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(null);
    const context = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(context as any, 1);
    expect(result).toBe(false);
  });

  it("returns false if not same org and not super admin", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    jest.spyOn(guidanceService, "isSuperAdmin" as any).mockReturnValue(false);
    const context = { token: { affiliationId: "def" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(context as any, 1);
    expect(result).toBe(false);
  });
});

describe("publishGuidanceGroup", () => {
  let context: any;
  let group: any;
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    group = { id: 1, bestPractice: true, optionalSubset: false, name: "g", description: "desc", update: jest.fn().mockResolvedValue({ hasErrors: () => false }) };
    (VersionedGuidanceGroup.findByGuidanceGroupId as jest.Mock).mockResolvedValue([{ version: 1 }]);
    (VersionedGuidanceGroup.deactivateAll as jest.Mock).mockResolvedValue(true);
    (Guidance.findByGuidanceGroupId as jest.Mock).mockResolvedValue([{ id: 1, tagId: 2, guidanceText: "txt" }]);
    (VersionedGuidance.prototype.create as jest.Mock) = jest.fn().mockResolvedValue({ hasErrors: () => false });
    (Guidance.prototype.constructor as any) = function (opts: any) { return opts; };
  });

  it("publishes a group and returns true", async () => {
    (VersionedGuidanceGroup.prototype.create as jest.Mock) = jest.fn().mockResolvedValue({ id: 2, hasErrors: () => false, update: jest.fn().mockResolvedValue({}) });
    const result = await guidanceService.publishGuidanceGroup(context, group);
    expect(result).toBe(true);
  });

  it("throws if group has no id", async () => {
    // Provide a minimal GuidanceGroup-like object missing the 'id' property
    const invalidGroup = {
      affiliationId: "",
      name: "",
      isDirty: false,
      bestPractice: false,
      optionalSubset: false,
      description: "",
      createdById: 0,
      modifiedById: 0,
      update: jest.fn(),
      // ...add any other required properties if needed by your GuidanceGroup type
    };
    await expect(guidanceService.publishGuidanceGroup(context, invalidGroup as any)).rejects.toThrow();
  });

  it("throws if versioned group creation fails", async () => {
    (VersionedGuidanceGroup.prototype.create as jest.Mock) = jest.fn().mockResolvedValue({ hasErrors: () => true });
    await expect(guidanceService.publishGuidanceGroup(context, group)).rejects.toThrow();
  });

  it("throws if not all guidance versioned", async () => {
    (VersionedGuidanceGroup.prototype.create as jest.Mock) = jest.fn().mockResolvedValue({ id: 2, hasErrors: () => false, update: jest.fn().mockResolvedValue({}) });
    (VersionedGuidance.prototype.create as jest.Mock) = jest.fn().mockResolvedValue({ hasErrors: () => true });
    await expect(guidanceService.publishGuidanceGroup(context, group)).rejects.toThrow();
  });
});

describe("unpublishGuidanceGroup", () => {
  let context: any;
  let group: any;
  beforeEach(async() => {
    context = await buildMockContextWithToken(logger);
    group = { id: 1 };
  });
  it("unpublishes a group and returns true", async () => {
    (VersionedGuidanceGroup.deactivateAll as jest.Mock).mockResolvedValue(true);
    const result = await guidanceService.unpublishGuidanceGroup(context, group);
    expect(result).toBe(true);
  });

  it("throws if group has no id", async () => {
    // Provide a minimal GuidanceGroup-like object missing the 'id' property
    const invalidGroup = {
      affiliationId: "",
      name: "",
      isDirty: false,
      bestPractice: false,
      optionalSubset: false,
      description: "",
      createdById: 0,
      modifiedById: 0,
      update: jest.fn(),
    };
    await expect(guidanceService.unpublishGuidanceGroup(context, invalidGroup as any)).rejects.toThrow();
  });

  it("throws if deactivateAll fails", async () => {
    (VersionedGuidanceGroup.deactivateAll as jest.Mock).mockResolvedValue(false);
    await expect(guidanceService.unpublishGuidanceGroup(context, group)).rejects.toThrow();
  });
});

describe("markGuidanceGroupAsDirty", () => {
    let context: any;
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });
  it("marks group as dirty if active version exists", async () => {
    const group = { isDirty: false, update: jest.fn().mockResolvedValue({}) };
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(group);
    (VersionedGuidanceGroup.findActiveByGuidanceGroupId as jest.Mock).mockResolvedValue(true);
    await guidanceService.markGuidanceGroupAsDirty(context, 1);
    expect(group.isDirty).toBe(true);
    expect(group.update).toHaveBeenCalled();
  });

  it("does nothing if no group", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(null);
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).resolves.toBeUndefined();
  });

  it("does nothing if no active version", async () => {
    const group = { isDirty: false, update: jest.fn().mockResolvedValue({}) };
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(group);
    (VersionedGuidanceGroup.findActiveByGuidanceGroupId as jest.Mock).mockResolvedValue(null);
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).resolves.toBeUndefined();
  });

  it("logs and throws on error", async () => {
    (GuidanceGroup.findById as jest.Mock).mockRejectedValue(new Error("fail"));
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).rejects.toThrow();
    expect(context.logger.error).toHaveBeenCalled();
  });
});

// Note: getGuidanceSourcesForPlan, getSectionTags, getSectionTagsMap are complex and would require more extensive mocks.
// Here is a minimal test for getSectionTags and getSectionTagsMap:

describe("getSectionTags", () => {
    let context: any;
  beforeEach(async() => {
    context = await buildMockContextWithToken(logger);
  });
  it("returns tags map", async () => {
    (PlanGuidance.query as jest.Mock).mockResolvedValue([{ id: 1, name: "tag1" }]);
    const result = await guidanceService.getSectionTags(context, 123);
    expect(result).toEqual({ 1: "tag1" });
  });

  it("returns empty object on error", async () => {
    (PlanGuidance.query as jest.Mock).mockRejectedValue(new Error("fail"));
    const result = await guidanceService.getSectionTags(context, 123);
    expect(result).toEqual({});
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getSectionTagsMap", () => {
  let context: any;
  beforeEach(async() => {
    context = await buildMockContextWithToken(logger);
  });
  it("returns tags map", async () => {
    (PlanGuidance.query as jest.Mock).mockResolvedValue([{ id: 2, name: "tag2" }]);
    const result = await guidanceService.getSectionTagsMap(context, 456);
    expect(result).toEqual({ 2: "tag2" });
  });

  it("returns empty object on error", async () => {
    (PlanGuidance.query as jest.Mock).mockRejectedValue(new Error("fail"));
    const result = await guidanceService.getSectionTagsMap(context, 456);
    expect(result).toEqual({});
    expect(context.logger.error).toHaveBeenCalled();
  });
});

// For getGuidanceSourcesForPlan, you would need to mock Plan, User, Affiliation, VersionedTemplate, VersionedGuidance, etc.
// Here's a minimal "smoke test" to ensure it runs and returns an array:

describe("getGuidanceSourcesForPlan", () => {
  let context: any;
  beforeEach(async() => {
    context = await buildMockContextWithToken(logger);
  });
  it("returns [] if plan not found", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(null);
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("returns [] if user not found", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue({ versionedTemplateId: 1 });
    (User.findById as jest.Mock).mockResolvedValue(null);
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("returns [] if tags are empty", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue({ versionedTemplateId: 1 });
    (User.findById as jest.Mock).mockResolvedValue({ affiliationId: "affil" });
    jest.spyOn(guidanceService, "getSectionTagsMap").mockResolvedValue({});
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });
});
