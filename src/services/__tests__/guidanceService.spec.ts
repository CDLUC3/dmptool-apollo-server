import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';
import {
  mockPlan,
  mockVersionedTemplate,
  mockUserSelections,
  mockBestPracticeGuidance,
  mockAffiliationCDL,
  mockAffiliationNSF,
  mockAffiliationNIH,
  mockTagBasedGuidanceCDL,
  mockTagBasedGuidanceNSF,
  mockTagBasedGuidanceNIH,
} from "../__mocks__/mockGuidanceData.js";

mockAppConfigs();
mockAppLogger();

// NOTE: guidanceService.js is the module UNDER TEST in this file — it must
// NOT be mocked. (An earlier draft of this conversion mistakenly copied a
// mock for it over from a different spec file that uses guidanceService as
// a dependency; that block is intentionally absent here.)

// --- authService.js ---
const mockIsSuperAdmin = jest.fn<(...args: any[]) => boolean>();

jest.unstable_mockModule('../authService.js', () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

// --- models/GuidanceGroup.js ---
const mockGuidanceGroupFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/GuidanceGroup.js', () => ({
  GuidanceGroup: {
    findById: mockGuidanceGroupFindById,
  },
}));

// --- models/VersionedGuidanceGroup.js ---
// The constructor itself is reconfigured per-test via .mockImplementation(),
// so it's declared as a module-scope const (not built anonymously inside the
// factory) — that's what lets test bodies call
// VersionedGuidanceGroupCtor.mockImplementation(...) directly, fully typed,
// with no cast needed.
const mockVersionedGuidanceGroupFindByGuidanceGroupId = jest.fn<(...args: any[]) => Promise<any>>();
const mockVersionedGuidanceGroupFindActiveByGuidanceGroupId = jest.fn<(...args: any[]) => Promise<any>>();
const mockVersionedGuidanceGroupDeactivateAll = jest.fn<(...args: any[]) => Promise<any>>();

const VersionedGuidanceGroupCtor: any = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
  create: jest.fn<(...args: any[]) => Promise<any>>(),
  update: jest.fn<(...args: any[]) => Promise<any>>(),
  hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
  ...data,
}));
VersionedGuidanceGroupCtor.findByGuidanceGroupId = mockVersionedGuidanceGroupFindByGuidanceGroupId;
VersionedGuidanceGroupCtor.findActiveByGuidanceGroupId = mockVersionedGuidanceGroupFindActiveByGuidanceGroupId;
VersionedGuidanceGroupCtor.deactivateAll = mockVersionedGuidanceGroupDeactivateAll;

jest.unstable_mockModule('../../models/VersionedGuidanceGroup.js', () => ({
  VersionedGuidanceGroup: VersionedGuidanceGroupCtor,
}));

// --- models/Guidance.js (exports both Guidance and PlanGuidance) ---
// PlanGuidance's constructor is also reconfigured per-test, same reasoning.
const mockGuidanceFindByGuidanceGroupId = jest.fn<(...args: any[]) => Promise<any>>();
const mockPlanGuidanceQuery = jest.fn<(...args: any[]) => Promise<any>>();
const mockPlanGuidanceFindByPlanAndUserId = jest.fn<(...args: any[]) => Promise<any>>();

const GuidanceCtor: any = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
  ...data,
}));
GuidanceCtor.findByGuidanceGroupId = mockGuidanceFindByGuidanceGroupId;

const PlanGuidanceCtor: any = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
  create: jest.fn<(...args: any[]) => Promise<any>>(),
  ...data,
}));
PlanGuidanceCtor.query = mockPlanGuidanceQuery;
PlanGuidanceCtor.findByPlanAndUserId = mockPlanGuidanceFindByPlanAndUserId;

jest.unstable_mockModule('../../models/Guidance.js', () => ({
  Guidance: GuidanceCtor,
  PlanGuidance: PlanGuidanceCtor,
}));

