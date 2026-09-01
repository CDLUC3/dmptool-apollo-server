import { jest } from '@jest/globals';
import casual from "casual";
import { CURRENT_SCHEMA_VERSION } from "@dmptool/types";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

const mockHasPermissionOnTemplate = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('../templateService.js', () => ({
  hasPermissionOnTemplate: mockHasPermissionOnTemplate,
}));

import type { MyContext } from "../../context.js";

// A bare jest.fn() resolves its parameters to `unknown` in this project's
// jest typings, breaking property access inside .mockImplementation
// callbacks. This helper gives every one of them a real
// (...args: any[]) => Promise<any> signature instead.
function mockAsyncFn() {
  return jest.fn<(...args: any[]) => Promise<any>>();
}

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { Template } = await import("../../models/Template.js");
const {
  cloneQuestion,
  generateQuestionConditionGroupVersion,
  generateQuestionConditionVersion,
  generateQuestionVersion,
  hasPermissionOnQuestion,
  updateDisplayOrders
} = await import("../questionService.js");
const { NotFoundError } = await import("../../utils/graphQLErrors.js");
const { Question } = await import("../../models/Question.js");
const { VersionedQuestion } = await import("../../models/VersionedQuestion.js");
const { QuestionCondition } = await import("../../models/QuestionCondition.js");
const { QuestionConditionGroup } = await import("../../models/QuestionConditionGroup.js");
const { VersionedQuestionCondition } = await import("../../models/VersionedQuestionCondition.js");
const { VersionedQuestionConditionGroup } = await import("../../models/VersionedQuestionConditionGroups.js");
const { Tag } = await import("../../models/Tag.js");
const { getCurrentDate } = await import("../../utils/helpers.js");

let context: MyContext;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('hasPermissionOnQuestion', () => {
  let template: InstanceType<typeof Template>;
  let mockFindById: ReturnType<typeof jest.spyOn>;
  let context: MyContext;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockFindById = jest.spyOn(Template, 'findById');

    template = new Template({
      id: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws an error if the Template is not found', async () => {
    mockFindById.mockResolvedValue(null);
    expect(async () => { await hasPermissionOnQuestion(context, template.id) }).rejects.toThrow(NotFoundError());
  });

  it('returns true if the current user has permission on the Template', async () => {
    mockFindById.mockResolvedValueOnce(template);
    mockHasPermissionOnTemplate.mockResolvedValueOnce(true);

    expect(await hasPermissionOnQuestion(context, template.id)).toBe(true)
    expect(Template.findById).toHaveBeenCalledTimes(1);
    expect(mockHasPermissionOnTemplate).toHaveBeenCalledTimes(1);
  });

  it('returns false if the current user does NOT have permission on the Template', async () => {
    mockFindById.mockResolvedValueOnce(template);
    mockHasPermissionOnTemplate.mockResolvedValueOnce(false);

    expect(await hasPermissionOnQuestion(context, template.id)).toBe(false)
    expect(Template.findById).toHaveBeenCalledTimes(1);
    expect(mockHasPermissionOnTemplate).toHaveBeenCalledTimes(1);
  });
});

