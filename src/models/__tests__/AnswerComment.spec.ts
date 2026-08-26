import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context.js";

import { AnswerComment } from "../AnswerComment";
import { logger } from "../../logger.js";

jest.mock('../../context.js');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AnswerComment', () => {
  let answerComment;

  const answerCommentData = {
    answerId: casual.integer(1, 9999),
    commentText: casual.sentences(3),
  }
  beforeEach(() => {
    answerComment = new AnswerComment(answerCommentData);
  });

  it('should initialize options as expected', () => {
    expect(answerComment.answerId).toEqual(answerCommentData.answerId);
    expect(answerComment.commentText).toEqual(answerCommentData.commentText);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await answerComment.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the answerId field is missing', async () => {
    answerComment.answerId = null;
    expect(await answerComment.isValid()).toBe(false);
    expect(Object.keys(answerComment.errors).length).toBe(1);
    expect(answerComment.errors['answerId']).toBeTruthy();
  });

  it('should return false when calling isValid if the commentText field is missing', async () => {
    answerComment.commentText = null;
    expect(await answerComment.isValid()).toBe(false);
    expect(Object.keys(answerComment.errors).length).toBe(1);
    expect(answerComment.errors['commentText']).toBeTruthy();
  });
});

describe('findBy Queries', () => {
  const originalQuery = AnswerComment.query;

  let localQuery;
  let context;
  let answerComment;

  beforeEach(async () => {
    localQuery = jest.fn();
    (AnswerComment.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    answerComment = new AnswerComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    AnswerComment.query = originalQuery;
  });

  it('findById should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([answerComment]);
    const answerCommentId = casual.integer(1, 999);
    const result = await AnswerComment.findById('testing', context, answerCommentId);
    const expectedSql = 'SELECT * FROM answerComments WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [answerCommentId.toString()], 'testing');
    expect(result).toEqual(answerComment);
  });

  it('findById should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const answerCommentId = casual.integer(1, 999);
    const result = await AnswerComment.findById('testing', context, answerCommentId);
    expect(result).toEqual(null);
  });

  it('findByAnswerId should call query with correct params and return the object', async () => {
    localQuery.mockResolvedValueOnce([answerComment]);
    const answerId = casual.integer(1, 9999);
    const result = await AnswerComment.findByAnswerId('testing', context, answerId);
    const expectedSql = 'SELECT * FROM answerComments WHERE answerId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [answerId.toString()], 'testing');
    expect(result).toEqual([answerComment]);
  });

  it('findByAnswerId should return null if it finds no records', async () => {
    localQuery.mockResolvedValueOnce([]);
    const answerId = casual.integer(1, 9999);
    const result = await AnswerComment.findByAnswerId('testing', context, answerId);
    expect(result).toEqual([]);
  });
});

describe('update', () => {
  let updateQuery;
  let answerComment;

  beforeEach(() => {
    updateQuery = jest.fn();
    (AnswerComment.update as jest.Mock) = updateQuery;

    answerComment = new AnswerComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    })
  });

  it('returns the AnswerComment with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (answerComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await answerComment.update(context);
    expect(result instanceof AnswerComment).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the AnswerComment has no id', async () => {
    const localValidator = jest.fn();
    (answerComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    answerComment.id = null;
    const result = await answerComment.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated AnswerComment', async () => {
    const localValidator = jest.fn();
    (answerComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    updateQuery.mockResolvedValueOnce(answerComment);

    const mockFindById = jest.fn();
    (AnswerComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answerComment);

    const result = await answerComment.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(AnswerComment);
  });
});

describe('create', () => {
  const originalInsert = AnswerComment.insert;
  let insertQuery;
  let answerComment;

  beforeEach(() => {
    insertQuery = jest.fn();
    (AnswerComment.insert as jest.Mock) = insertQuery;

    answerComment = new AnswerComment({
      answerId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  });

  afterEach(() => {
    AnswerComment.insert = originalInsert;
  });

  it('returns the AnswerComment without errors if it is valid', async () => {
    const localValidator = jest.fn();
    (answerComment.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await answerComment.create(context);
    expect(result instanceof AnswerComment).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns the AnswerComment with errors if it is invalid', async () => {
    answerComment.answerId = undefined;
    const response = await answerComment.create(context);
    expect(response.errors['answerId']).toBe('Answer can\'t be blank');
  });

  it('returns the newly added AnswerComment', async () => {
    const mockFindById = jest.fn();
    (AnswerComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answerComment);

    const result = await answerComment.create(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(AnswerComment);
  });
});

describe('delete', () => {
  let answerComment;

  beforeEach(() => {
    answerComment = new AnswerComment({
      id: casual.integer(1, 9999),
      answerId: casual.integer(1, 9999),
      commentText: casual.sentences(3),
    });
  })

  it('returns null if the AnswerComment has no id', async () => {
    answerComment.id = null;
    expect(await answerComment.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (AnswerComment.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await answerComment.delete(context)).toBe(null);
  });

  it('returns the AnswerComment if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (AnswerComment.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(answerComment);

    const mockFindById = jest.fn();
    (AnswerComment.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(answerComment);

    const result = await answerComment.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(AnswerComment);
  });
});