// --- models/VersionedGuidance.js ---
const mockVersionedGuidanceFindBestPracticeByTagIds = jest.fn<(...args: any[]) => Promise<any>>();
const mockVersionedGuidanceFindByAffiliationAndTagIds = jest.fn<(...args: any[]) => Promise<any>>();

const VersionedGuidanceCtor: any = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
  create: jest.fn<(...args: any[]) => Promise<any>>(),
  hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
  ...data,
}));
VersionedGuidanceCtor.findBestPracticeByTagIds = mockVersionedGuidanceFindBestPracticeByTagIds;
VersionedGuidanceCtor.findByAffiliationAndTagIds = mockVersionedGuidanceFindByAffiliationAndTagIds;

jest.unstable_mockModule('../../models/VersionedGuidance.js', () => ({
  VersionedGuidance: VersionedGuidanceCtor,
}));

// --- models/Plan.js ---
const mockPlanFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/Plan.js', () => ({
  Plan: { findById: mockPlanFindById },
}));

// --- models/VersionedTemplate.js ---
const mockVersionedTemplateFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedTemplate.js', () => ({
  VersionedTemplate: { findById: mockVersionedTemplateFindById },
}));

// --- models/VersionedSection.js ---
const mockVersionedSectionFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedSection.js', () => ({
  VersionedSection: { findById: mockVersionedSectionFindById },
}));

// --- models/VersionedQuestion.js ---
const mockVersionedQuestionFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedQuestion.js', () => ({
  VersionedQuestion: { findById: mockVersionedQuestionFindById },
}));

// --- models/VersionedSectionCustomization.js ---
const mockVersionedSectionCustomizationFindActive = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedSectionCustomization.js', () => ({
  VersionedSectionCustomization: {
    findActiveByTemplateAffiliationAndSection: mockVersionedSectionCustomizationFindActive,
  },
}));

// --- models/VersionedQuestionCustomization.js ---
const mockVersionedQuestionCustomizationFindActive = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedQuestionCustomization.js', () => ({
  VersionedQuestionCustomization: {
    findActiveByTemplateAffiliationAndQuestion: mockVersionedQuestionCustomizationFindActive,
  },
}));

// --- models/VersionedCustomSection.js ---
const mockVersionedCustomSectionFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedCustomSection.js', () => ({
  VersionedCustomSection: { findById: mockVersionedCustomSectionFindById },
}));

// --- models/VersionedCustomQuestion.js ---
const mockVersionedCustomQuestionFindById = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/VersionedCustomQuestion.js', () => ({
  VersionedCustomQuestion: { findById: mockVersionedCustomQuestionFindById },
}));

// --- models/Affiliation.js ---
const mockAffiliationFindByURI = jest.fn<(...args: any[]) => Promise<any>>();
const mockAffiliationQuery = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('../../models/Affiliation.js', () => ({
  Affiliation: {
    findByURI: mockAffiliationFindByURI,
    query: mockAffiliationQuery,
  },
}));

import type { MyContext } from "../../context.js";

// ---------------------------------------------------------------------------
// Everything below is dynamic, registered after every mock above.
// guidanceService.js itself is the module under test — imported for real.
// ---------------------------------------------------------------------------
const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const guidanceService = await import('../guidanceService.js');
const { GuidanceGroup } = await import("../../models/GuidanceGroup.js");

// Type for mock GuidanceGroup used in tests
type MockGuidanceGroup = Partial<InstanceType<typeof GuidanceGroup>> & {
  update?: jest.Mock;
};

let context: MyContext;
let group: MockGuidanceGroup;

