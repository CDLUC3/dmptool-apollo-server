import casual from "casual";
import { DMPToolDMPType } from "@dmptool/types";
import { MyContext } from "../../context";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { Plan } from "../../models/Plan";
import { getMockORCID } from "../../__tests__/helpers";
import {
  createMaDMP,
  deleteMaDMP,
  getMaDMP,
  getMaDMPVersionTimestamps,
  maDMPExists,
  tombstoneMaDMP,
  updateMaDMP
} from "../dynamo";
import {
  convertMySQLDateTimeToRFC3339,
  createDMP,
  deleteDMP,
  DMP_LATEST_VERSION,
  DMPExists,
  DMPVersionType,
  getDMPs,
  getDMPVersions,
  planToDMPCommonStandard,
  tombstoneDMP,
  updateDMP
} from "@dmptool/utils";

// Mock the @dmptool/utils module
jest.mock("@dmptool/utils");

let context: MyContext;
let mockPlan: Plan;
let mockDMP: DMPToolDMPType;

beforeEach(async () => {
  context = await buildMockContextWithToken(logger);

  const created = new Date(2026, 1, 1, 2, 3);
  const modified = new Date(2026, 1, 4, 5, 6);
  mockPlan = {
    id: casual.integer(1, 1000),
    projectId: casual.integer(1, 1000),
    versionedTemplateId: casual.integer(1, 1000),
    dmpId: `https://doi.org/10.1234/${casual.uuid}`,
    title: casual.title,
    modified: modified.toISOString(),
    created: created.toISOString(),
  } as Plan;

  mockDMP = {
    dmp: {
      title: mockPlan.title,
      dmp_id: {
        identifier: mockPlan.dmpId,
        type: 'doi'
      },
      created: convertMySQLDateTimeToRFC3339(mockPlan.created),
      modified: convertMySQLDateTimeToRFC3339(mockPlan.modified),
      ethical_issues_exist: 'unknown',
      language: 'eng',
      contact: {
        name: casual.name,
        mbox: casual.email,
        contact_id: [{
          identifier: getMockORCID(),
          type: 'orcid'
        }]
      },
      dataset: [{
        title: casual.sentence,
        dataset_id: {
          identifier: 'https://example.com/projects/123/dmps/12345/outputs/9876',
          type: 'other'
        },
        personal_data: 'unknown',
        sensitive_data: 'no',
      }]
    }
  } as DMPToolDMPType;

  jest.clearAllMocks();
});