describe('cloneQuestion', () => {
  let question: InstanceType<typeof Question>;

  let id: number;
  let templateId: number;
  let sectionId: number;
  let json: string;
  let questionText: string;
  let sampleText: string;
  let requirementText: string;
  let guidanceText: string;
  let displayOrder: number;
  let required: boolean;
  let isDirty: boolean;
  let createdById: number;

  beforeEach(() => {
    templateId = casual.integer(1, 999);
    sectionId = casual.integer(1, 999);
    id = casual.integer(1, 999);
    json = '{"type":"url","meta":{"schemaVersion":"' + CURRENT_SCHEMA_VERSION + '"}}';
    questionText = casual.sentence;
    sampleText = casual.sentences(3);
    requirementText = casual.sentences(5);
    guidanceText = casual.sentences(5);
    displayOrder = casual.integer(1, 9);
    required = casual.boolean;
    isDirty = true;
    createdById = casual.integer(1, 999);

    question = new Question({
      id, templateId, sectionId, json: json, questionText, requirementText, guidanceText,
      sampleText, displayOrder, required, isDirty, createdById
    });
  });

  it('Clone retains the expected parts of the specified Question', () => {
    const clonedById = casual.integer(1, 99);
    const copy = cloneQuestion(clonedById, templateId, sectionId, question);

    expect(copy).toBeInstanceOf(Question);
    expect(copy.id).toBeFalsy();
    expect(copy.templateId).toEqual(templateId);
    expect(copy.sectionId).toEqual(sectionId);
    expect(copy.sourceQuestionId).toEqual(question.id);
    expect(copy.json).toEqual(json);
    expect(copy.questionText).toEqual(questionText);
    expect(copy.sampleText).toEqual(sampleText);
    expect(copy.requirementText).toEqual(requirementText);
    expect(copy.guidanceText).toEqual(guidanceText);
    expect(copy.errors).toEqual({});
    expect(copy.displayOrder).toEqual(displayOrder);
    expect(copy.required).toEqual(false);
    expect(copy.isDirty).toEqual(true);
    expect(copy.created).toBeTruthy();
    expect(copy.createdById).toEqual(clonedById)
    expect(copy.modified).toBeTruthy();
  });

  it('Clone retains the expected parts of the specified VersionedQuestion', () => {
    const clonedById = casual.integer(1, 999);
    const published = new VersionedQuestion({
      versionedTemplateId: templateId,
      versionedSectionId: sectionId,
      questionId: question.id,
      json: json,
      questionText: casual.sentence,
      sampleText: casual.sentences(3),
      requirementText: casual.sentences(5),
      guidanceText: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      required: true,
      createdById: casual.integer(1, 9999),
    });

    const copy = cloneQuestion(clonedById, templateId, sectionId, published);

    expect(copy).toBeInstanceOf(Question);
    expect(copy.id).toBeFalsy();
    expect(copy.sourceQuestionId).toEqual(published.questionId);
    expect(copy.json).toEqual(json);
    expect(copy.questionText).toEqual(published.questionText);
    expect(copy.sampleText).toEqual(published.sampleText);
    expect(copy.requirementText).toEqual(published.requirementText);
    expect(copy.guidanceText).toEqual(published.guidanceText);
    expect(copy.errors).toEqual({});
    expect(copy.createdById).toEqual(clonedById);
    expect(copy.displayOrder).toEqual(published.displayOrder);
    expect(copy.required).toEqual(false);
    expect(copy.isDirty).toEqual(true);
    expect(copy.created).toBeTruthy();
    expect(copy.modified).toBeTruthy();
  });
});

