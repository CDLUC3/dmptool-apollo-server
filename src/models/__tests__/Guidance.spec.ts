import casual from "casual";
import { Guidance, PlanGuidance } from "../Guidance";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

jest.mock('../../context.ts');

describe('Guidance', () => {
  let guidance;
  const guidanceData = {
    guidanceGroupId: casual.integer(1, 100),
    guidanceText: 'This is guidance text',
  }

  beforeEach(() => {
    guidance = new Guidance(guidanceData);
  });

  it('should initialize options as expected', () => {
    expect(guidance.id).toBeFalsy();
    expect(guidance.guidanceGroupId).toEqual(guidanceData.guidanceGroupId);
    expect(guidance.guidanceText).toEqual(guidanceData.guidanceText);
    expect(guidance.created).toBeTruthy();
    expect(guidance.modified).toBeTruthy();
    expect(guidance.errors).toEqual({});
  });

  it('should return true when calling isValid with required fields', async () => {
    expect(await guidance.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a guidanceGroupId field', async () => {
    guidance.guidanceGroupId = null;
    expect(await guidance.isValid()).toBe(false);
    expect(Object.keys(guidance.errors).length).toBe(1);
    expect(guidance.errors['guidanceGroupId']).toBeTruthy();
  });
});

describe('Guidance.findByGuidanceGroupId', () => {
  const originalQuery = Guidance.query;

  let localQuery;
  let context;
  let guidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Guidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    guidance = new Guidance({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      guidanceGroupId: casual.integer(1, 100),
      guidanceText: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Guidance.query = originalQuery;
  });

  it('should call query with correct params and return the guidance items', async () => {
    localQuery.mockResolvedValueOnce([guidance]);
    const result = await Guidance.findByGuidanceGroupId('Guidance query', context, guidance.guidanceGroupId);
    const expectedSql = 'SELECT * FROM guidance WHERE guidanceGroupId = ? ORDER BY id ASC';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [guidance.guidanceGroupId.toString()], 'Guidance query');
    expect(result.length).toBe(1);
    expect(result[0].id).toEqual(guidance.id);
  });

  it('should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await Guidance.findByGuidanceGroupId('Guidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(0);
  });
});

describe('Guidance.findById', () => {
  const originalQuery = Guidance.query;

  let localQuery;
  let context;
  let guidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Guidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    guidance = new Guidance({
      id: casual.integer(1, 9),
      createdById: casual.integer(1, 999),
      guidanceGroupId: casual.integer(1, 100),
      guidanceText: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Guidance.query = originalQuery;
  });

  it('should call query with correct params and return the guidance', async () => {
    localQuery.mockResolvedValueOnce([guidance]);
    const result = await Guidance.findById('Guidance query', context, guidance.id);
    const expectedSql = 'SELECT * FROM guidance WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [guidance.id.toString()], 'Guidance query');
    expect(result.id).toEqual(guidance.id);
  });

  it('should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await Guidance.findById('Guidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});

describe('PlanGuidance', () => {
  let planGuidance;
  const planGuidanceData = {
    planId: casual.integer(1, 100),
    affiliationId: casual.uuid,
    userId: casual.integer(1, 1000),
  };

  beforeEach(() => {
    planGuidance = new PlanGuidance(planGuidanceData);
  });

  it('should initialize options as expected', () => {
    expect(planGuidance.id).toBeFalsy();
    expect(planGuidance.planId).toEqual(planGuidanceData.planId);
    expect(planGuidance.affiliationId).toEqual(planGuidanceData.affiliationId);
    expect(planGuidance.userId).toEqual(planGuidanceData.userId);
    expect(planGuidance.created).toBeTruthy();
    expect(planGuidance.modified).toBeTruthy();
    expect(planGuidance.errors).toEqual({});
  });

  it('should return true when calling isValid with required fields', async () => {
    expect(await planGuidance.isValid()).toBe(true);
  });

  it('should return false when calling isValid without a planId', async () => {
    planGuidance.planId = null;
    expect(await planGuidance.isValid()).toBe(false);
    expect(planGuidance.errors['planId']).toBeTruthy();
  });

  it('should return false when calling isValid without an affiliationId', async () => {
    planGuidance.affiliationId = null;
    expect(await planGuidance.isValid()).toBe(false);
    expect(planGuidance.errors['affiliationId']).toBeTruthy();
  });

  it('should return false when calling isValid without a userId', async () => {
    planGuidance.userId = null;
    expect(await planGuidance.isValid()).toBe(false);
    expect(planGuidance.errors['userId']).toBeTruthy();
  });
});

describe('PlanGuidance static methods', () => {
  const originalQuery = PlanGuidance.query;

  let localQuery;
  let context;
  let planGuidance;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (PlanGuidance.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    planGuidance = new PlanGuidance({
      id: casual.integer(1, 9),
      planId: casual.integer(1, 100),
      affiliationId: casual.uuid,
      userId: casual.integer(1, 1000),
      createdById: casual.integer(1, 999),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PlanGuidance.query = originalQuery;
  });

  it('findById should call query with correct params and return the plan guidance', async () => {
    localQuery.mockResolvedValueOnce([planGuidance]);
    const result = await PlanGuidance.findById('PlanGuidance query', context, planGuidance.id);
    const expectedSql = 'SELECT * FROM planGuidance WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenCalledWith(context, expectedSql, [planGuidance.id.toString()], 'PlanGuidance query');
    expect(result.id).toEqual(planGuidance.id);
  });

  it('findById should return null if no record is found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await PlanGuidance.findById('PlanGuidance query', context, 999);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('findByPlanAndAffiliation should return the correct plan guidance', async () => {
    localQuery.mockResolvedValueOnce([planGuidance]);
    const result = await PlanGuidance.findByPlanAndAffiliation('PlanGuidance query', context, planGuidance.planId, planGuidance.affiliationId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(result.planId).toEqual(planGuidance.planId);
    expect(result.affiliationId).toEqual(planGuidance.affiliationId);
  });

  it('findByPlanAndAffiliation should return null if not found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await PlanGuidance.findByPlanAndAffiliation('PlanGuidance query', context, 1, 'notfound');
    expect(result).toBeNull();
  });

  it('findByPlanUserAndAffiliation should return an array of plan guidance', async () => {
    localQuery.mockResolvedValueOnce([planGuidance]);
    const result = await PlanGuidance.findByPlanUserAndAffiliation('PlanGuidance query', context, planGuidance.planId, planGuidance.userId, planGuidance.affiliationId);
    expect(result).not.toBeNull();    
    expect(result.planId).toEqual(planGuidance.planId);
    expect(result.userId).toEqual(planGuidance.userId);
    expect(result.affiliationId).toEqual(planGuidance.affiliationId);
  });

  it('findByPlanUserAndAffiliation should return null if not found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await PlanGuidance.findByPlanUserAndAffiliation('PlanGuidance query', context, 1, 2, 'notfound');
    expect(result).toBeNull();
  });

  it('findByPlanAndUserId should return an array of PlanGuidance when records are found', async () => {
    localQuery.mockResolvedValueOnce([planGuidance]);
    const result = await PlanGuidance.findByPlanAndUserId('PlanGuidance query', context, planGuidance.planId, planGuidance.userId);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].planId).toEqual(planGuidance.planId);
    expect(result[0].userId).toEqual(planGuidance.userId);
  });

  it('findByPlanAndUserId should return an empty array if no records are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const result = await PlanGuidance.findByPlanAndUserId('PlanGuidance query', context, 1, 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
