import * as guidanceService from "../guidanceService";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
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
} from "../__mocks__/mockGuidanceData";
import { MyContext } from "../../context";
import { GuidanceGroup } from "../../models/GuidanceGroup";
import { PlanGuidance } from "../../models/Guidance";
import { VersionedGuidance } from "../../models/VersionedGuidance";
import { Plan } from "../../models/Plan";
import { VersionedTemplate } from "../../models/VersionedTemplate";
import { VersionedSection } from "../../models/VersionedSection";
import { VersionedQuestion } from "../../models/VersionedQuestion";
import { VersionedSectionCustomization } from "../../models/VersionedSectionCustomization";
import { VersionedQuestionCustomization } from "../../models/VersionedQuestionCustomization";
import { VersionedCustomSection } from "../../models/VersionedCustomSection";
import { Affiliation } from "../../models/Affiliation";
import { isSuperAdmin } from "../authService";

// Type for mock GuidanceGroup used in tests
type MockGuidanceGroup = Partial<GuidanceGroup> & {
  update?: jest.Mock;
};

let context: MyContext;
let group: MockGuidanceGroup;

// Mock authService to handle isSuperAdmin
jest.mock("../authService", () => ({
  isSuperAdmin: jest.fn(),
}));

jest.mock("../../models/GuidanceGroup", () => ({
  GuidanceGroup: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/VersionedGuidanceGroup", () => ({
  VersionedGuidanceGroup: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    create: jest.fn(),
    update: jest.fn(),
    hasErrors: jest.fn().mockReturnValue(false),
    ...data,
  })),
}));

const VersionedGuidanceGroupMock = jest.requireMock("../../models/VersionedGuidanceGroup").VersionedGuidanceGroup;
VersionedGuidanceGroupMock.findByGuidanceGroupId = jest.fn();
VersionedGuidanceGroupMock.findActiveByGuidanceGroupId = jest.fn();
VersionedGuidanceGroupMock.deactivateAll = jest.fn();

jest.mock("../../models/Guidance", () => ({
  Guidance: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
  })),
  PlanGuidance: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    create: jest.fn(),
    ...data,
  })),
}));

const GuidanceMock = jest.requireMock("../../models/Guidance").Guidance;
GuidanceMock.findByGuidanceGroupId = jest.fn();

const PlanGuidanceMock = jest.requireMock("../../models/Guidance").PlanGuidance;
PlanGuidanceMock.query = jest.fn();
PlanGuidanceMock.findByPlanAndUserId = jest.fn();

jest.mock("../../models/VersionedGuidance", () => ({
  VersionedGuidance: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    create: jest.fn(),
    hasErrors: jest.fn().mockReturnValue(false),
    ...data,
  })),
}));

const VersionedGuidanceMock = jest.requireMock("../../models/VersionedGuidance").VersionedGuidance;
VersionedGuidanceMock.findBestPracticeByTagIds = jest.fn();
VersionedGuidanceMock.findByAffiliationAndTagIds = jest.fn();

jest.mock("../../models/Plan", () => ({
  Plan: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/User", () => ({
  User: Object.assign(
    jest.fn().mockImplementation((data: Record<string, unknown>) => ({
      getEmail: jest.fn(),
      register: jest.fn(),
      update: jest.fn(),
      ...data,
    })),
    {
      findById: jest.fn(),
    }
  ),
  UserRole: {
    RESEARCHER: 'RESEARCHER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
  },
}));

jest.mock("../../models/VersionedTemplate", () => ({
  VersionedTemplate: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/VersionedSection", () => ({
  VersionedSection: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/VersionedQuestion", () => ({
  VersionedQuestion: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/VersionedSectionCustomization", () => ({
  VersionedSectionCustomization: {
    findActiveByTemplateAffiliationAndSection: jest.fn(),
  },
}));

jest.mock("../../models/VersionedQuestionCustomization", () => ({
  VersionedQuestionCustomization: {
    findActiveByTemplateAffiliationAndQuestion: jest.fn(),
  },
}));

