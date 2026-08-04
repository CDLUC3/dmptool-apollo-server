import casual from "casual";
import { Tag } from "../Tag";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";

let context;
jest.mock('../../context.ts');


describe('Tag', () => {
  let tag;
  const tagData = {
    name: 'Henry',
    description: 'This is a description'
  }
  beforeEach(() => {
    tag = new Tag(tagData);
  });

  it('should initialize options as expected', () => {
    expect(tag.name).toEqual(tagData.name);
    expect(tag.description).toEqual(tagData.description);
  });
});


describe('create', () => {
  const originalInsert = Tag.insert;
  const originalfindBySlug = Tag.findBySlug;
  const originalfindById = Tag.findById
  let insertQuery;
  let tag;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();


    insertQuery = jest.fn();
    (Tag.insert as jest.Mock) = insertQuery;

    tag = new Tag({
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    Tag.insert = originalInsert;
    Tag.findBySlug = originalfindBySlug;
    Tag.findById = originalfindById;
  });

  it('returns the Tag with an error if the tag already exists', async () => {
    const mockFindBy = jest.fn();
    (Tag.findBySlug as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(tag);

    const result = await tag.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });
  it('returns the newly added Tag', async () => {
    const mockFindBy = jest.fn();
    context = {
      token: {
        id: 1,
        email: 'test@test.com',
        givenName: 'henry',
        surName: 'smith',
        role: 'admin',
      }
      // Add other required properties of MyContext here
    };
    (Tag.findBySlug as jest.Mock) = mockFindBy;
    mockFindBy.mockResolvedValueOnce(null);
    mockFindBy.mockResolvedValue(tag);

    const mockFindById = jest.fn();
    (Tag.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(tag);

    context.token = { id: 1 };
    const result = await tag.create(context);
    expect(mockFindBy).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Tag);
  });
});


describe('update', () => {
  let updateQuery;
  let tag;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Tag.update as jest.Mock) = updateQuery;

    tag = new Tag({
      name: casual.sentence,
      slug: casual.word.toLowerCase(),
      description: casual.sentence,
    })
  });

  it('returns the Tag without errors if it is valid', async () => {
    const mockFindById = jest.fn();
    (Tag.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(tag);
    const result = await tag.update(context);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Tag);
  });
});

