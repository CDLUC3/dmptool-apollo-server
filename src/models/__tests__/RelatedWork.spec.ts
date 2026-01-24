import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { RelatedWork, RelatedWorkSearchResult, Work, WorkVersion, parseDOI } from "../RelatedWork";
import { logger } from "../../logger";
import { Plan } from "../Plan";
import {
  getMockHash,
  getMockRelatedWork,
  getMockRelatedWorkSearchResult,
  getMockWork,
  getMockWorkVersion,
} from "../__mocks__/RelatedWork";

jest.mock("../../context.ts");

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("Work", () => {
  let work: Work;
  const workData = getMockWork();

  beforeEach(async () => {
    work = new Work(workData);
  });

  it("should parse DOIs correctly", () => {
    const examples = [
      ["https://doi.org/10.11/JOURNAL.v12.i4.p33-45?abc=123", "10.11/journal.v12.i4.p33-45"],
      ["https://dx.doi.org/10.3333/nature.2025.1a", "10.3333/nature.2025.1a"],
      ["10.3333/pnas.110.10107", "10.3333/pnas.110.10107"],
      ["10.80000/1061-4036(1996)017<0023:MM>2.0.CO;2-I", "10.80000/1061-4036(1996)017<0023:mm>2.0.co;2-i"],
      ["https://doi.org/10.11/ENTRY%2Fitem%201", "10.11/entry/item 1"],
      ["http://dx.doi.org/10.3333/dataset[v2]+results", "10.3333/dataset[v2]+results"],
      ["https://dx.doi.org/10.80000/chapter%234%3Cmain%3E", '10.80000/chapter#4<main>'],
      ["http://doi.org/10.11/a%22quoted%22{section}", '10.11/a"quoted"{section}'],
      [" https://doi.crossref.org/10.3333/formula^x%7Cy ", "10.3333/formula^x|y"],
      ["https://doi.org/10.80000/codeexample+path%5Cfile", "10.80000/codeexample+path\\file"],
      ["https://dx.doi.org/10.11/complex%2Fpath%23id%20%25", "10.11/complex/path#id %"],
      ["10.11/review<draft>%20V1", "10.11/review<draft> v1"],
      ["10.3333/archive[2025]%5Cbackup", "10.3333/archive[2025]\\backup"]
    ];

    for (const [text, actual] of examples) {
      expect(parseDOI(text)).toEqual(actual);
    }
  });

  it("should initialize options as expected", () => {
    expect(work.doi).toEqual(workData.doi);
  });

  it("should return true when calling isValid if object is valid", async () => {
    expect(await work.isValid()).toBe(true);
  });

  it("should return false when calling isValid if the doi field is missing", async () => {
    work.doi = null;
    expect(await work.isValid()).toBe(false);
    expect(Object.keys(work.errors).length).toBe(1);
    expect(work.errors["doi"]).toBeTruthy();
  });

  it("should cleanup doi when prepForSave is called", async () => {
    // Typical DOI with https://doi.org/ prefix
    const doi = casual.uuid;
    work.doi = `https://doi.org/${doi}`;
    work.prepForSave();
    expect(work.doi).toBe(doi);

    // Uppercase with spaces on either side
    work.doi = `   https://doi.org/${doi}   `.toUpperCase();
    work.prepForSave();
    expect(work.doi).toBe(doi);

    // Not a URL
    work.doi = doi;
    expect(work.doi).toBe(doi);
  });
});

describe("Work queries", () => {
  const originalQuery = Work.query;
  let localQuery;
  let context;

  beforeEach(async () => {
    localQuery = jest.fn();
    (Work.query as jest.Mock) = localQuery;
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    Work.query = originalQuery;
  });

  it("findById should call query with correct params and return the object", async () => {
    const work = new Work({ id: casual.integer(1, 999), ...getMockWork() });
    localQuery.mockResolvedValueOnce([work]);
    const result = await Work.findById("testing", context, work.id);
    const expectedSql = "SELECT * FROM works WHERE id = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [work.id.toString()], "testing");
    expect(result).toEqual(work);
  });

  it("findById should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const workId = casual.integer(1, 999);
    const result = await Work.findById("testing", context, workId);
    expect(result).toEqual(null);
  });

  it("findByDoi should call query with correct params and return the object", async () => {
    const work = new Work({ id: casual.integer(1, 999), ...getMockWork() });
    localQuery.mockResolvedValueOnce([work]);
    const result = await Work.findByDoi("testing", context, work.doi);
    const expectedSql = "SELECT * FROM works WHERE doi = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [work.doi.toString()], "testing");
    expect(result).toEqual(work);
  });

  it("findByDoi should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const doi = casual.uuid;
    const result = await Work.findByDoi("testing", context, doi);
    expect(result).toEqual(null);
  });
});