describe("addPlanGuidance", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("should create a PlanGuidance and return true if successful", async () => {
    PlanGuidanceCtor.mockImplementation(function () {
      return {
        create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => false })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(true);
  });

  it("should return false if PlanGuidance.create returns an error", async () => {
    PlanGuidanceCtor.mockImplementation(function () {
      return {
        create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => true })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(false);
  });

  it("should return false and log if PlanGuidance.create throws", async () => {
    PlanGuidanceCtor.mockImplementation(function () {
      return {
        create: jest.fn<(...args: any[]) => Promise<any>>().mockRejectedValue(new Error("fail"))
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(false);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("hasPermissionOnGuidanceGroup", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("returns true if user is from the same org", async () => {
    mockGuidanceGroupFindById.mockResolvedValue({ affiliationId: "abc" });
    const localContext = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(true);
  });

  it("returns true if user is super admin", async () => {
    mockGuidanceGroupFindById.mockResolvedValue({ affiliationId: "abc" });
    mockIsSuperAdmin.mockReturnValue(true);
    const localContext = { token: { affiliationId: "def", role: "SUPER_ADMIN" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(true);
  });

  it("returns false if no group", async () => {
    mockGuidanceGroupFindById.mockResolvedValue(null);
    const localContext = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(false);
  });

  it("returns false if not same org and not super admin", async () => {
    mockGuidanceGroupFindById.mockResolvedValue({ affiliationId: "abc" });
    mockIsSuperAdmin.mockReturnValue(false);
    const localContext = { token: { affiliationId: "def" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(false);
  });
});

describe("publishGuidanceGroup", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();

    group = {
      id: 1,
      bestPractice: true,
      optionalSubset: false,
      name: "g",
      description: "desc",
      update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => false })
    };

    VersionedGuidanceGroupCtor.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        id: 2,
        active: true,
        hasErrors: () => false,
        update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => false }),
      }),
      hasErrors: () => false,
      update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => false }),
    }));

    mockVersionedGuidanceGroupFindByGuidanceGroupId.mockResolvedValue([{ version: 1 }]);
    mockVersionedGuidanceGroupDeactivateAll.mockResolvedValue(true);
    mockGuidanceFindByGuidanceGroupId.mockResolvedValue([{ id: 1, tagId: 2, guidanceText: "txt" }]);

    VersionedGuidanceCtor.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => false }),
      hasErrors: () => false,
    }));
  });

  it("publishes a group and returns true", async () => {
    const result = await guidanceService.publishGuidanceGroup(context, group as InstanceType<typeof GuidanceGroup>);
    expect(result).toBe(true);
  });

  it("throws if group has no id", async () => {
    const invalidGroup: MockGuidanceGroup = {
      affiliationId: "",
      name: "",
      isDirty: false,
      bestPractice: false,
      optionalSubset: false,
      description: "",
      createdById: 0,
      modifiedById: 0,
      update: jest.fn<(...args: any[]) => Promise<any>>(),
    };

    await expect(
      guidanceService.publishGuidanceGroup(context, invalidGroup as InstanceType<typeof GuidanceGroup>)
    ).rejects.toThrow();
  });

  it("throws if versioned group creation fails", async () => {
    VersionedGuidanceGroupCtor.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => true }),
      hasErrors: () => true,
    }));

    await expect(
      guidanceService.publishGuidanceGroup(context, group as InstanceType<typeof GuidanceGroup>)
    ).rejects.toThrow();
  });

  it("throws if not all guidance versioned", async () => {
    VersionedGuidanceGroupCtor.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ hasErrors: () => true }),
      hasErrors: () => true,
    }));

    await expect(
      guidanceService.publishGuidanceGroup(context, group as InstanceType<typeof GuidanceGroup>)
    ).rejects.toThrow();
  });
});