describe('delete', () => {
  const originalfindById = Tag.findById
  let tag;

  beforeEach(() => {
    tag = new Tag({
      id: casual.integer(1, 9),
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    Tag.findById = originalfindById;
  })

  it('returns null if the Section has no id', async () => {
    tag.id = null;
    expect(await tag.delete(context)).toBe(null);
  });
  it('returns the Tag if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Tag.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(tag);

    const mockFindById = jest.fn();
    (Tag.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(tag);

    const result = await tag.delete(context);
    expect(Object.keys(result?.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Tag);
  });
});

describe('addToQuestion', () => {
  let context;
  let mockTag;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockTag = new Tag({
      id: casual.integer(1, 99),
      name: casual.word,
      description: casual.sentences(3)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the Tag to the specified Question', async () => {
    const questionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(mockTag);
    const result = await mockTag.addToQuestion(context, questionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'INSERT INTO questionTags (tagId, questionId, createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockTag.id.toString(), questionId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'Tag.addToQuestion')
    expect(result).toBe(true);
  });

  it('returns null if the Tag cannot be associated with the Question', async () => {
    const questionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(null);
    const result = await mockTag.addToQuestion(context, questionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('removeFromQuestion', () => {
  let context;
  let mockTag;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockTag = new Tag({
      id: casual.integer(1, 99),
      name: casual.word,
      description: casual.sentences(3)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the Tag association with the specified Question', async () => {
    const questionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(mockTag);
    const result = await mockTag.removeFromQuestion(context, questionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'DELETE FROM questionTags WHERE tagId = ? AND questionId = ?';
    const vals = [mockTag.id.toString(), questionId.toString()]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'Tag.removeFromQuestion')
    expect(result).toBe(true);
  });

  it('returns null if the Tag cannot be removed from the Question', async () => {
    const questionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(null);
    const result = await mockTag.removeFromQuestion(context, questionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('addToVersionedSectionTags', () => {
  let context;
  let mockTag;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockTag = new Tag({
      id: casual.integer(1, 99),
      name: casual.word,
      description: casual.sentences(3)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the Tag to the specified Section', async () => {
    const versionedSectionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(mockTag);
    const result = await mockTag.addToVersionedSectionTags(context, versionedSectionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'INSERT INTO versionedSectionTags (tagId, versionedSectionId, createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockTag.id.toString(), versionedSectionId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'Tag.addToVersionedSectionTags');
    expect(result).toBe(true);
  });

  it('returns false if the Tag cannot be associated with the Section', async () => {
    const versionedSectionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(null);
    const result = await mockTag.addToVersionedSectionTags(context, versionedSectionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('addToVersionedQuestionTags', () => {
  let context;
  let mockTag;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockTag = new Tag({
      id: casual.integer(1, 99),
      name: casual.word,
      description: casual.sentences(3)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('associates the Tag to the specified Question', async () => {
    const versionedQuestionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(mockTag);
    const result = await mockTag.addToVersionedQuestionTags(context, versionedQuestionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const expectedSql = 'INSERT INTO versionedQuestionTags (tagId, versionedQuestionId, createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token.id.toString();
    const vals = [mockTag.id.toString(), versionedQuestionId.toString(), userId, userId]
    expect(querySpy).toHaveBeenLastCalledWith(context, expectedSql, vals, 'Tag.addToVersionedQuestionTags');
    expect(result).toBe(true);
  });

  it('returns null if the Tag cannot be associated with the Question', async () => {
    const questionId = casual.integer(1, 999);
    const querySpy = jest.spyOn(Tag, 'query').mockResolvedValueOnce(null);
    const result = await mockTag.addToQuestion(context, questionId);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe('findAll', () => {
  const originalQuery = Tag.query;

  let localQuery;
  let context;
  let tag;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Tag.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    tag = new Tag({
      id: casual.integer(1, 9),
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Tag.query = originalQuery;
  });

  it('should call query with correct params and return the section', async () => {
    localQuery.mockResolvedValueOnce([tag]);
    const result = await Tag.findAll('Tag query', context);
    const expectedSql = 'SELECT * FROM tags';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [], 'Tag query');
    expect(result).toEqual([tag]);
  });
});


describe('findBySectionId', () => {
  const originalQuery = Tag.query;

  let localQuery;
  let context;
  let tag;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Tag.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    tag = new Tag({
      id: casual.integer(1, 9),
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    jest.clearAllMocks();
    Tag.query = originalQuery;
  });

  it('should call query with correct params and return the tag', async () => {
    localQuery.mockResolvedValueOnce([tag]);
    const sectionId = 1;
    const result = await Tag.findBySectionId('Tag query', context, sectionId);
    const expectedSql = `SELECT tags.* FROM sectionTags JOIN tags ON sectionTags.tagId = tags.id WHERE sectionTags.sectionId = ?;`;
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [sectionId.toString()], 'Tag query');
    expect(result).toEqual([tag]);
  });
});

describe('findById', () => {

  let localQuery;
  let context;
  let tag;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Tag.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    tag = new Tag({
      id: casual.integer(1, 9),
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call query with correct params and return the tag', async () => {
    localQuery.mockResolvedValueOnce([tag]);
    const tagId = 1;
    const result = await Tag.findById('Tag query', context, tagId);
    const expectedSql = 'SELECT * FROM tags where id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [tagId.toString()], 'Tag query');
    expect(result).toEqual(tag);

  });
});

describe('findBySlug', () => {

  let localQuery;
  let context;
  let tag;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Tag.query as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    tag = new Tag({
      id: casual.integer(1, 9),
      name: casual.sentence,
      description: casual.sentence,
    })
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call query with correct params and return the tag', async () => {
    localQuery.mockResolvedValueOnce([tag]);
    const slug = 'tagname';
    const result = await Tag.findBySlug('Tag query', context, slug);
    const expectedSql = 'SELECT * FROM tags WHERE slug = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [slug], 'Tag query');
    expect(result).toEqual([tag]);

  });
});