describe("Work update", () => {
  let updateQuery;
  let work;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Work.update as jest.Mock) = updateQuery;

    work = new Work({ id: casual.integer(1, 999), ...getMockWork() });
  });

  it("returns the Work with errors if it is not valid", async () => {
    const localValidator = jest.fn();
    (work.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await work.update(context);
    expect(result instanceof Work).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the updated Work", async () => {
    const localValidator = jest.fn();
    (work.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(work);

    const mockFindById = jest.fn();
    (Work.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(work);

    const result = await work.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Work);
  });
});

describe("Work create", () => {
  const originalInsert = Work.insert;
  let insertQuery;
  let work;

  beforeEach(() => {
    insertQuery = jest.fn();
    (Work.insert as jest.Mock) = insertQuery;

    work = new Work(getMockWork());
  });

  afterEach(() => {
    Work.insert = originalInsert;
  });

  it("returns the Work without errors if it is valid", async () => {
    const localValidator = jest.fn();
    (work.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await work.create(context);
    expect(result instanceof Work).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the Work with errors if it is invalid", async () => {
    work.doi = undefined;
    const response = await work.create(context);
    expect(response.errors["doi"]).toBe("DOI can't be blank");
  });

  it("returns the Work with an error if the object already exists", async () => {
    const mockFindByDoi = jest.fn();
    (Work.findByDoi as jest.Mock) = mockFindByDoi;
    mockFindByDoi.mockResolvedValueOnce(work);

    const result = await work.create(context);
    expect(mockFindByDoi).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors["general"]).toBeTruthy();
  });

  it("returns the newly added Work", async () => {
    const mockFindByDoi = jest.fn();
    (Work.findByDoi as jest.Mock) = mockFindByDoi;
    mockFindByDoi.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (Work.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(work);

    const result = await work.create(context);
    expect(mockFindByDoi).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Work);
  });
});