describe("unpublishGuidanceGroup", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
    group = { id: 1 };
  });

  it("unpublishes a group and returns true", async () => {
    mockVersionedGuidanceGroupDeactivateAll.mockResolvedValue(true);
    const result = await guidanceService.unpublishGuidanceGroup(context, group as InstanceType<typeof GuidanceGroup>);
    expect(result).toBe(true);
  });

  it("throws if group has no id", async () => {
    const invalidGroup: MockGuidanceGroup = {
      affiliationId: "",
      name: "",
      isDirty: false,
      bestPractice: false,
      optionalSubset: false,
      description: "",
      createdById: 0,
      modifiedById: 0,
      update: jest.fn<(...args: any[]) => Promise<any>>(),
    };

    await expect(
      guidanceService.unpublishGuidanceGroup(context, invalidGroup as InstanceType<typeof GuidanceGroup>)
    ).rejects.toThrow();
  });

  it("throws if deactivateAll fails", async () => {
    mockVersionedGuidanceGroupDeactivateAll.mockResolvedValue(false);
    await expect(
      guidanceService.unpublishGuidanceGroup(context, group as InstanceType<typeof GuidanceGroup>)
    ).rejects.toThrow();
  });
});

describe("markGuidanceGroupAsDirty", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("marks group as dirty if active version exists", async () => {
    const localGroup = { isDirty: false, update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({}) };
    mockGuidanceGroupFindById.mockResolvedValue(localGroup);
    mockVersionedGuidanceGroupFindActiveByGuidanceGroupId.mockResolvedValue(true);

    await guidanceService.markGuidanceGroupAsDirty(context, 1);

    expect(localGroup.isDirty).toBe(true);
    expect(localGroup.update).toHaveBeenCalled();
  });

  it("does nothing if no group", async () => {
    mockGuidanceGroupFindById.mockResolvedValue(null);
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).resolves.toBeUndefined();
  });

  it("does nothing if no active version", async () => {
    const localGroup = { isDirty: false, update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({}) };
    mockGuidanceGroupFindById.mockResolvedValue(localGroup);
    mockVersionedGuidanceGroupFindActiveByGuidanceGroupId.mockResolvedValue(null);

    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).resolves.toBeUndefined();
  });

  it("logs and throws on error", async () => {
    mockGuidanceGroupFindById.mockRejectedValue(new Error("fail"));

    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).rejects.toThrow();
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getSectionTags", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });
  it("returns tags map", async () => {
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "tag1" }]);
    const result = await guidanceService.getSectionTags(context, 123);
    expect(result).toEqual({ 1: "tag1" });
  });

  it("returns empty object on error", async () => {
    mockPlanGuidanceQuery.mockRejectedValue(new Error("fail"));
    const result = await guidanceService.getSectionTags(context, 123);
    expect(result).toEqual({});
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getSectionTagsMap", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });
  it("returns tags map", async () => {
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 2, name: "tag2" }]);
    const result = await guidanceService.getSectionTagsMap(context, 456);
    expect(result).toEqual({ 2: "tag2" });
  });

  it("returns empty object on error", async () => {
    mockPlanGuidanceQuery.mockRejectedValue(new Error("fail"));
    const result = await guidanceService.getSectionTagsMap(context, 456);
    expect(result).toEqual({});
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getAffiliationsWithGuidanceForTemplate", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("returns [] if template not found", async () => {
    mockVersionedTemplateFindById.mockResolvedValue(null);
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    expect(result).toEqual([]);
  });

  it("returns all affiliations with associated section tag guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery.mockResolvedValueOnce([{ count: 1 }]); // sections with guidance
    mockAffiliationQuery.mockResolvedValueOnce([{ count: 0 }]); // questions without guidance

    mockPlanGuidanceQuery.mockResolvedValue([]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns template owner URI if template has question guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery.mockResolvedValueOnce([{ count: 0 }]); // sections without guidance
    mockAffiliationQuery.mockResolvedValueOnce([{ count: 1 }]); // questions with guidance

    mockPlanGuidanceQuery.mockResolvedValue([]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns ALL affiliations that have the correct tag-based guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([
        { affiliationId: "https://ror.org/021nxhr62" },
        { affiliationId: "https://ror.org/01cwqze88" },
        { affiliationId: "https://ror.org/03yrm5c26" }
      ]);

    mockPlanGuidanceQuery.mockResolvedValue([
      { tagId: 1 },
      { tagId: 2 }
    ]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual([
      "https://ror.org/021nxhr62",
      "https://ror.org/01cwqze88",
      "https://ror.org/03yrm5c26"
    ]);
  });

  it("does not duplicate template owner URI if they match user affiliation", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    const userContext = {
      ...context,
      token: { ...context.token, affiliationId: "https://ror.org/021nxhr62" }
    };

    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    mockPlanGuidanceQuery.mockResolvedValue([
      { tagId: 1 }
    ]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(userContext, 1);

    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns [] if no section/question guidance and no tag-based guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    mockPlanGuidanceQuery.mockResolvedValue([
      { tagId: 1 }
    ]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual([]);
  });

  it("returns [] if template has no tags and no section/question guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    mockVersionedTemplateFindById.mockResolvedValue(mockTemplate);

    mockAffiliationQuery
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    mockPlanGuidanceQuery.mockResolvedValue([]);

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual([]);
  });

  it("logs error and returns [] on exception", async () => {
    mockVersionedTemplateFindById.mockRejectedValue(new Error("Database error"));

    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);

    expect(result).toEqual([]);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getGuidanceSourcesForPlan", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("should return [] if plan not found", async () => {
    mockPlanFindById.mockResolvedValue(null);
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("should return [] if versionedTemplateId is missing from plan", async () => {
    mockPlanFindById.mockResolvedValue({ id: 1 });
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("should return [] when section has no tags and no guidanceText", async () => {
    mockPlanFindById.mockResolvedValue({ id: 1, versionedTemplateId: 1 });
    mockPlanGuidanceQuery.mockResolvedValue([]);
    mockVersionedSectionFindById.mockResolvedValue({ guidance: null });
    mockVersionedSectionCustomizationFindActive.mockResolvedValue(null);
    mockVersionedTemplateFindById.mockResolvedValue({ ownerId: null });
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1, 1);
    expect(result).toEqual([]);
  });

  it("should return [] if versionedQuestionId is provided but question not found", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedQuestionFindById.mockResolvedValue(null);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, 10
    );
    expect(result).toEqual([]);
  });

  it("should return [] if customSectionId is provided but custom section not found", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomSectionFindById.mockResolvedValue(null);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, undefined, 5
    );
    expect(result).toEqual([]);
  });

  it("should return expected guidance sources for a populated plan with versionedSectionId", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockVersionedSectionFindById.mockResolvedValue({ guidance: null });
    mockVersionedSectionCustomizationFindActive.mockResolvedValue(null);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue(mockUserSelections);
    mockPlanGuidanceQuery.mockResolvedValue([
      { id: 1, name: "Data Sharing" },
      { id: 2, name: "Preservation" }
    ]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue(mockBestPracticeGuidance);
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockImplementation((_: any, __: any, uri: any) => {
      if (uri === "https://ror.org/03yrm5c26") return Promise.resolve(mockTagBasedGuidanceCDL);
      if (uri === "https://ror.org/021nxhr62") return Promise.resolve(mockTagBasedGuidanceNSF);
      if (uri === "https://ror.org/01cwqze88") return Promise.resolve(mockTagBasedGuidanceNIH);
      return Promise.resolve([]);
    });
    mockAffiliationFindByURI.mockImplementation((_: any, __: any, uri: any) => {
      if (uri === "https://ror.org/03yrm5c26") return Promise.resolve(mockAffiliationCDL);
      if (uri === "https://ror.org/021nxhr62") return Promise.resolve(mockAffiliationNSF);
      if (uri === "https://ror.org/01cwqze88") return Promise.resolve(mockAffiliationNIH);
      return Promise.resolve(null);
    });

    const result = await guidanceService.getGuidanceSourcesForPlan(context, mockPlan.id, 1);

    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bestPractice", type: "BEST_PRACTICE" }),
      expect.objectContaining({ id: "affiliation-https://ror.org/03yrm5c26" }),
      expect.objectContaining({ id: "affiliation-https://ror.org/021nxhr62", type: "TEMPLATE_OWNER" }),
      expect.objectContaining({ id: "affiliation-https://ror.org/01cwqze88", type: "USER_SELECTED" }),
    ]));
  });

  it("should return guidance sources for the versionedQuestionId path", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedQuestionFindById.mockResolvedValue({
      id: 10, versionedSectionId: 5, guidanceText: null,
    });
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    mockVersionedQuestionCustomizationFindActive.mockResolvedValue(null);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue(mockBestPracticeGuidance);
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, 10
    );

    expect(mockVersionedQuestionFindById).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "bestPractice", type: "BEST_PRACTICE" });
  });

  it("should return template owner source when section has guidanceText and no tags", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockPlanGuidanceQuery.mockResolvedValue([]);
    mockVersionedSectionFindById.mockResolvedValue({ guidance: "Template-level guidance" });
    mockVersionedSectionCustomizationFindActive.mockResolvedValue(null);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: mockVersionedTemplate.ownerId },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationNSF);

    const result = await guidanceService.getGuidanceSourcesForPlan(context, mockPlan.id, 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "TEMPLATE_OWNER",
      orgURI: mockVersionedTemplate.ownerId,
      hasGuidance: true,
    });
    expect(result[0].items[0].guidanceText).toEqual("Template-level guidance");
  });

  it("should include USER_SELECTED empty pill sources for user selections with no guidance when no tags", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockPlanGuidanceQuery.mockResolvedValue([]);
    mockVersionedSectionFindById.mockResolvedValue({ guidance: null });
    mockVersionedSectionCustomizationFindActive.mockResolvedValue(null);
    mockVersionedTemplateFindById.mockResolvedValue({ ownerId: null });
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: "https://ror.org/01cwqze88" },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationNIH);

    const result = await guidanceService.getGuidanceSourcesForPlan(context, mockPlan.id, 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "USER_SELECTED",
      orgURI: "https://ror.org/01cwqze88",
      items: [],
      hasGuidance: false,
    });
  });

  it("should prepend section customization guidanceText to user affiliation items", async () => {
    const userAffiliationUri = "https://ror.org/03yrm5c26";
    const localContext = { ...context, token: { ...context.token, affiliationId: userAffiliationUri } };

    mockPlanFindById.mockResolvedValue(mockPlan);
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    mockVersionedSectionFindById.mockResolvedValue({ guidance: null });
    mockVersionedSectionCustomizationFindActive.mockResolvedValue({
      guidance: "Customized section guidance",
    });
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: userAffiliationUri },
    ]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue([]);
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([
      { tagId: 1, guidanceText: "CDL tag guidance" },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationCDL);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, 1
    );

    const userSource = result.find((s: any) => s.id === `affiliation-${userAffiliationUri}`);
    expect(userSource).toBeDefined();
    expect(userSource.type).toEqual("USER_AFFILIATION");
    expect(userSource.items[0].guidanceText).toEqual("Customized section guidance");
  });

  it("should not prepend guidanceText to template owner items when customSectionId is used", async () => {
    const localContext = { ...context, token: { ...context.token, affiliationId: "https://unrelated.org" } };

    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomSectionFindById.mockResolvedValue({
      id: 5, guidance: "Custom section guidance",
    });
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: mockVersionedTemplate.ownerId },
    ]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue([]);
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([
      { tagId: 1, guidanceText: "NSF tag guidance" },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationNSF);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, undefined, undefined, 5
    );

    const templateOwnerSource = result.find((s: any) => s.type === "TEMPLATE_OWNER");
    expect(templateOwnerSource).toBeDefined();
    expect(templateOwnerSource.items).toHaveLength(1);
    expect(templateOwnerSource.items[0].guidanceText).toEqual("NSF tag guidance");
  });

  it("should return [] if customQuestionId is provided but custom question not found", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomQuestionFindById.mockResolvedValue(null);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, undefined, undefined, 99
    );
    expect(result).toEqual([]);
  });

  it("should use section tags when customQuestionId refers to a BASE-section question", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomQuestionFindById.mockResolvedValue({
      id: 42,
      versionedSectionType: 'BASE',
      versionedSectionId: 7,
      guidanceText: null,
    });
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue(
      mockBestPracticeGuidance
    );
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, undefined, undefined, 42
    );

    expect(mockVersionedCustomQuestionFindById).toHaveBeenCalled();
    expect(mockPlanGuidanceQuery.mock.calls[0][2]).toEqual(["7"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "bestPractice", type: "BEST_PRACTICE" });
  });

  it("should use template-wide tags when customQuestionId refers to a CUSTOM-section question", async () => {
    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomQuestionFindById.mockResolvedValue({
      id: 42,
      versionedSectionType: 'CUSTOM',
      versionedSectionId: 7,
      guidanceText: null,
    });
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 2, name: "Preservation" }]);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue(
      mockBestPracticeGuidance
    );
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, undefined, undefined, 42
    );

    expect(mockVersionedCustomQuestionFindById).toHaveBeenCalled();
    expect(mockPlanGuidanceQuery.mock.calls[0][2]).toEqual(["973"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "bestPractice", type: "BEST_PRACTICE" });
  });

  it("should attribute guidanceText to user affiliation when customQuestionId is provided and no tags", async () => {
    const userAffiliationUri = "https://ror.org/03yrm5c26";
    const localContext = {
      ...context,
      token: { ...context.token, affiliationId: userAffiliationUri },
    };

    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomQuestionFindById.mockResolvedValue({
      id: 42,
      versionedSectionType: 'BASE',
      versionedSectionId: 7,
      guidanceText: "Custom question guidance text",
    });
    mockPlanGuidanceQuery.mockResolvedValue([]);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: userAffiliationUri },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationCDL);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, undefined, undefined, undefined, 42
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "USER_AFFILIATION",
      orgURI: userAffiliationUri,
      hasGuidance: true,
    });
    expect(result[0].items[0].guidanceText).toEqual("Custom question guidance text");
  });

  it("should not prepend guidanceText to template owner items when customQuestionId is used", async () => {
    const localContext = {
      ...context,
      token: { ...context.token, affiliationId: "https://unrelated.org" },
    };

    mockPlanFindById.mockResolvedValue(mockPlan);
    mockVersionedCustomQuestionFindById.mockResolvedValue({
      id: 42,
      versionedSectionType: 'BASE',
      versionedSectionId: 7,
      guidanceText: "Custom question guidance",
    });
    mockPlanGuidanceQuery.mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    mockVersionedTemplateFindById.mockResolvedValue(mockVersionedTemplate);
    mockPlanGuidanceFindByPlanAndUserId.mockResolvedValue([
      { affiliationId: mockVersionedTemplate.ownerId },
    ]);
    mockVersionedGuidanceFindBestPracticeByTagIds.mockResolvedValue([]);
    mockVersionedGuidanceFindByAffiliationAndTagIds.mockResolvedValue([
      { tagId: 1, guidanceText: "NSF tag guidance" },
    ]);
    mockAffiliationFindByURI.mockResolvedValue(mockAffiliationNSF);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, undefined, undefined, undefined, 42
    );

    const templateOwnerSource = result.find((s: any) => s.type === "TEMPLATE_OWNER");
    expect(templateOwnerSource).toBeDefined();
    expect(templateOwnerSource.items).toHaveLength(1);
    expect(templateOwnerSource.items[0].guidanceText).toEqual("NSF tag guidance");
  });
});