describe("maDMPExists", () => {
  it("should return true when DMP exists in DynamoDB", async () => {
    (DMPExists as jest.Mock).mockResolvedValue(true);

    const result = await maDMPExists(context, mockPlan.dmpId);

    expect(DMPExists).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      mockPlan.dmpId
    );
    expect(result).toBe(true);
  });

  it("should return false when DMP does not exist in DynamoDB", async () => {
    (DMPExists as jest.Mock).mockResolvedValue(false);

    const result = await maDMPExists(context, mockPlan.dmpId);

    expect(result).toBe(false);
  });

  it("should return false and log error when DMPExists throws", async () => {
    const error = new Error("DynamoDB error");
    (DMPExists as jest.Mock).mockRejectedValue(error);

    const result = await maDMPExists(context, mockPlan.dmpId);

    expect(context.logger.error).toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

describe("getMaDMPVersionTimestamps", () => {
  it("should return array of version timestamps", async () => {
    const mockVersions: DMPVersionType[] = [
      { dmpId: mockPlan.dmpId, modified: convertMySQLDateTimeToRFC3339(mockPlan.modified) },
      { dmpId: mockPlan.dmpId, modified: convertMySQLDateTimeToRFC3339(mockPlan.created) },
    ];
    (getDMPVersions as jest.Mock).mockResolvedValue(mockVersions);

    const result = await getMaDMPVersionTimestamps(context, mockPlan.dmpId);

    expect(getDMPVersions).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      mockPlan.dmpId
    );
    expect(result).toEqual(mockVersions);
  });

  it("should throw error when getDMPVersions fails", async () => {
    const error = new Error("Version fetch failed");
    (getDMPVersions as jest.Mock).mockRejectedValue(error);

    await expect(getMaDMPVersionTimestamps(context, mockPlan.dmpId)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("getMaDMP", () => {
  it("should fetch DMP with specified version", async () => {
    const version = "2024-01-01T10:00:00Z";
    (getDMPs as jest.Mock).mockResolvedValue([mockDMP]);

    const result = await getMaDMP(context, mockPlan.dmpId, version, true);

    expect(getDMPs).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      expect.stringContaining('https://'),
      mockPlan.dmpId,
      version,
      true
    );
    expect(result).toEqual([mockDMP]);
  });

  it("should fetch latest version when version is null", async () => {
    (getDMPs as jest.Mock).mockResolvedValue([mockDMP]);

    const result = await getMaDMP(context, mockPlan.dmpId, null, true);

    expect(getDMPs).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      mockPlan.dmpId,
      DMP_LATEST_VERSION,
      true
    );
    expect(result).toEqual([mockDMP]);
  });

  it("should fetch DMP without extensions when includeExtensions is false", async () => {
    (getDMPs as jest.Mock).mockResolvedValue([mockDMP]);

    await getMaDMP(context, mockPlan.dmpId, null, false);

    expect(getDMPs).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      mockPlan.dmpId,
      DMP_LATEST_VERSION,
      false
    );
  });

  it("should throw error when getDMPs fails", async () => {
    const error = new Error("Fetch failed");
    (getDMPs as jest.Mock).mockRejectedValue(error);

    await expect(getMaDMP(context, mockPlan.dmpId, null)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("createMaDMP", () => {
  it("should create a new maDMP record", async () => {
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(mockDMP);
    (createDMP as jest.Mock).mockResolvedValue(mockDMP);

    const result = await createMaDMP(context, mockPlan.dmpId, mockDMP, true);

    expect(createDMP).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      expect.stringContaining('https://'),
      mockPlan.dmpId,
      mockDMP,
      DMP_LATEST_VERSION,
      true
    );
    expect(result).toEqual(mockDMP);
  });

  it("should return null when DMP already exists", async () => {
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(mockDMP);
    (createDMP as jest.Mock).mockResolvedValue(null);

    const result = await createMaDMP(context, mockPlan.dmpId, mockDMP);

    expect(result).toBeNull();
  });

  it("should throw error when createDMP fails", async () => {
    const error = new Error("Create failed");
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(mockDMP);
    (createDMP as jest.Mock).mockRejectedValue(error);

    await expect(createMaDMP(context, mockPlan.dmpId, mockDMP)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("updateMaDMP", () => {
  it("should update an existing maDMP record", async () => {
    const updatedDMP = {...mockDMP, title: "Updated Title"};
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(updatedDMP);
    (updateDMP as jest.Mock).mockResolvedValue(updatedDMP);

    const result = await updateMaDMP(context, mockPlan.dmpId, mockDMP, true);

    expect(planToDMPCommonStandard).toHaveBeenCalled();
    expect(updateDMP).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      expect.stringContaining('https://'),
      mockPlan.dmpId,
      updatedDMP,
      expect.any(Number),
      true
    );
    expect(result).toEqual(updatedDMP);
  });

  it("should return null when DMP does not exist", async () => {
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(mockDMP);
    (updateDMP as jest.Mock).mockResolvedValue(null);

    const result = await updateMaDMP(context, mockPlan.dmpId, mockDMP);

    expect(result).toBeNull();
  });

  it("should throw error when updateDMP fails", async () => {
    const error = new Error("Update failed");
    (planToDMPCommonStandard as jest.Mock).mockResolvedValue(mockDMP);
    (updateDMP as jest.Mock).mockRejectedValue(error);

    await expect(updateMaDMP(context, mockPlan.dmpId, mockDMP)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("tombstoneMaDMP", () => {
  it("should tombstone a maDMP record", async () => {
    const tombstonedDMP = {...mockDMP, title: "OBSOLETE: " + mockDMP.dmp.title};
    (tombstoneDMP as jest.Mock).mockResolvedValue(tombstonedDMP);

    const result = await tombstoneMaDMP(context, mockPlan.dmpId, true);

    expect(tombstoneDMP).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      expect.stringContaining('https://'),
      mockPlan.dmpId,
      true
    );
    expect(result).toEqual(tombstonedDMP);
  });

  it("should throw error when tombstoneDMP fails", async () => {
    const error = new Error("Tombstone failed");
    (tombstoneDMP as jest.Mock).mockRejectedValue(error);

    await expect(tombstoneMaDMP(context, mockPlan.dmpId)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

describe("deleteMaDMP", () => {
  it("should delete a maDMP record", async () => {
    (deleteDMP as jest.Mock).mockResolvedValue(mockDMP);

    const result = await deleteMaDMP(context, mockPlan.dmpId, true);

    expect(deleteDMP).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: context.logger,
      }),
      expect.stringContaining('https://'),
      mockPlan.dmpId,
      true
    );
    expect(result).toEqual(mockDMP);
  });

  it("should throw error when deleteDMP fails", async () => {
    const error = new Error("Delete failed");
    (deleteDMP as jest.Mock).mockRejectedValue(error);

    await expect(deleteMaDMP(context, mockPlan.dmpId)).rejects.toThrow(error);
    expect(context.logger.error).toHaveBeenCalled();
  });
});