describe("Work delete", () => {
  let work;

  beforeEach(() => {
    work = new Work({ id: casual.integer(1, 999), ...getMockWork() });
  });

  it("returns null if the Work has no id", async () => {
    work.id = null;
    expect(await work.delete(context)).toBe(null);
  });

  it("returns null if it was not able to delete the record", async () => {
    const deleteQuery = jest.fn();
    (Work.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await work.delete(context)).toBe(null);
  });

  it("returns the Work if it was able to delete the record", async () => {
    const deleteQuery = jest.fn();
    (Work.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(work);

    const mockFindById = jest.fn();
    (Work.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(work);

    const result = await work.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Work);
  });
});

describe("WorkVersion", () => {
  let workVersion: WorkVersion;

  const workVersionData = getMockWorkVersion();

  beforeEach(() => {
    workVersion = new WorkVersion(workVersionData);
  });

  it("should initialize options as expected", () => {
    expect(workVersion.workId).toEqual(workVersionData.workId);
    expect(workVersion.hash).toEqual(workVersionData.hash);
    expect(workVersion.workType).toEqual(workVersionData.workType);
    expect(workVersion.publicationDate).toEqual(workVersionData.publicationDate);
    expect(workVersion.title).toEqual(workVersionData.title);
    expect(workVersion.abstractText).toEqual(workVersionData.abstractText);
    expect(workVersion.authors).toEqual(workVersionData.authors);
    expect(workVersion.institutions).toEqual(workVersionData.institutions);
    expect(workVersion.funders).toEqual(workVersionData.funders);
    expect(workVersion.awards).toEqual(workVersionData.awards);
    expect(workVersion.publicationVenue).toEqual(workVersionData.publicationVenue);
    expect(workVersion.sourceName).toEqual(workVersionData.sourceName);
    expect(workVersion.sourceUrl).toEqual(workVersionData.sourceUrl);
  });

  it("should return true when calling isValid if object is valid", async () => {
    expect(await workVersion.isValid()).toBe(true);
  });

  for (const field of [
    "workId",
    "hash",
    "workType",
    "authors",
    "institutions",
    "funders",
    "awards",
    "sourceName",
    "sourceUrl",
  ]) {
    it(`should return false when calling isValid if the ${field} field is missing`, async () => {
      workVersion[field] = null;
      expect(await workVersion.isValid()).toBe(false);
      expect(Object.keys(workVersion.errors).length).toBe(1);
      expect(workVersion.errors[field]).toBeTruthy();
    });
  }
});

describe("WorkVersion queries", () => {
  const originalQuery = WorkVersion.query;
  let localQuery;
  let context;

  beforeEach(async () => {
    localQuery = jest.fn();
    (WorkVersion.query as jest.Mock) = localQuery;
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    WorkVersion.query = originalQuery;
  });

  it("findById should call query with correct params and return the object", async () => {
    const workVersion = new WorkVersion({ id: casual.integer(1, 999), ...getMockWorkVersion() });
    localQuery.mockResolvedValueOnce([workVersion]);
    const result = await WorkVersion.findById("testing", context, workVersion.id);
    const expectedSql = "SELECT * FROM workVersions WHERE id = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [workVersion.id.toString()], "testing");
    expect(result).toEqual(workVersion);
  });

  it("findById should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const workId = casual.integer(1, 999);
    const result = await WorkVersion.findById("testing", context, workId);
    expect(result).toEqual(null);
  });

  it("findByDoiAndHash should call query with correct params and return the object", async () => {
    const doi = casual.uuid;
    const workVersion = new WorkVersion({ id: casual.integer(1, 999), ...getMockWorkVersion() });
    localQuery.mockResolvedValueOnce([workVersion]);
    const result = await WorkVersion.findByDoiAndHash("testing", context, doi, workVersion.hash);
    const expectedSql =
      "SELECT * FROM workVersions wv LEFT JOIN works w ON wv.workId = w.id WHERE wv.hash = ? AND w.doi = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [workVersion.hash, doi.toString()], "testing");
    expect(result).toEqual(workVersion);
  });

  it("findByDoiAndHash should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const doi = casual.uuid;
    const hash = getMockHash();
    const result = await WorkVersion.findByDoiAndHash("testing", context, doi, hash);
    expect(result).toEqual(null);
  });
});

