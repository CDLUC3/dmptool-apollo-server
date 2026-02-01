import * as guidanceService from "../guidanceService";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import {
  mockPlan,
  mockUser,
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
import { User } from "../../models/User";
import { VersionedTemplate } from "../../models/VersionedTemplate";
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

jest.mock("../../models/Affiliation", () => ({
  Affiliation: {
    findByURI: jest.fn(),
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

describe("getGuidanceSourcesForPlan", () => {
  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    jest.clearAllMocks();
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
    
    (PlanGuidance.query as jest.Mock).mockResolvedValue([]);
    
    const result = await guidanceService.getGuidanceSourcesForPlan(context, 1);
    expect(result).toEqual([]);
  });

  it("returns expected guidance sources for a populated plan", async () => {
    (Plan.findById as jest.Mock).mockResolvedValue(mockPlan);
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    (VersionedTemplate.findById as jest.Mock).mockResolvedValue(mockVersionedTemplate);
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

    const result = await guidanceService.getGuidanceSourcesForPlan(context, mockPlan.id);

    expect(result).toHaveLength(4);
    expect(result).toEqual([
      expect.objectContaining({
        id: "bestPractice",
        type: "BEST_PRACTICE",
        label: "DMP Tool",
        shortName: "DMP Tool",
        orgURI: "bestPractice",
        hasGuidance: true,
        items: expect.any(Array),
      }),
      expect.objectContaining({
        id: "affiliation-https://ror.org/03yrm5c26",
        type: "USER_AFFILIATION",
        label: "California Digital Library (cdlib.org)",
        shortName: "CDL",
        orgURI: "https://ror.org/03yrm5c26",
        hasGuidance: true,
        items: expect.any(Array),
      }),
      expect.objectContaining({
        id: "affiliation-https://ror.org/021nxhr62",
        type: "TEMPLATE_OWNER",
        label: "National Science Foundation (nsf.gov)",
        shortName: "NSF",
        orgURI: "https://ror.org/021nxhr62",
        hasGuidance: true,
        items: expect.any(Array),
      }),
      expect.objectContaining({
        id: "affiliation-https://ror.org/01cwqze88",
        type: "USER_SELECTED",
        label: "National Institutes of Health (nih.gov)",
        shortName: "NIH",
        orgURI: "https://ror.org/01cwqze88",
        hasGuidance: true,
        items: expect.any(Array),
      }),
    ]);
  });
});