describe('generateQuestionVersion', () => {
  const originalGroupCreate = VersionedQuestionConditionGroup.prototype.create;

  let questionStore: any[];
  let versionedQuestionStore: any[];
  let mockInsert: ReturnType<typeof mockAsyncFn>;
  let mockUpdate: ReturnType<typeof mockAsyncFn>;
  let mockFindQuestionById: ReturnType<typeof mockAsyncFn>;
  let mockFindVersionedQuestionById: ReturnType<typeof mockAsyncFn>;
  let mockFindGroupsByQuestionId: ReturnType<typeof mockAsyncFn>;
  let mockFindTagById: ReturnType<typeof mockAsyncFn>;
  let mockAddToVersionedQuestionTags: ReturnType<typeof mockAsyncFn>;

  afterEach(() => {
    VersionedQuestionConditionGroup.prototype.create = originalGroupCreate;
  });

  beforeEach(() => {
    // By default there are no QuestionConditionGroups for the question. Individual
    // tests override this to exercise the group-versioning branch.
    mockFindGroupsByQuestionId = mockAsyncFn().mockResolvedValue([]);
    jest.spyOn(QuestionConditionGroup, 'findByQuestionId').mockImplementation(mockFindGroupsByQuestionId);

    mockAddToVersionedQuestionTags = mockAsyncFn().mockResolvedValue(true);
    jest.spyOn(Tag.prototype, 'addToVersionedQuestionTags').mockImplementation(mockAddToVersionedQuestionTags);

    mockFindTagById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return new Tag({ id, name: `tag-${id}`, description: casual.sentence });
    });
    jest.spyOn(Tag, 'findById').mockImplementation(mockFindTagById);

    const tstamp = getCurrentDate();

    // Setup the mock data stores
    questionStore = [
      new Question({
        id: casual.integer(1, 99),
        templateId: casual.integer(1, 99),
        sectionId: casual.integer(1, 999),
        json: JSON.stringify({
          type: 'radioButtons',
          attributes: {
            label: casual.words(3),
            help: casual.sentence
          },
          options: [
            {
              label: casual.word,
              value: casual.integer(1, 999).toString(),
              selected: casual.boolean
            },
            {
              label: casual.word,
              value: casual.integer(1, 999).toString(),
              selected: casual.boolean
            }
          ],
          meta: {
            schemaVersion: CURRENT_SCHEMA_VERSION
          }
        }),
        questionText: casual.sentences(2),
        requirementText: casual.sentences(3),
        guidanceText: casual.sentences(2),
        sampleText: casual.sentences(2),
        required: true,
        displayOrder: casual.integer(1, 9),
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionStore = [];

    // Fetch an item from the questionStore
    mockFindQuestionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionStore
    mockFindVersionedQuestionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedQuestionStore.find((entry) => { return entry.id === id });
    });

    // Add the entry to the appropriate store
    mockInsert = mockAsyncFn().mockImplementation(async (context, table, obj) => {
      const tstamp = getCurrentDate();
      const userId = context.token.id;
      obj.id = casual.integer(1, 9999);
      obj.created = tstamp;
      obj.createdById = userId;
      obj.modifed = tstamp;
      obj.modifiedById = userId;

      switch (table) {
        case 'questions': {
          questionStore.push(obj);
          break;
        }
        case 'versionedQuestions': {
          versionedQuestionStore.push(obj);
          break;
        }
      }
      // Need to return the new id for the object
      return obj.id;
    });

    // Update the entry in the store
    mockUpdate = mockAsyncFn().mockImplementation(async (context, table, obj, _ref, _keys, noTouch) => {
      const tstamp = getCurrentDate();
      const userId = context.token.id;
      if (!noTouch) {
        obj.modifed = tstamp;
        obj.modifiedById = userId;
      }

      switch (table) {
        case 'questions': {
          const existing = questionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the questionStore for id: ${obj.id}`);
          }
          questionStore.splice(questionStore.indexOf(existing), 1, obj);
          break;
        }
        case 'versionedQuestions': {
          const existing = versionedQuestionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the versionedQuestionStore for id: ${obj.id}`);
          }
          versionedQuestionStore.splice(versionedQuestionStore.indexOf(existing), 1, obj);
          break;
        }
      }
      return obj;
    });
  });

  it('does not allow an unsaved question to be versioned', async () => {
    const question = new Question({ name: casual.words(4) });

    expect(async () => {
      await generateQuestionVersion(context, question, casual.integer(1, 999), casual.integer(1, 999));
    }).rejects.toThrow(Error('Cannot publish unsaved Question'));
  });

  it('does not version if the VersionedQuestion could not be created', async () => {
    const question = questionStore[0];
    const versioned = new VersionedQuestion({ questionId: question.id });
    versioned.errors = { general: 'Test failure' };

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    const mockFindByFailure = mockAsyncFn().mockImplementation(async () => { return versioned; });
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindByFailure);

    const err = `Unable to create new version for question: ${question.id}`;
    expect(async () => {
      await generateQuestionVersion(context, question, casual.integer(1, 999), casual.integer(1, 999));
    }).rejects.toThrow(Error(err));
  });

  it('does not version if the Question could not be updated', async () => {
    const question = questionStore[0];
    const updated = new Question({ id: question.id });
    updated.errors = { general: 'Test failure' };

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    const mockUpdateFailure = mockAsyncFn().mockImplementation(async () => { return updated; });
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockUpdateFailure);

    const err = `Unable to set isDirty flag on question: ${question.id}`;
    expect(async () => {
      await generateQuestionVersion(context, question, casual.integer(1, 999), casual.integer(1, 999))
    }).rejects.toThrow(Error(err));
  });

  it('versions the Question when it has no QuestionConditionGroups', async () => {
    const question = new Question(questionStore[0]);

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);
    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    // Verify that the Version was created as expected
    const newVersion = versionedQuestionStore[0];
    expect(mockFindGroupsByQuestionId).toHaveBeenCalledWith('generateQuestionVersion', context, newVersion.questionId);
    expect(mockInsert).toHaveBeenCalled();
    expect(newVersion.id).toBeTruthy();
    expect(newVersion.created).toBeTruthy();
    expect(newVersion.modified).toBeTruthy();
    expect(newVersion.createdById).toEqual(context.token.id);
    expect(newVersion.modifiedById).toEqual(context.token.id);
    expect(newVersion.versionedTemplateId).toEqual(versionedTemplateId);
    expect(newVersion.versionedSectionId).toEqual(versionedSectionId);
    expect(newVersion.questionId).toEqual(question.id);
    expect(newVersion.json).toEqual(question.json);
    expect(newVersion.questionText).toEqual(question.questionText);
    expect(newVersion.requirementText).toEqual(question.requirementText);
    expect(newVersion.guidanceText).toEqual(question.guidanceText);
    expect(newVersion.sampleText).toEqual(question.sampleText);
    expect(newVersion.required).toEqual(question.required)
    expect(newVersion.displayOrder).toEqual(question.displayOrder);

    // Verify that the question was updated as expected
    expect(mockUpdate).toHaveBeenCalled();
    const updated = questionStore.find((entry) => { return entry.id === question.id; });
    expect(updated.modifiedById).toEqual(question.modifiedById);
    expect(updated.modified).toEqual(question.modified);
    expect(updated.isDirty).toEqual(false);
  });

  it('versions the Question and assigns its tags', async () => {
    const tag1 = { id: casual.integer(1, 99), name: casual.word };
    const tag2 = { id: casual.integer(1, 99), name: casual.word };
    const question = new Question({ ...questionStore[0], tags: [tag1, tag2] });

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);

    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    const newVersion = versionedQuestionStore[0];
    expect(mockFindTagById).toHaveBeenCalledTimes(2);
    expect(mockFindTagById).toHaveBeenCalledWith('generateQuestionVersion', context, tag1.id);
    expect(mockFindTagById).toHaveBeenCalledWith('generateQuestionVersion', context, tag2.id);
    expect(mockAddToVersionedQuestionTags).toHaveBeenCalledTimes(2);
    expect(mockAddToVersionedQuestionTags).toHaveBeenCalledWith(context, newVersion.id);
    expect(newVersion.errors?.tags).toBeUndefined();
  });

  it('adds a tags error when a tag cannot be found', async () => {
    const missingTagId = 10;
    const question = new Question({ ...questionStore[0], tags: [{ id: missingTagId, name: 'ghost-tag' }] });

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);
    jest.spyOn(Tag, 'findById').mockResolvedValue(null);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);

    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    const newVersion = versionedQuestionStore[0];
    expect(mockAddToVersionedQuestionTags).not.toHaveBeenCalled();
    expect(newVersion.errors.tags).toContain(`Tag ${missingTagId} not found`);
  });

  it('adds a tags error when a tag fails to be assigned', async () => {
    const tag = { id: 10, name: 'Data Formatting' };
    const question = new Question({ ...questionStore[0], tags: [tag] });

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);
    jest.spyOn(Tag, 'findById').mockImplementation(mockFindTagById);
    jest.spyOn(Tag.prototype, 'addToVersionedQuestionTags').mockResolvedValue(false);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);

    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    const newVersion = versionedQuestionStore[0];
    expect(newVersion.errors.tags).toContain("Saved but we were unable to assign tags: tag-10");
  });

  it('skips tag assignment when the question has no tags', async () => {
    const question = new Question({ ...questionStore[0], tags: [] });

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);

    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    expect(mockFindTagById).not.toHaveBeenCalled();
  });

  it('versions the Question and its QuestionConditionGroups', async () => {
    const question = new Question(questionStore[0]);
    const group = new QuestionConditionGroup({
      id: casual.integer(1, 99),
      questionId: question.id,
      triggerQuestionId: casual.integer(1, 99),
    });

    mockFindGroupsByQuestionId.mockResolvedValueOnce([group]);

    const mockFindConditionsByGroupId = mockAsyncFn().mockResolvedValue([]);
    jest.spyOn(QuestionCondition, 'findByGroupId').mockImplementation(mockFindConditionsByGroupId);

    const mockCreateVersionedGroup = mockAsyncFn().mockImplementation(async function (this: any) {
      return new VersionedQuestionConditionGroup({
        id: casual.integer(1, 999),
        versionedQuestionId: this.versionedQuestionId,

        triggerQuestionId: this.triggerQuestionId,
      });
    });
    jest.spyOn(VersionedQuestionConditionGroup.prototype, 'create').mockImplementation(mockCreateVersionedGroup);

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);

    const versionedTemplateId = casual.integer(1, 999);
    const versionedSectionId = casual.integer(1, 999);
    expect(
      await generateQuestionVersion(context, question, versionedTemplateId, versionedSectionId)
    ).toEqual(true);

    const newVersion = versionedQuestionStore[0];
    expect(mockCreateVersionedGroup).toHaveBeenCalledTimes(1);
    expect(mockFindConditionsByGroupId).toHaveBeenCalledWith('generateQuestionConditionGroupVersion', context, group.id);
    // The question was still marked clean since group versioning succeeded
    const updated = questionStore.find((entry) => { return entry.id === question.id; });
    expect(updated.isDirty).toEqual(false);
    expect(newVersion.errors).toEqual({});
  });

  it('does not mark the Question clean if a QuestionConditionGroup fails to version', async () => {
    const question = new Question(questionStore[0]);
    const group = new QuestionConditionGroup({
      id: casual.integer(1, 99),
      questionId: question.id,
      triggerQuestionId: casual.integer(1, 99),
    });

    mockFindGroupsByQuestionId.mockResolvedValueOnce([group]);

    const mockCreateVersionedGroup = mockAsyncFn().mockImplementation(async () => {
      const failed = new VersionedQuestionConditionGroup({ versionedQuestionId: casual.integer(1, 999) });
      failed.errors = { general: 'Test failure' };
      return failed;
    });
    jest.spyOn(VersionedQuestionConditionGroup.prototype, 'create').mockImplementation(mockCreateVersionedGroup);

    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById);

    const err = `Unable to generate a new version for questionConditionGroup: ${group.id}`;
    await expect(
      generateQuestionVersion(context, question, casual.integer(1, 999), casual.integer(1, 999))
    ).rejects.toThrow(Error(err));

    // The Question should not have been marked as clean since versioning failed
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('generateQuestionConditionGroupVersion', () => {
  const originalGroupCreate = VersionedQuestionConditionGroup.prototype.create;
  const originalConditionCreate = VersionedQuestionCondition.prototype.create;

  let mockCreateVersionedGroup: ReturnType<typeof mockAsyncFn>;
  let mockFindConditionsByGroupId: ReturnType<typeof mockAsyncFn>;
  let group: InstanceType<typeof QuestionConditionGroup>;

  beforeEach(() => {
    group = new QuestionConditionGroup({
      id: casual.integer(1, 99),
      questionId: casual.integer(1, 999),
      triggerQuestionId: casual.integer(1, 999),
    });

    mockFindConditionsByGroupId = mockAsyncFn().mockResolvedValue([]);
    jest.spyOn(QuestionCondition, 'findByGroupId').mockImplementation(mockFindConditionsByGroupId);
  });

  afterEach(() => {
    VersionedQuestionConditionGroup.prototype.create = originalGroupCreate;
    VersionedQuestionCondition.prototype.create = originalConditionCreate;
  });

  it('does not allow an unsaved QuestionConditionGroup to be versioned', async () => {
    const unsavedGroup = new QuestionConditionGroup({ questionId: casual.integer(1, 9) });

    expect(async () => {
      await generateQuestionConditionGroupVersion(context, unsavedGroup, casual.integer(1, 999));
    }).rejects.toThrow(Error('Cannot publish unsaved QuestionConditionGroup'));
  });

  it('does not version if the VersionedQuestionConditionGroup could not be created', async () => {
    mockCreateVersionedGroup = mockAsyncFn().mockImplementation(async () => {
      const failed = new VersionedQuestionConditionGroup({ versionedQuestionId: casual.integer(1, 999) });
      failed.errors = { general: 'Test failure' };
      return failed;
    });
    jest.spyOn(VersionedQuestionConditionGroup.prototype, 'create').mockImplementation(mockCreateVersionedGroup);

    const err = `Unable to generate a new version for questionConditionGroup: ${group.id}`;
    expect(async () => {
      await generateQuestionConditionGroupVersion(context, group, casual.integer(1, 999));
    }).rejects.toThrow(Error(err));
  });

  it('versions the QuestionConditionGroup when it has no QuestionConditions', async () => {
    const versionedQuestionId = casual.integer(1, 999);
    const savedGroupId = casual.integer(1, 9999);

    mockCreateVersionedGroup = mockAsyncFn().mockImplementation(async function (this: any) {
      return new VersionedQuestionConditionGroup({
        id: savedGroupId,
        versionedQuestionId: this.versionedQuestionId,
        triggerQuestionId: this.triggerQuestionId,
      });
    });
    jest.spyOn(VersionedQuestionConditionGroup.prototype, 'create').mockImplementation(mockCreateVersionedGroup);

    expect(await generateQuestionConditionGroupVersion(context, group, versionedQuestionId)).toEqual(true);
    expect(mockCreateVersionedGroup).toHaveBeenCalledTimes(1);
    expect(mockFindConditionsByGroupId).toHaveBeenCalledWith('generateQuestionConditionGroupVersion', context, group.id);
  });

  it('versions each QuestionCondition that belongs to the group', async () => {
    const versionedQuestionId = casual.integer(1, 999);
    const savedGroupId = casual.integer(1, 9999);

    mockCreateVersionedGroup = mockAsyncFn().mockImplementation(async function (this: any) {
      return new VersionedQuestionConditionGroup({
        id: savedGroupId,
        versionedQuestionId: this.versionedQuestionId,
        triggerQuestionId: this.triggerQuestionId,
      });
    });
    jest.spyOn(VersionedQuestionConditionGroup.prototype, 'create').mockImplementation(mockCreateVersionedGroup);

    const condition = new QuestionCondition({
      id: casual.integer(1, 99),
      groupId: group.id,
      conditionType: "EQUALS",
      conditionMatch: casual.words(2),
    });
    mockFindConditionsByGroupId.mockResolvedValueOnce([condition]);

    const mockCreateVersionedCondition = mockAsyncFn().mockImplementation(async function (this: any) {
      return new VersionedQuestionCondition({
        id: casual.integer(1, 9999),
        versionedQuestionConditionGroupId: this.versionedQuestionConditionGroupId,
        conditionType: this.conditionType,
        conditionMatch: this.conditionMatch,
      });
    });
    jest.spyOn(VersionedQuestionCondition.prototype, 'create').mockImplementation(mockCreateVersionedCondition);

    expect(await generateQuestionConditionGroupVersion(context, group, versionedQuestionId)).toEqual(true);
    expect(mockCreateVersionedCondition).toHaveBeenCalledTimes(1);
  });
});

describe('generateQuestionConditionVersion', () => {
  let questionConditionStore: any[];
  let versionedQuestionConditionStore: any[];
  let mockInsert: ReturnType<typeof mockAsyncFn>;
  let mockUpdate: ReturnType<typeof mockAsyncFn>;
  let mockFindQuestionConditionById: ReturnType<typeof mockAsyncFn>;
  let mockFindVersionedQuestionConditionById: ReturnType<typeof mockAsyncFn>;

  beforeEach(() => {
    const tstamp = getCurrentDate();

    // Setup the mock data stores
    questionConditionStore = [
      new QuestionCondition({
        id: casual.integer(1, 99),
        groupId: casual.integer(1, 99),
        conditionType: "EQUALS",
        conditionMatch: casual.words(2),
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionConditionStore = [];

    // Fetch an item from the questionConditionStore
    mockFindQuestionConditionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionConditionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionConditionStore
    mockFindVersionedQuestionConditionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      const entry = versionedQuestionConditionStore.find((e) => { return e.id === id });
      return entry ? new VersionedQuestionCondition(entry) : null;
    });

    // Add the entry to the appropriate store
    mockInsert = mockAsyncFn().mockImplementation(async (context, table, obj) => {
      const tstamp = getCurrentDate();
      const userId = context.token.id;
      obj.id = casual.integer(1, 9999);
      obj.created = tstamp;
      obj.createdById = userId;
      obj.modifed = tstamp;
      obj.modifiedById = userId;

      switch (table) {
        case 'questionConditions': {
          questionConditionStore.push(obj);
          break;
        }
        case 'versionedQuestionConditions': {
          versionedQuestionConditionStore.push(obj);
          break;
        }
      }
      // Need to return the new id for the object
      return obj.id;
    });

    // Update the entry in the store
    mockUpdate = mockAsyncFn().mockImplementation(async (context, table, obj, _ref, _keys, noTouch) => {
      const tstamp = getCurrentDate();
      const userId = context.token.id;
      if (!noTouch) {
        obj.modifed = tstamp;
        obj.modifiedById = userId;
      }

      switch (table) {
        case 'questionConditions': {
          const existing = questionConditionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the questionConditionStore for id: ${obj.id}`);
          }
          questionConditionStore.splice(questionConditionStore.indexOf(existing), 1, obj);
          break;
        }
        case 'versionedQuestionConditions': {
          const existing = versionedQuestionConditionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the versionedQuestionConditionStore for id: ${obj.id}`);
          }
          versionedQuestionConditionStore.splice(versionedQuestionConditionStore.indexOf(existing), 1, obj);
          break;
        }
      }
      return obj;
    });
  });

  it('does not allow an unsaved QuestionCondition to be versioned', async () => {
    const questionCondition = new QuestionCondition({ groupId: casual.integer(1, 9) });

    expect(async () => {
      await generateQuestionConditionVersion(context, questionCondition, casual.integer(1, 999));
    }).rejects.toThrow(Error('Cannot publish unsaved QuestionCondition'));
  });

  it('does not version if the VersionedQuestionCondition could not be created', async () => {
    const questionCondition = questionConditionStore[0];
    const versioned = new VersionedQuestionCondition({ versionedQuestionConditionGroupId: casual.integer(1, 999) });
    versioned.errors = { general: 'Test failure' };

    jest.spyOn(VersionedQuestionCondition, 'insert').mockImplementation(mockInsert);
    const mockFindByFailure = mockAsyncFn().mockImplementation(async () => { return versioned; });
    jest.spyOn(VersionedQuestionCondition, 'findById').mockImplementation(mockFindByFailure);

    const err = `Unable to generate a new version for questionCondition: ${questionCondition.id}`;
    expect(async () => {
      await generateQuestionConditionVersion(context, questionCondition, casual.integer(1, 999));
    }).rejects.toThrow(Error(err));
  });

  it('versions the QuestionCondition', async () => {
    const questionCondition = new QuestionCondition(questionConditionStore[0]);

    jest.spyOn(VersionedQuestionCondition, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedQuestionCondition, 'findById').mockImplementation(mockFindVersionedQuestionConditionById);
    jest.spyOn(QuestionCondition, 'update').mockImplementation(mockUpdate);
    jest.spyOn(QuestionCondition, 'findById').mockImplementation(mockFindQuestionConditionById);

    const versionedQuestionConditionGroupId = casual.integer(1, 999);
    expect(
      await generateQuestionConditionVersion(context, questionCondition, versionedQuestionConditionGroupId)
    ).toEqual(true);

    // Verify that the Version was created as expected
    const newVersion = versionedQuestionConditionStore[0];
    expect(mockInsert).toHaveBeenCalled();
    expect(newVersion.id).toBeTruthy();
    expect(newVersion.created).toBeTruthy();
    expect(newVersion.modified).toBeTruthy();
    expect(newVersion.createdById).toEqual(context.token.id);
    expect(newVersion.modifiedById).toEqual(context.token.id);
    expect(newVersion.versionedQuestionConditionGroupId).toEqual(versionedQuestionConditionGroupId);
    expect(newVersion.conditionType).toEqual(questionCondition.conditionType);
    expect(newVersion.conditionMatch).toEqual(questionCondition.conditionMatch);
  });
});