describe("WorkVersion update", () => {
  let updateQuery;
  let workVersion;

  beforeEach(() => {
    updateQuery = jest.fn();
    (WorkVersion.update as jest.Mock) = updateQuery;

    workVersion = new WorkVersion({ id: casual.integer(1, 999), ...getMockWorkVersion() });
  });

  it("returns the WorkVersion with errors if it is not valid", async () => {
    const localValidator = jest.fn();
    (workVersion.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await workVersion.update(context);
    expect(result instanceof WorkVersion).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the updated WorkVersion", async () => {
    const localValidator = jest.fn();
    (workVersion.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(workVersion);

    const mockFindById = jest.fn();
    (WorkVersion.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(workVersion);

    const result = await workVersion.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(WorkVersion);
  });
});

describe("WorkVersion create", () => {
  const originalInsert = WorkVersion.insert;
  let insertQuery;
  let workVersion;

  beforeEach(() => {
    insertQuery = jest.fn();
    (WorkVersion.insert as jest.Mock) = insertQuery;

    workVersion = new WorkVersion(getMockWorkVersion());
  });

  afterEach(() => {
    WorkVersion.insert = originalInsert;
  });

  it("returns the WorkVersion without errors if it is valid", async () => {
    const localValidator = jest.fn();
    (workVersion.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await workVersion.create(context);
    expect(result instanceof WorkVersion).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the WorkVersion with errors if it is invalid", async () => {
    workVersion.workId = undefined;
    const response = await workVersion.create(context);
    expect(response.errors["workId"]).toBe("Work ID can't be blank");
  });

  it("returns the WorkVersion with an error if the object already exists", async () => {
    const mockFindByDoiAndHash = jest.fn();
    (WorkVersion.findByDoiAndHash as jest.Mock) = mockFindByDoiAndHash;
    mockFindByDoiAndHash.mockResolvedValueOnce(workVersion);

    const result = await workVersion.create(context);
    expect(mockFindByDoiAndHash).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors["general"]).toBeTruthy();
  });

  it("returns the newly added WorkVersion", async () => {
    const mockFindByDoiAndHash = jest.fn();
    (WorkVersion.findByDoiAndHash as jest.Mock) = mockFindByDoiAndHash;
    mockFindByDoiAndHash.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (WorkVersion.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(workVersion);

    const result = await workVersion.create(context);
    expect(mockFindByDoiAndHash).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(WorkVersion);
  });
});

describe("WorkVersion delete", () => {
  let workVersion;

  beforeEach(() => {
    workVersion = new WorkVersion({ id: casual.integer(1, 999), ...getMockWorkVersion() });
  });

  it("returns null if the WorkVersion has no id", async () => {
    workVersion.id = null;
    expect(await workVersion.delete(context)).toBe(null);
  });

  it("returns null if it was not able to delete the record", async () => {
    const deleteQuery = jest.fn();
    (WorkVersion.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await workVersion.delete(context)).toBe(null);
  });

  it("returns the WorkVersion if it was able to delete the record", async () => {
    const deleteQuery = jest.fn();
    (WorkVersion.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(workVersion);

    const mockFindById = jest.fn();
    (WorkVersion.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(workVersion);

    const result = await workVersion.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(WorkVersion);
  });
});

describe("RelatedWork", () => {
  let relatedWork: RelatedWork;

  const relatedWorkData = getMockRelatedWork();

  beforeEach(() => {
    relatedWork = new RelatedWork(relatedWorkData);
  });

  it("should initialize options as expected", () => {
    expect(relatedWork.planId).toEqual(relatedWorkData.planId);
    expect(relatedWork.workVersionId).toEqual(relatedWorkData.workVersionId);
    expect(relatedWork.sourceType).toEqual(relatedWorkData.sourceType);
    expect(relatedWork.score).toEqual(relatedWorkData.score);
    expect(relatedWork.scoreMax).toEqual(relatedWorkData.scoreMax);
    expect(relatedWork.doiMatch).toEqual(relatedWorkData.doiMatch);
    expect(relatedWork.contentMatch).toEqual(relatedWorkData.contentMatch);
    expect(relatedWork.authorMatches).toEqual(relatedWorkData.authorMatches);
    expect(relatedWork.institutionMatches).toEqual(relatedWorkData.institutionMatches);
    expect(relatedWork.funderMatches).toEqual(relatedWorkData.funderMatches);
    expect(relatedWork.awardMatches).toEqual(relatedWorkData.awardMatches);
  });

  it("should return true when calling isValid if object is valid", async () => {
    expect(await relatedWork.isValid()).toBe(true);
  });

  for (const field of ["planId", "workVersionId", "sourceType", "score", "scoreMax", "status"]) {
    it(`should return false when calling isValid if the ${field} field is missing`, async () => {
      relatedWork[field] = null;
      expect(await relatedWork.isValid()).toBe(false);
      expect(Object.keys(relatedWork.errors).length).toBe(1);
      expect(relatedWork.errors[field]).toBeTruthy();
    });
  }
});

describe("RelatedWork queries", () => {
  const originalQuery = RelatedWork.query;
  let localQuery;
  let context;

  beforeEach(async () => {
    localQuery = jest.fn();
    (RelatedWork.query as jest.Mock) = localQuery;
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    RelatedWork.query = originalQuery;
  });

  it("findById should call query with correct params and return the object", async () => {
    const relatedWork = new RelatedWork({ id: casual.integer(1, 999), ...getMockRelatedWork() });
    localQuery.mockResolvedValueOnce([relatedWork]);
    const result = await RelatedWork.findById("testing", context, relatedWork.id);
    const expectedSql = "SELECT * FROM relatedWorks WHERE id = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [relatedWork.id.toString()], "testing");
    expect(result).toEqual(relatedWork);
  });

  it("findById should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const workId = casual.integer(1, 999);
    const result = await RelatedWork.findById("testing", context, workId);
    expect(result).toEqual(null);
  });

  it("findByPlanAndWorkVersionId should call query with correct params and return the object", async () => {
    const relatedWork = new RelatedWork({ id: casual.integer(1, 999), ...getMockRelatedWork() });
    const planId = relatedWork.planId;
    const workVersionId = relatedWork.workVersionId;
    localQuery.mockResolvedValueOnce([relatedWork]);
    const result = await RelatedWork.findByPlanAndWorkVersionId("testing", context, planId, workVersionId);
    const expectedSql = "SELECT * FROM relatedWorks WHERE planId = ? AND workVersionId = ?";
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(
      context,
      expectedSql,
      [planId.toString(), workVersionId.toString()],
      "testing",
    );
    expect(result).toEqual(relatedWork);
  });

  it("findByPlanAndWorkVersionId should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const workVersionId = casual.integer(1, 999);
    const result = await RelatedWork.findByPlanAndWorkVersionId("testing", context, planId, workVersionId);
    expect(result).toEqual(null);
  });

  it("statsByPlanId should call query with correct params and return the object", async () => {
    const rw = new RelatedWork({ planId: casual.integer(1, 999), ...getMockWork() });
    localQuery.mockResolvedValueOnce([rw]);
    const result = await RelatedWork.statsByPlanId("testing", context, rw.planId);
    const expectedSql = `
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN rw.status = 'PENDING' THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN rw.status = 'ACCEPTED' THEN 1 ELSE 0 END) AS acceptedCount,
        SUM(CASE WHEN rw.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedCount
      FROM relatedWorks rw
      WHERE rw.planId = ?;
    `;
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [rw.planId.toString()], "testing");
    expect(result).toEqual(rw);
  });

  it("statsByPlanId should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const result = await RelatedWork.statsByPlanId("testing", context, planId);
    expect(result).toEqual(null);
  });
});

describe("RelatedWork update", () => {
  let updateQuery;
  let relatedWork;

  beforeEach(() => {
    updateQuery = jest.fn();
    (RelatedWork.update as jest.Mock) = updateQuery;

    relatedWork = new RelatedWork({ id: casual.integer(1, 999), ...getMockRelatedWork() });
  });

  it("returns the RelatedWork with errors if it is not valid", async () => {
    const localValidator = jest.fn();
    (relatedWork.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await relatedWork.update(context);
    expect(result instanceof RelatedWork).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the updated RelatedWork", async () => {
    const localValidator = jest.fn();
    (relatedWork.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(relatedWork);

    const mockFindById = jest.fn();
    (RelatedWork.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(relatedWork);

    const result = await relatedWork.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(RelatedWork);
  });
});

describe("RelatedWork create", () => {
  const originalInsert = RelatedWork.insert;
  let insertQuery;
  let relatedWork;

  beforeEach(() => {
    insertQuery = jest.fn();
    (RelatedWork.insert as jest.Mock) = insertQuery;
    relatedWork = new RelatedWork(getMockRelatedWork());
  });

  afterEach(() => {
    RelatedWork.insert = originalInsert;
  });

  it("returns the RelatedWork without errors if it is valid", async () => {
    const localValidator = jest.fn();
    (relatedWork.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await relatedWork.create(context);
    expect(result instanceof RelatedWork).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it("returns the RelatedWork with errors if it is invalid", async () => {
    relatedWork.planId = undefined;
    const response = await relatedWork.create(context);
    expect(response.errors["planId"]).toBe("Plan ID can't be blank");
  });

  it("returns the RelatedWork with an error if the work version does not exist", async () => {
    const mockWorkVersionFindById = jest.fn();
    (WorkVersion.findById as jest.Mock) = mockWorkVersionFindById;
    mockWorkVersionFindById.mockResolvedValueOnce(null);

    const mockPlanFindById = jest.fn();
    (Plan.findById as jest.Mock) = mockPlanFindById;
    mockPlanFindById.mockResolvedValueOnce(null);

    const mockRelatedWorkFindByPlanAndWorkVersionId = jest.fn();
    (RelatedWork.findByPlanAndWorkVersionId as jest.Mock) = mockRelatedWorkFindByPlanAndWorkVersionId;
    mockRelatedWorkFindByPlanAndWorkVersionId.mockResolvedValueOnce(relatedWork);

    const result = await relatedWork.create(context);
    expect(mockWorkVersionFindById).toHaveBeenCalledTimes(1);
    expect(mockPlanFindById).toHaveBeenCalledTimes(1);
    expect(mockRelatedWorkFindByPlanAndWorkVersionId).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(3);
    expect(result.errors["workVersion"]).toBeTruthy();
    expect(result.errors["plan"]).toBeTruthy();
    expect(result.errors["relatedWork"]).toBeTruthy();
  });

  it("returns the newly added RelatedWork", async () => {
    const mockWorkVersionFindById = jest.fn();
    (WorkVersion.findById as jest.Mock) = mockWorkVersionFindById;
    mockWorkVersionFindById.mockResolvedValueOnce(
      new WorkVersion({ id: casual.integer(1, 999), ...getMockWorkVersion() }),
    );

    const mockPlanFindById = jest.fn();
    (Plan.findById as jest.Mock) = mockPlanFindById;
    mockPlanFindById.mockResolvedValueOnce({
      id: casual.integer(1, 999),
    });

    const mockRelatedWorkFindByPlanAndWorkVersionId = jest.fn();
    (RelatedWork.findByPlanAndWorkVersionId as jest.Mock) = mockRelatedWorkFindByPlanAndWorkVersionId;
    mockRelatedWorkFindByPlanAndWorkVersionId.mockResolvedValueOnce(null);

    const mockRelatedWorkFindById = jest.fn();
    (RelatedWork.findById as jest.Mock) = mockRelatedWorkFindById;
    mockRelatedWorkFindById.mockResolvedValueOnce(
      new RelatedWork({ id: casual.integer(1, 999), ...getMockRelatedWork() }),
    );

    const result = await relatedWork.create(context);
    expect(mockWorkVersionFindById).toHaveBeenCalledTimes(1);
    expect(mockPlanFindById).toHaveBeenCalledTimes(1);
    expect(mockRelatedWorkFindByPlanAndWorkVersionId).toHaveBeenCalledTimes(1);
    expect(mockRelatedWorkFindById).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(RelatedWork);
  });
});

describe("RelatedWorkSearchResult", () => {
  let searchResult: RelatedWorkSearchResult;
  const searchResultData = getMockRelatedWorkSearchResult();

  beforeEach(() => {
    searchResult = new RelatedWorkSearchResult(searchResultData);
  });

  it("should initialize options as expected", () => {
    expect(searchResult.planId).toEqual(searchResultData.planId);
  });
});

describe("RelatedWorkSearchResult queries", () => {
  const originalQuery = RelatedWorkSearchResult.query;
  let localQuery;
  let context;

  beforeEach(async () => {
    localQuery = jest.fn();
    (RelatedWorkSearchResult.query as jest.Mock) = localQuery;
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    RelatedWorkSearchResult.query = originalQuery;
  });

  it("findById should call query with correct params and return the object", async () => {
    const relatedWork = new RelatedWorkSearchResult(getMockRelatedWorkSearchResult());
    localQuery.mockResolvedValueOnce([relatedWork]);
    const result = await RelatedWorkSearchResult.findById("testing", context, relatedWork.id);
    const expectedSql = `${RelatedWorkSearchResult.sqlStatement} WHERE rw.id = ?`;
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [relatedWork.id.toString()], "testing");
    expect(result).toEqual(relatedWork);
  });

  it("findById should return null if it finds no records", async () => {
    localQuery.mockResolvedValueOnce([]);
    const id = casual.integer(1, 999);
    const result = await RelatedWorkSearchResult.findById("testing", context, id);
    expect(result).toEqual(null);
  });
});