jest.mock("../../models/VersionedCustomSection", () => ({
  VersionedCustomSection: {
    findById: jest.fn(),
  },
}));

jest.mock("../../models/Affiliation", () => ({
  Affiliation: {
    findByURI: jest.fn(),
    query: jest.fn(),
  },
}));

describe("addPlanGuidance", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("should create a PlanGuidance and return true if successful", async () => {
    (PlanGuidance as unknown as jest.Mock).mockImplementation(function () {
      return {
        create: jest.fn().mockResolvedValue({ hasErrors: () => false })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(true);
  });

  it("should return false if PlanGuidance.create returns an error", async () => {
    (PlanGuidance as unknown as jest.Mock).mockImplementation(function () {
      return {
        create: jest.fn().mockResolvedValue({ hasErrors: () => true })
      };
    });

    const result = await guidanceService.addPlanGuidance(context, 1, "affil-1", 2);
    expect(result).toBe(false);
  });

  it("should return false and log if PlanGuidance.create throws", async () => {
    (PlanGuidance as unknown as jest.Mock).mockImplementation(function () {
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
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });
  
  it("returns true if user is from the same org", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    const localContext = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(true);
  });

  it("returns true if user is super admin", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    (isSuperAdmin as jest.Mock).mockReturnValue(true); // Mock the imported function
    const localContext = { token: { affiliationId: "def", role: "SUPER_ADMIN" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(true);
  });

  it("returns false if no group", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(null);
    const localContext = { token: { affiliationId: "abc" } };
    const result = await guidanceService.hasPermissionOnGuidanceGroup(localContext as MyContext, 1);
    expect(result).toBe(false);
  });

  it("returns false if not same org and not super admin", async () => {
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue({ affiliationId: "abc" });
    (isSuperAdmin as jest.Mock).mockReturnValue(false); // Mock the imported function
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
      update: jest.fn().mockResolvedValue({ hasErrors: () => false }) 
    };
    
    VersionedGuidanceGroupMock.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn().mockResolvedValue({
        id: 2,
        active: true,
        hasErrors: () => false,
        update: jest.fn().mockResolvedValue({ hasErrors: () => false }),
      }),
      hasErrors: () => false,
      update: jest.fn().mockResolvedValue({ hasErrors: () => false }),
    }));
    
    VersionedGuidanceGroupMock.findByGuidanceGroupId.mockResolvedValue([{ version: 1 }]);
    VersionedGuidanceGroupMock.deactivateAll.mockResolvedValue(true);
    GuidanceMock.findByGuidanceGroupId.mockResolvedValue([{ id: 1, tagId: 2, guidanceText: "txt" }]);
    
    VersionedGuidanceMock.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn().mockResolvedValue({ hasErrors: () => false }),
      hasErrors: () => false,
    }));
  });

  it("publishes a group and returns true", async () => {
    const result = await guidanceService.publishGuidanceGroup(context, group as GuidanceGroup);
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
      update: jest.fn(),
    };
    
    await expect(guidanceService.publishGuidanceGroup(context, invalidGroup as GuidanceGroup)).rejects.toThrow();
  });

  it("throws if versioned group creation fails", async () => {
    VersionedGuidanceGroupMock.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn().mockResolvedValue({ hasErrors: () => true }),
      hasErrors: () => true,
    }));
    
    await expect(guidanceService.publishGuidanceGroup(context, group as GuidanceGroup)).rejects.toThrow();
  });

  it("throws if not all guidance versioned", async () => {
    VersionedGuidanceGroupMock.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      create: jest.fn().mockResolvedValue({ hasErrors: () => true }),
      hasErrors: () => true,
    }));
    
    await expect(guidanceService.publishGuidanceGroup(context, group as GuidanceGroup)).rejects.toThrow();
  });
});