describe('updateDisplayOrders', () => {
  describe('updateDisplayOrders', () => {
    let questionStore: any[];
    let sectionId: number;
    let mockFindByTemplateId: ReturnType<typeof mockAsyncFn>;
    let mockUpdate: ReturnType<typeof mockAsyncFn>;

    beforeEach(() => {
      jest.resetAllMocks();

      const tstamp = getCurrentDate();

      const templateId = casual.integer(1, 999);
      sectionId = casual.integer(1, 999);

      // Setup the mock data store
      questionStore = [
        new Question({
          id: 1,
          templateId: templateId,
          sectionId: sectionId,
          json: '{"type":"text","meta":{"schemaVersion":"' + CURRENT_SCHEMA_VERSION + '"}}',
          questionText: casual.sentence,
          displayOrder: 1,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
        new Question({
          id: 2,
          templateId: templateId,
          sectionId: sectionId,
          json: '{"type":"text","meta":{"schemaVersion":"' + CURRENT_SCHEMA_VERSION + '"}}',
          questionText: casual.sentence,
          displayOrder: 2,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
        new Question({
          id: 3,
          templateId: templateId,
          sectionId: sectionId,
          json: '{"type":"text","meta":{"schemaVersion":"' + CURRENT_SCHEMA_VERSION + '"}}',
          questionText: casual.sentence,
          displayOrder: 3,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
      ];

      // Mock the findByTemplateId method
      mockFindByTemplateId = mockAsyncFn().mockResolvedValue(questionStore);
      jest.spyOn(Question, 'findBySectionId').mockImplementation(mockFindByTemplateId);

      // Mock the update method
      mockUpdate = mockAsyncFn().mockImplementation(async (context: any) => {
        const tstamp = getCurrentDate();
        const userId = context.token.id;
        return new Question({
          ...questionStore[0],
          modified: tstamp,
          modifiedById: userId,
        });
      });
      jest.spyOn(Question.prototype, 'update').mockImplementation(mockUpdate);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('throws NotFoundError if no sections are found', async () => {
      mockFindByTemplateId.mockResolvedValueOnce(null);

      await expect(
        updateDisplayOrders(context, sectionId, casual.integer(1, 99), 1)
      ).rejects.toThrow(NotFoundError());
    });

    it('reorders sections and updates them successfully', async () => {
      const newDisplayOrder = 2;
      const reorderedSections = await updateDisplayOrders(
        context,
        sectionId,
        questionStore[0].id,
        newDisplayOrder
      );

      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(2); // Should have updated the 1st and 2nd sections
      expect(reorderedSections).toHaveLength(questionStore.length);
      expect(reorderedSections[0].displayOrder).toEqual(1);
      expect(reorderedSections[0].id).toEqual(2);
      expect(reorderedSections[1].displayOrder).toEqual(2);
      expect(reorderedSections[1].id).toEqual(1);
      expect(reorderedSections[2].displayOrder).toEqual(3);
      expect(reorderedSections[2].id).toEqual(3);
    });

    it('skips updating sections with unchanged display order', async () => {
      const newDisplayOrder = questionStore[0].displayOrder;

      const reorderedSections = await updateDisplayOrders(
        context,
        sectionId,
        questionStore[0].id,
        newDisplayOrder
      );

      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled(); // No updates should occur
      expect(reorderedSections).toHaveLength(questionStore.length);
    });

    it('throws an error if a section update fails', async () => {
      mockUpdate.mockImplementationOnce(() => {
        throw new Error('Update failed');
      });

      await expect(
        updateDisplayOrders(context, sectionId, questionStore[0].id, 2)
      ).rejects.toThrow('Update failed');
      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });
});