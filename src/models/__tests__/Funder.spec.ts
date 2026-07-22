import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { PlanFunding, ProjectFunding, ProjectFundingStatus } from "../Funding";
import { getRandomEnumValue } from "../../__tests__/helpers";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ProjectFunding', () => {
  let projectFunding;

  const fundingData = {
    projectId: casual.integer(1, 9),
    affiliationId: casual.url,
    status: getRandomEnumValue(ProjectFundingStatus),
    funderOpportunityNumber: casual.url,
    funderProjectNumber: casual.uuid,
    grantId: casual.url,
  }
  beforeEach(() => {
    projectFunding = new ProjectFunding(fundingData);
  });

  it('should initialize options as expected', () => {
    expect(projectFunding.projectId).toEqual(fundingData.projectId);
    expect(projectFunding.affiliationId).toEqual(fundingData.affiliationId);
    expect(projectFunding.status).toEqual(fundingData.status);
    expect(projectFunding.funderOpportunityNumber).toEqual(fundingData.funderOpportunityNumber);
    expect(projectFunding.funderProjectNumber).toEqual(fundingData.funderProjectNumber);
    expect(projectFunding.grantId).toEqual(fundingData.grantId);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await projectFunding.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the projectId field is missing', async () => {
    projectFunding.projectId = null;
    expect(await projectFunding.isValid()).toBe(false);
    expect(Object.keys(projectFunding.errors).length).toBe(1);
    expect(projectFunding.errors['projectId']).toBeTruthy();
  });

  it('should return false when calling isValid if the projectId field is missing', async () => {
    projectFunding.affiliationId = null;
    expect(await projectFunding.isValid()).toBe(false);
    expect(Object.keys(projectFunding.errors).length).toBe(1);
    expect(projectFunding.errors['affiliationId']).toBeTruthy();
  });

  it('should return false when calling isValid if the projectId field is missing', async () => {
    projectFunding.status = null;
    expect(await projectFunding.isValid()).toBe(false);
    expect(Object.keys(projectFunding.errors).length).toBe(1);
    expect(projectFunding.errors['status']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = ProjectFunding.query;

  let localQuery;
  let context;
  let projectFunding;

  beforeEach(async () => {
    localQuery = jest.fn();
    (ProjectFunding.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    projectFunding = new ProjectFunding({
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      status: getRandomEnumValue(ProjectFundingStatus),
      funderOpportunityNumber: casual.url,
      funderProjectNumber: casual.uuid,
      grantId: casual.url
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    ProjectFunding.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectFunding]);
    const projectFundingId = casual.integer(1, 999);
    const result = await ProjectFunding.findById('testing', context, projectFundingId);
    const expectedSql = 'SELECT * FROM projectFundings WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectFundingId.toString()], 'testing', undefined);
    expect(result).toEqual(projectFunding);
  });

  it('findByIds should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectFunding]);
    const projectFundingId = casual.integer(1, 999);
    const result = await ProjectFunding.findByIds('testing', context, [projectFundingId]);
    const expectedSql = 'SELECT * FROM projectFundings WHERE id IN (?)';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectFundingId.toString()], 'testing', undefined)
    expect(result).toEqual([projectFunding]);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectFundingId = casual.integer(1, 999);
    const result = await ProjectFunding.findById('testing', context, projectFundingId);
    expect(result).toEqual(null);
  });

  it('findByProjectId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectFunding]);
    const projectId = casual.integer(1, 999);
    const result = await ProjectFunding.findByProjectId('testing', context, projectId);
    const expectedSql = 'SELECT * FROM projectFundings WHERE projectId = ? ORDER BY created DESC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'testing', undefined);
    expect(result).toEqual([projectFunding]);
  });

  it('findByProjectId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await ProjectFunding.findByProjectId('testing', context, projectId);
    expect(result).toEqual([]);
  });

  it('findByAffiliation should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectFunding]);
    const affiliationId = casual.url;
    const result = await ProjectFunding.findByAffiliation('testing', context, affiliationId);
    const expectedSql = 'SELECT * FROM projectFundings WHERE affiliationId = ? ORDER BY created DESC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliationId], 'testing', undefined);
    expect(result).toEqual([projectFunding]);
  });

  it('findByAffiliation should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const affiliationId = casual.url;
    const result = await ProjectFunding.findByAffiliation('testing', context, affiliationId);
    expect(result).toEqual([]);
  });

  it('findByProjectAndAffiliation should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([projectFunding]);
    const projectId = casual.integer(1, 999);
    const email = casual.email;
    const result = await ProjectFunding.findByProjectAndAffiliation('testing', context, projectId, email);
    const expectedSql = 'SELECT * FROM projectFundings WHERE projectId = ? AND affiliationId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString(), email], 'testing', undefined);
    expect(result).toEqual(projectFunding);
  });

  it('findByProjectAndAffiliation should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const email = casual.email;
    const result = await ProjectFunding.findByProjectAndAffiliation('testing', context, projectId, email);
    expect(result).toEqual(null);
  });
});

