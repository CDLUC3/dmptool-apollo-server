import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { PlanFeedback } from "../PlanFeedback";
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

describe('PlanFeedback', () => {
  let planFeedback;

  const planFeedbackData = {
    planId: casual.integer(1, 9999),
    requested: casual.date(),
    requestedById: 1,
    completed: casual.date(),
    completedById: 1,
    summaryText: casual.sentence,
  }

  beforeEach(() => {
    planFeedback = new PlanFeedback(planFeedbackData);
  });

  it('should initialize options as expected', () => {
    expect(planFeedback.planId).toEqual(planFeedbackData.planId);
    expect(planFeedback.requested).toEqual(planFeedbackData.requested);
    expect(planFeedback.requestedById).toEqual(planFeedbackData.requestedById);
    expect(planFeedback.completed).toEqual(planFeedbackData.completed);
    expect(planFeedback.completedById).toEqual(planFeedbackData.completedById);
    expect(planFeedback.summaryText).toEqual(planFeedbackData.summaryText);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await planFeedback.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the requestedById field is missing', async () => {
    planFeedback.requestedById = null;
    expect(await planFeedback.isValid()).toBe(false);
    expect(Object.keys(planFeedback.errors).length).toBe(1);
    expect(planFeedback.errors['requestedById']).toBeTruthy();
  });

  it('should return false when calling isValid if the requested field is missing', async () => {
    planFeedback.requested = null;
    expect(await planFeedback.isValid()).toBe(false);
    expect(Object.keys(planFeedback.errors).length).toBe(1);
    expect(planFeedback.errors['requested']).toBeTruthy();
  });

  it('should return false when calling isValid if the planId field is missing', async () => {
    planFeedback.planId = null;
    expect(await planFeedback.isValid()).toBe(false);
    expect(Object.keys(planFeedback.errors).length).toBe(1);
    expect(planFeedback.errors['planId']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = PlanFeedback.query;

  let localQuery;
  let context;
  let planFeedback;

  beforeEach(async () => {
    localQuery = jest.fn();
    (PlanFeedback.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    planFeedback = new PlanFeedback({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      requested: casual.date(),
      requestedById: 1,
      completed: casual.date(),
      completedById: 1,
      summaryText: casual.sentence,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PlanFeedback.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([planFeedback]);
    const feedbackId = casual.integer(1, 999);
    const result = await PlanFeedback.findById('testing', context, feedbackId);
    const expectedSql = 'SELECT * FROM feedback WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [feedbackId.toString()], 'testing')
    expect(result).toEqual(planFeedback);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const feedbackId = casual.integer(1, 999);
    const result = await PlanFeedback.findById('testing', context, feedbackId);
    expect(result).toEqual(null);
  });

  it('findByPlanIdAndRequestedById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([planFeedback]);
    const planId = casual.integer(1, 9999);
    const requestedById = casual.integer(1, 9999);
    const result = await PlanFeedback.findByPlanIdAndRequestedById('testing', context, planId, requestedById);
    const expectedSql = 'SELECT * FROM feedback WHERE planId = ? AND requestedById = ?';
    const expectedVals = [planId.toString(), requestedById.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, expectedVals, 'testing')
    expect(result).toEqual([planFeedback]);
  });

  it('findByPlanIdAndRequestedById should return empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const requestedById = casual.integer(1, 9999);
    const result = await PlanFeedback.findByPlanIdAndRequestedById('testing', context, planId, requestedById);
    expect(result).toEqual([]);
  });

  it('findByPlanId should call query with correct params and return the objects', async () => {
    localQuery.mockResolvedValueOnce([planFeedback]);
    const planId = casual.integer(1, 9999);
    const result = await PlanFeedback.findByPlanId('testing', context, planId);
    const expectedSql = 'SELECT * FROM feedback WHERE planId = ?';
    const vals = [planId.toString()];
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, vals, 'testing')
    expect(result).toEqual([planFeedback]);
  });

  it('findByPlanId should return an empty array if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const result = await PlanFeedback.findByPlanId('testing', context, planId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let planFeedback;

  beforeEach(() => {
    updateQuery = jest.fn();
    (PlanFeedback.update as jest.Mock) = updateQuery;

    planFeedback = new PlanFeedback({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      requested: casual.date(),
      requestedById: 1,
      completed: casual.date(),
      completedById: 1,
      summaryText: casual.sentence,
    });
  });

  it('returns the PlanFeedback with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (planFeedback.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFeedback.update(context);
    expect(result instanceof PlanFeedback).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Answer has no id', async () => {
    const localValidator = jest.fn();
    (planFeedback.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    planFeedback.id = null;
    const result = await planFeedback.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated PlanFeedback', async () => {
    const localValidator = jest.fn();
    (planFeedback.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(planFeedback);

    const mockFindById = jest.fn();
    (PlanFeedback.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedback);

    const result = await planFeedback.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedback);
  });
});

describe('create', () => {
  const originalInsert = PlanFeedback.insert;
  let insertQuery;
  let planFeedback;

  beforeEach(() => {
    insertQuery = jest.fn();
    insertQuery.mockResolvedValueOnce({ insertId: 123 });
    (PlanFeedback.insert as jest.Mock) = insertQuery;

    planFeedback = new PlanFeedback({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      requested: casual.date(),
      requestedById: 1,
      completed: casual.date(),
      completedById: 1,
      summaryText: casual.sentence,
    });
  });

  afterEach(() => {
    PlanFeedback.insert = originalInsert;
  });

  it('returns the PlanFeedback without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (planFeedback.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFeedback.create(context);
    expect(result instanceof PlanFeedback).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the PlanFeedback with errors if it is invalid', async () => {
    planFeedback.planId = undefined;
    const response = await planFeedback.create(context);
    expect(response.errors['planId']).toBe('Plan can\'t be blank');
  });

  it('returns the newly added PlanFeedback', async () => {
    const mockFindById = jest.fn();
    (PlanFeedback.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedback);
    const result = await planFeedback.create(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedback);
  });
});

describe('delete', () => {
  let planFeedback;

  beforeEach(() => {
    planFeedback = new PlanFeedback({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      requested: casual.date(),
      requestedById: 1,
      completed: casual.date(),
      completedById: 1,
      summaryText: casual.sentence,
    });
  })

  it('returns null if the PlanFeedback has no id', async () => {
    planFeedback.id = null;
    expect(await planFeedback.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFeedback.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await planFeedback.delete(context)).toBe(null);
  });

  it('returns the PlanFeedback if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFeedback.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(planFeedback);

    const mockFindById = jest.fn();
    (PlanFeedback.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedback);

    const result = await planFeedback.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedback);
  });
});

describe('statusForPlan', () => {
  const originalQuery = PlanFeedback.query;
  let localQuery;
  let context;

  beforeEach(async () => {
    localQuery = jest.fn();
    (PlanFeedback.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    PlanFeedback.query = originalQuery;
    jest.clearAllMocks();
  });

  it('returns NONE when there are no feedback rows', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 9999);
    const result = await PlanFeedback.statusForPlan('testing', context, planId);
    const expectedSql = 'SELECT COUNT(*) as total, SUM(completed IS NULL) as open FROM feedback WHERE planId = ?';

    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString()], 'testing');
    expect(result).toEqual('NONE');
  });

  it('returns REQUESTED when there is at least one open feedback (completed IS NULL)', async () => {
    // simulate SQL returning counts as strings (like DB drivers often do)
    localQuery.mockResolvedValueOnce([{ total: '2', open: '1' }]);
    const planId = casual.integer(1, 9999);
    const result = await PlanFeedback.statusForPlan('testing', context, planId);
    expect(result).toEqual('REQUESTED');
  });

  it('returns COMPLETED when all feedback rows are completed', async () => {
    localQuery.mockResolvedValueOnce([{ total: '3', open: '0' }]);
    const planId = casual.integer(1, 9999);
    const result = await PlanFeedback.statusForPlan('testing', context, planId);
    expect(result).toEqual('COMPLETED');
  });
});
