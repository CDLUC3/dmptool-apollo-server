import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { PlanFeedbackComment } from "../PlanFeedbackComment";
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

describe('PlanFeedbackComment', () => {
  let planFeedbackComment;

  const planFeedbackCommentData = {
    answerId: casual.integer(1, 9999),
    feedbackId: casual.integer(1, 9999),
    commentText: casual.sentences(3),
  }
  beforeEach(() => {
    planFeedbackComment = new PlanFeedbackComment(planFeedbackCommentData);
  });

  it('should initialize options as expected', () => {
    expect(planFeedbackComment.answerId).toEqual(planFeedbackCommentData.answerId);
    expect(planFeedbackComment.feedbackId).toEqual(planFeedbackCommentData.feedbackId);
    expect(planFeedbackComment.commentText).toEqual(planFeedbackCommentData.commentText);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await planFeedbackComment.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the feedbackId field is missing', async () => {
    planFeedbackComment.feedbackId = null;
    expect(await planFeedbackComment.isValid()).toBe(false);
    expect(Object.keys(planFeedbackComment.errors).length).toBe(1);
    expect(planFeedbackComment.errors['feedbackId']).toBeTruthy();
  });

  it('should return false when calling isValid if the commentText field is missing', async () => {
    planFeedbackComment.commentText = null;
    expect(await planFeedbackComment.isValid()).toBe(false);
    expect(Object.keys(planFeedbackComment.errors).length).toBe(1);
    expect(planFeedbackComment.errors['commentText']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = PlanFeedbackComment.query;

  let localQuery;
  let context;
  let planFeedbackComment;

  beforeEach(async () => {
    localQuery = jest.fn();
    (PlanFeedbackComment.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    planFeedbackComment = new PlanFeedbackComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      feebackId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    PlanFeedbackComment.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([planFeedbackComment]);
    const planFeedbackCommentId = casual.integer(1, 999);
    const result = await PlanFeedbackComment.findById('testing', context, planFeedbackCommentId);
    const expectedSql = 'SELECT * FROM feedbackComments WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planFeedbackCommentId.toString()], 'testing');
    expect(result).toEqual(planFeedbackComment);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const feedbackCommentId = casual.integer(1, 999);
    const result = await PlanFeedbackComment.findById('testing', context, feedbackCommentId);
    expect(result).toEqual(null);
  });

  it('findByFeedbackId should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([planFeedbackComment]);
    const feedbackId = casual.integer(1, 9999);
    const result = await PlanFeedbackComment.findByFeedbackId('testing', context, feedbackId);
    const expectedSql = 'SELECT * FROM feedbackComments WHERE feedbackId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [feedbackId.toString()], 'testing');
    expect(result).toEqual([planFeedbackComment]);
  });

  it('findByFeedbackId should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const feedbackId = casual.integer(1, 9999);
    const result = await PlanFeedbackComment.findByAnswerId('testing', context, feedbackId);
    expect(result).toEqual([]);
  });

  it('findByAnswerId should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([planFeedbackComment]);
    const answerId = casual.integer(1, 9999);
    const result = await PlanFeedbackComment.findByAnswerId('testing', context, answerId);
    const expectedSql = 'SELECT * FROM feedbackComments WHERE answerId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [answerId.toString()], 'testing');
    expect(result).toEqual([planFeedbackComment]);
  });

  it('findByAnswerId should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const answerId = casual.integer(1, 9999);
    const result = await PlanFeedbackComment.findByAnswerId('testing', context, answerId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let planFeedbackComment;

  beforeEach(() => {
    updateQuery = jest.fn();
    (PlanFeedbackComment.update as jest.Mock) = updateQuery;

    planFeedbackComment = new PlanFeedbackComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      feebackId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  });

  it('returns the PlanFeedbackComment with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (planFeedbackComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFeedbackComment.update(context);
    expect(result instanceof PlanFeedbackComment).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the PlanFeedbackComment has no id', async () => {
    const localValidator = jest.fn();
    (planFeedbackComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    planFeedbackComment.id = null;
    const result = await planFeedbackComment.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated AnswerComment', async () => {
    const localValidator = jest.fn();
    (planFeedbackComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(planFeedbackComment);

    const mockFindById = jest.fn();
    (PlanFeedbackComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedbackComment);

    const result = await planFeedbackComment.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedbackComment);
  });
});

describe('create', () => {
  const originalInsert = PlanFeedbackComment.insert;
  let insertQuery;
  let planFeedbackComment;

  beforeEach(() => {
    insertQuery = jest.fn();
    (PlanFeedbackComment.insert as jest.Mock) = insertQuery;

    planFeedbackComment = new PlanFeedbackComment({
      id: casual.integer(1, 9999),
      answerId: 20,
      feebackId: 10,
      commentText: "Test comment"
    });
  });

  afterEach(() => {
    PlanFeedbackComment.insert = originalInsert;
  });

  it('returns the PlanFeedbackComment without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (planFeedbackComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await planFeedbackComment.create(context);
    expect(result instanceof PlanFeedbackComment).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the PlanFeedbackComment with errors if it is invalid', async () => {
    planFeedbackComment.feedbackId = undefined;
    const response = await planFeedbackComment.create(context);
    expect(response.errors['feedbackId']).toBe('Feedback can\'t be blank');
  });

  it('returns the newly added PlanFeedbackComment', async () => {
    const mockFindById = jest.fn();
    (PlanFeedbackComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedbackComment);
    planFeedbackComment.feedbackId = 20;
    const result = await planFeedbackComment.create(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedbackComment);
  });
});

describe('delete', () => {
  let planFeedbackComment;

  beforeEach(() => {
    planFeedbackComment = new PlanFeedbackComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      feebackId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  })

  it('returns null if the PlanFeedbackComment has no id', async () => {
    planFeedbackComment.id = null;
    expect(await planFeedbackComment.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFeedbackComment.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await planFeedbackComment.delete(context)).toBe(null);
  });

  it('returns the PlanFeedbackComment if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (PlanFeedbackComment.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(planFeedbackComment);

    const mockFindById = jest.fn();
    (PlanFeedbackComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(planFeedbackComment);

    const result = await planFeedbackComment.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(PlanFeedbackComment);
  });
});