describe('update', () => {
  let updateQuery;
  let projectFunding;

  beforeEach(() => {
    updateQuery = jest.fn();
    (ProjectFunding.update as jest.Mock) = updateQuery;

    projectFunding = new ProjectFunding({
      id: casual.integer(1, 9999),
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      status: getRandomEnumValue(ProjectFundingStatus),
      funderOpportunityNumber: casual.url,
      funderProjectNumber: casual.uuid,
      grantId: casual.url
    })
  });

  it('returns the ProjectFunding with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (projectFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await projectFunding.update(context);
    expect(result).toBeInstanceOf(ProjectFunding);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the ProjectFunding has no id', async () => {
    const localValidator = jest.fn();
    (projectFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    projectFunding.id = null;
    const result = await projectFunding.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated ProjectFunding', async () => {
    const localValidator = jest.fn();
    (projectFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(projectFunding);

    const mockFindById = jest.fn();
    (ProjectFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(projectFunding);

    const result = await projectFunding.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectFunding);
  });
});

describe('create', () => {
  const originalInsert = ProjectFunding.insert;
  let insertQuery;
  let projectFunding;

  beforeEach(() => {
    insertQuery = jest.fn();
    (ProjectFunding.insert as jest.Mock) = insertQuery;

    projectFunding = new ProjectFunding({
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      status: getRandomEnumValue(ProjectFundingStatus),
      funderOpportunityNumber: casual.url,
      funderProjectNumber: casual.uuid,
      grantId: casual.url
    });
  });

  afterEach(() => {
    ProjectFunding.insert = originalInsert;
  });

  it('returns the ProjectFunding without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (projectFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await projectFunding.create(context);
    expect(result).toBeInstanceOf(ProjectFunding);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the ProjectFunding with errors if it is invalid', async () => {
    projectFunding.projectId = undefined;
    const response = await projectFunding.create(context);
    expect(response.errors['projectId']).toBe('Project can\'t be blank');
  });

  it('returns the ProjectFunding with an error if the question already exists', async () => {
    const mockFindBy = jest.fn();
    (ProjectFunding.findByProjectAndAffiliation as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(projectFunding);

    const result = await projectFunding.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added ProjectFunding', async () => {
    const mockFindBy = jest.fn();
    (ProjectFunding.findByProjectAndAffiliation as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (ProjectFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(projectFunding);

    const result = await projectFunding.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectFunding);
  });
});

describe('delete', () => {
  let projectFunding;

  beforeEach(() => {
    projectFunding = new ProjectFunding({
      id: casual.integer(1, 9999),
      projectId: casual.integer(1, 999),
      affiliationId: casual.url,
      status: getRandomEnumValue(ProjectFundingStatus),
      funderOpportunityNumber: casual.url,
      funderProjectNumber: casual.uuid,
      grantId: casual.url
    });
  })

  it('returns null if the ProjectFunding has no id', async () => {
    projectFunding.id = null;
    expect(await projectFunding.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (ProjectFunding.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await projectFunding.delete(context)).toBe(null);
  });

  it('returns the ProjectFunding if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (ProjectFunding.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(projectFunding);

    const mockFindById = jest.fn();
    (ProjectFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(projectFunding);

    const result = await projectFunding.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(ProjectFunding);
  });
});

describe('PlanFunding', () => {
  let planFunding;

  const fundingData = {
    createdById: casual.integer(1, 999),
    planId: casual.integer(1, 9),
    projectFundingId: casual.integer(1, 999),
  }
  beforeEach(() => {
    planFunding = new PlanFunding(fundingData);
  });

  it('should initialize options as expected', () => {
    expect(planFunding.planId).toEqual(fundingData.planId);
    expect(planFunding.projectFundingId).toEqual(fundingData.projectFundingId);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await planFunding.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the planId field is missing', async () => {
    planFunding.planId = null;
    expect(await planFunding.isValid()).toBe(false);
    expect(Object.keys(planFunding.errors).length).toBe(1);
    expect(planFunding.errors['planId']).toBeTruthy();
  });

  it('should return false when calling isValid if the projectFundingId field is missing', async () => {
    planFunding.projectFundingId = null;
    expect(await planFunding.isValid()).toBe(false);
    expect(Object.keys(planFunding.errors).length).toBe(1);
    expect(planFunding.errors['projectFundingId']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = PlanFunding.query;

  let localQuery;
  let context;
  let planFunding;

  beforeEach(async () => {
    localQuery = jest.fn();
    (PlanFunding.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    planFunding = new PlanFunding({
      planId: casual.integer(1, 999),
      projectFundingId: casual.url,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PlanFunding.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planFunding]);
    const planFundingId = casual.integer(1, 999);
    const result = await PlanFunding.findById('testing', context, planFundingId);
    const expectedSql = 'SELECT * FROM planFundings WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planFundingId.toString()], 'testing', undefined);
    expect(result).toEqual(planFunding);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planFundingId = casual.integer(1, 999);
    const result = await PlanFunding.findById('testing', context, planFundingId);
    expect(result).toEqual(null);
  });

  it('findByPlanId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planFunding]);
    const projectId = casual.integer(1, 999);
    const result = await PlanFunding.findByPlanId('testing', context, projectId);
    const expectedSql = 'SELECT * FROM planFundings WHERE planId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'testing', undefined);
    expect(result).toEqual([planFunding]);
  });

  it('findByPlanId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await PlanFunding.findByPlanId('testing', context, projectId);
    expect(result).toEqual([]);
  });

  it('findByPlanAndProjectFundingId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([planFunding]);
    const planId = casual.integer(1, 999);
    const projectFundingId = casual.integer(1, 999);
    const result = await PlanFunding.findByPlanAndProjectFundingId('testing', context, planId, projectFundingId);
    const expectedSql = 'SELECT * FROM planFundings WHERE planId = ? AND projectFundingId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    const vals = [planId.toString(), projectFundingId.toString()];
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, vals, 'testing', undefined);
    expect(result).toEqual(planFunding);
  });

  it('findByPlanAndProjectFundingId should return empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const projectFundingId = casual.integer(1, 999);
    const result = await PlanFunding.findByPlanAndProjectFundingId('testing', context, planId, projectFundingId);
    expect(result).toEqual(null);
  });
});

describe('update', () => {
  let updateQuery;
  let planFunding;

  beforeEach(() => {
    updateQuery = jest.fn();
    (PlanFunding.update as jest.Mock) = updateQuery;

    planFunding = new PlanFunding({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 999),
      projectFundingId: casual.integer(1, 999),
    })
  });

  it('returns the PlanFunding with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (planFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFunding.update(context);
    expect(result).toBeInstanceOf(PlanFunding);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the PlanFunding has no id', async () => {
    const localValidator = jest.fn();
    (planFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    planFunding.id = null;
    const result = await planFunding.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated PlanFunding', async () => {
    const localValidator = jest.fn();
    (planFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(planFunding);

    const mockFindById = jest.fn();
    (PlanFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFunding);

    const result = await planFunding.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFunding);
  });
});

describe('create', () => {
  const originalInsert = PlanFunding.insert;
  let insertQuery;
  let planFunding;

  beforeEach(() => {
    insertQuery = jest.fn();
    (PlanFunding.insert as jest.Mock) = insertQuery;

    planFunding = new PlanFunding({
      planId: casual.integer(1, 999),
      projectFundingId: casual.integer(1, 999),
    });
  });

  afterEach(() => {
    PlanFunding.insert = originalInsert;
  });

  it('returns the PlanFunding without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (planFunding.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFunding.create(context);
    expect(result).toBeInstanceOf(PlanFunding);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the PlanFunding with errors if it is invalid', async () => {
    planFunding.planId = undefined;
    const response = await planFunding.create(context);
    expect(response.errors['planId']).toBe('Plan can\'t be blank');
  });

  it('returns the PlanFunding with an error if the question already exists', async () => {
    const mockFindBy = jest.fn();
    (PlanFunding.findByPlanAndProjectFundingId as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(planFunding);

    const result = await planFunding.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added PlanFunding', async () => {
    const mockFindBy = jest.fn();
    (PlanFunding.findByPlanAndProjectFundingId as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);

    const mockFindById = jest.fn();
    (PlanFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFunding);

    const result = await planFunding.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFunding);
  });
});

describe('delete', () => {
  let planFunding;

  beforeEach(() => {
    planFunding = new PlanFunding({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 999),
      projectFundingId: casual.integer(1, 999),
    });
  })

  it('returns null if the PlanFunding has no id', async () => {
    planFunding.id = null;
    expect(await planFunding.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFunding.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await planFunding.delete(context)).toBe(null);
  });

  it('returns the PlanFunding if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFunding.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(planFunding);

    const mockFindById = jest.fn();
    (PlanFunding.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFunding);

    const result = await planFunding.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFunding);
  });
});