describe("unpublishGuidanceGroup", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
    group = { id: 1 };
  });
  
  it("unpublishes a group and returns true", async () => {
    VersionedGuidanceGroupMock.deactivateAll.mockResolvedValue(true);
    const result = await guidanceService.unpublishGuidanceGroup(context, group as GuidanceGroup);
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
      update: jest.fn(),
    };
    
    await expect(guidanceService.unpublishGuidanceGroup(context, invalidGroup as GuidanceGroup)).rejects.toThrow();
  });

  it("throws if deactivateAll fails", async () => {
    VersionedGuidanceGroupMock.deactivateAll.mockResolvedValue(false);
    await expect(guidanceService.unpublishGuidanceGroup(context, group as GuidanceGroup)).rejects.toThrow();
  });
});

describe("markGuidanceGroupAsDirty", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });
  
  it("marks group as dirty if active version exists", async () => {
    const group = { isDirty: false, update: jest.fn().mockResolvedValue({}) };
    (GuidanceGroup.findById as jest.Mock).mockResolvedValue(group);
    VersionedGuidanceGroupMock.findActiveByGuidanceGroupId.mockResolvedValue(true);
    
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
    VersionedGuidanceGroupMock.findActiveByGuidanceGroupId.mockResolvedValue(null);
    
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).resolves.toBeUndefined();
  });

  it("logs and throws on error", async () => {
    (GuidanceGroup.findById as jest.Mock).mockRejectedValue(new Error("fail"));
    
    await expect(guidanceService.markGuidanceGroupAsDirty(context, 1)).rejects.toThrow();
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getSectionTags", () => {
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

describe("getAffiliationsWithGuidanceForTemplate", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
  });

  it("returns [] if template not found", async () => {
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(null);
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    expect(result).toEqual([]);
  });

  it("returns all affiliations with associated section tag guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock section guidance check - has guidance
    (Affiliation.query as jest.Mock).mockResolvedValueOnce([{ count: 1 }]); // sections with guidance
    (Affiliation.query as jest.Mock).mockResolvedValueOnce([{ count: 0 }]); // questions without guidance
    
    // Mock getSectionTagsMap returning empty (no tags)
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]);
    
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    
    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns template owner URI if template has question guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock question guidance check - has guidance
    (Affiliation.query as jest.Mock).mockResolvedValueOnce([{ count: 0 }]); // sections without guidance
    (Affiliation.query as jest.Mock).mockResolvedValueOnce([{ count: 1 }]); // questions with guidance
    
    // Mock getSectionTagsMap returning empty (no tags)
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]);
    
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    
    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns ALL affiliations that have the correct tag-based guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock Affiliation.query calls in sequence
    (Affiliation.query as jest.Mock)
      .mockResolvedValueOnce([{ count: 0 }]) // sections check
      .mockResolvedValueOnce([{ count: 0 }]) // questions check
      .mockResolvedValueOnce([ // affiliations with tag-based guidance
        { affiliationId: "https://ror.org/021nxhr62" }, // CDL
        { affiliationId: "https://ror.org/01cwqze88" }, // NSF
        { affiliationId: "https://ror.org/03yrm5c26" }  // NIH
      ]);
    
    // Mock getSectionTagIds returning tag IDs
    (PlanGuidance.query as jest.Mock).mockResolvedValue([
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
    
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock Affiliation.query calls in sequence
    (Affiliation.query as jest.Mock)
      .mockResolvedValueOnce([{ count: 1 }]) // sections check - has guidance
      .mockResolvedValueOnce([{ count: 0 }]) // questions check
      .mockResolvedValueOnce([{ count: 1 }]); // template owner tag-based guidance check
    // Should not check user affiliation since it's the same as template owner
    
    // Mock getSectionTagIds returning tag IDs
    (PlanGuidance.query as jest.Mock).mockResolvedValue([
      { tagId: 1 }
    ]);
    
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(userContext, 1);
    
    expect(result).toEqual(["https://ror.org/021nxhr62"]);
  });

  it("returns [] if no section/question guidance and no tag-based guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock Affiliation.query calls in sequence
    (Affiliation.query as jest.Mock)
      .mockResolvedValueOnce([{ count: 0 }]) // sections check
      .mockResolvedValueOnce([{ count: 0 }]) // questions check
      .mockResolvedValueOnce([{ count: 0 }]); // template owner tag-based guidance check
    
    // Mock getSectionTagIds returning tag IDs
    (PlanGuidance.query as jest.Mock).mockResolvedValue([
      { tagId: 1 }
    ]);
    
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    
    expect(result).toEqual([]);
  });

  it("returns [] if template has no tags and no section/question guidance", async () => {
    const mockTemplate = { id: 1, ownerId: "https://ror.org/021nxhr62" };
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
    
    // Mock Affiliation.query calls in sequence
    (Affiliation.query as jest.Mock)
      .mockResolvedValueOnce([{ count: 0 }]) // sections check - no guidance
      .mockResolvedValueOnce([{ count: 0 }]); // questions check - no guidance
    
    // Mock getSectionTagIds returning no tags
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]);
    
    const result = await guidanceService.getAffiliationsWithGuidanceForTemplate(context, 1);
    
    expect(result).toEqual([]);
  });

  it("logs error and returns [] on exception", async () => {
    (VersionedTemplate.findById as jest.Mock).mockRejectedValue(new Error("Database error"));
    
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
    (Plan.findById as jest.Mock).mockResolvedValue(null);
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("should return [] if versionedTemplateId is missing from plan", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue({ id: 1 }); // no versionedTemplateId
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("should return [] when section has no tags and no guidanceText", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue({ id: 1, versionedTemplateId: 1 });
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]); // empty tags
    (VersionedSection.findById as jest.Mock).mockResolvedValue({ guidance: null });
    (VersionedSectionCustomization.findActiveByTemplateAffiliationAndSection as jest.Mock).mockResolvedValue(null);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue({ ownerId: null });
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1, 1);
    expect(result).toEqual([]);
  });

  it("should return [] if versionedQuestionId is provided but question not found", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (VersionedQuestion.findById as jest.Mock).mockResolvedValue(null);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, 10
    );
    expect(result).toEqual([]);
  });

  it("should return [] if customSectionId is provided but custom section not found", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (VersionedCustomSection.findById as jest.Mock).mockResolvedValue(null);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, undefined, 5
    );
    expect(result).toEqual([]);
  });

  it("should return expected guidance sources for a populated plan with versionedSectionId", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
    (VersionedSection.findById as jest.Mock).mockResolvedValue({ guidance: null });
    (VersionedSectionCustomization.findActiveByTemplateAffiliationAndSection as jest.Mock).mockResolvedValue(null);
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue(mockUserSelections);
    (PlanGuidance.query as jest.Mock).mockResolvedValue([
      { id: 1, name: "Data Sharing" },
      { id: 2, name: "Preservation" }
    ]);
    (VersionedGuidance.findBestPracticeByTagIds as jest.Mock).mockResolvedValue(mockBestPracticeGuidance);
    (VersionedGuidance.findByAffiliationAndTagIds as jest.Mock).mockImplementation((_, __, uri) => {
      if (uri === "https://ror.org/03yrm5c26") return Promise.resolve(mockTagBasedGuidanceCDL);
      if (uri === "https://ror.org/021nxhr62") return Promise.resolve(mockTagBasedGuidanceNSF);
      if (uri === "https://ror.org/01cwqze88") return Promise.resolve(mockTagBasedGuidanceNIH);
      return Promise.resolve([]);
    });
    (Affiliation.findByURI as jest.Mock).mockImplementation((_, __, uri) => {
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
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (VersionedQuestion.findById as jest.Mock).mockResolvedValue({
      id: 10, versionedSectionId: 5, guidanceText: null,
    });
    (PlanGuidance.query as jest.Mock).mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    (VersionedQuestionCustomization.findActiveByTemplateAffiliationAndQuestion as jest.Mock).mockResolvedValue(null);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([]);
    (VersionedGuidance.findBestPracticeByTagIds as jest.Mock).mockResolvedValue(mockBestPracticeGuidance);
    (VersionedGuidance.findByAffiliationAndTagIds as jest.Mock).mockResolvedValue([]);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      context, mockPlan.id, undefined, 10
    );

    expect(VersionedQuestion.findById).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "bestPractice", type: "BEST_PRACTICE" });
  });

  it("should return template owner source when section has guidanceText and no tags", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]); // no tags
    (VersionedSection.findById as jest.Mock).mockResolvedValue({ guidance: "Template-level guidance" });
    (VersionedSectionCustomization.findActiveByTemplateAffiliationAndSection as jest.Mock).mockResolvedValue(null);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([
      { affiliationId: mockVersionedTemplate.ownerId },
    ]);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliationNSF);

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
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]); // no tags
    (VersionedSection.findById as jest.Mock).mockResolvedValue({ guidance: null });
    (VersionedSectionCustomization.findActiveByTemplateAffiliationAndSection as jest.Mock).mockResolvedValue(null);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue({ ownerId: null });
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([
      { affiliationId: "https://ror.org/01cwqze88" },
    ]);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliationNIH);

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
    const userAffiliationUri = "https://ror.org/03yrm5c26"; // CDL
    const localContext = { ...context, token: { ...context.token, affiliationId: userAffiliationUri } };

    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (PlanGuidance.query as jest.Mock).mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    (VersionedSection.findById as jest.Mock).mockResolvedValue({ guidance: null });
    (VersionedSectionCustomization.findActiveByTemplateAffiliationAndSection as jest.Mock).mockResolvedValue({
      guidance: "Customized section guidance",
    });
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([
      { affiliationId: userAffiliationUri },
    ]);
    (VersionedGuidance.findBestPracticeByTagIds as jest.Mock).mockResolvedValue([]);
    (VersionedGuidance.findByAffiliationAndTagIds as jest.Mock).mockResolvedValue([
      { tagId: 1, guidanceText: "CDL tag guidance" },
    ]);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliationCDL);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, 1
    );

    const userSource = result.find(s => s.id === `affiliation-${userAffiliationUri}`);
    expect(userSource).toBeDefined();
    expect(userSource.type).toEqual("USER_AFFILIATION");
    expect(userSource.items[0].guidanceText).toEqual("Customized section guidance");
  });

  it("should not prepend guidanceText to template owner items when customSectionId is used", async () => {
    const localContext = { ...context, token: { ...context.token, affiliationId: "https://unrelated.org" } };

    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (VersionedCustomSection.findById as jest.Mock).mockResolvedValue({
      id: 5, guidance: "Custom section guidance",
    });
    (PlanGuidance.query as jest.Mock).mockResolvedValue([{ id: 1, name: "Data Sharing" }]);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
    (PlanGuidance.findByPlanAndUserId as jest.Mock).mockResolvedValue([
      { affiliationId: mockVersionedTemplate.ownerId },
    ]);
    (VersionedGuidance.findBestPracticeByTagIds as jest.Mock).mockResolvedValue([]);
    (VersionedGuidance.findByAffiliationAndTagIds as jest.Mock).mockResolvedValue([
      { tagId: 1, guidanceText: "NSF tag guidance" },
    ]);
    (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliationNSF);

    const result = await guidanceService.getGuidanceSourcesForPlan(
      localContext as MyContext, mockPlan.id, undefined, undefined, 5
    );

    const templateOwnerSource = result.find(s => s.type === "TEMPLATE_OWNER");
    expect(templateOwnerSource).toBeDefined();
    // guidanceText must NOT be prepended for template owner when customSectionId is provided
    expect(templateOwnerSource.items).toHaveLength(1);
    expect(templateOwnerSource.items[0].guidanceText).toEqual("NSF tag guidance");
  });
});
