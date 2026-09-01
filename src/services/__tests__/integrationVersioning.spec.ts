import { jest } from '@jest/globals';
import casual from "casual";
import { CURRENT_SCHEMA_VERSION } from "@dmptool/types";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// No jest.unstable_mockModule needed here at all — every model is a real
// class, mocked per-test via jest.spyOn on its static/prototype methods
// (matching indexDMPService.spec.ts's conversion). jest.mock('../../context.js')
// is dropped, same as everywhere else: mockAppConfigs()/mockAppLogger() have
// been sufficient without it throughout this migration.
//
// getRandomEnumValue is a dynamic import here, not a static one, for the
// same reason as every model below: a static `import` gets hoisted to
// evaluate before ANY of this file's own top-level code runs — including
// mockAppConfigs() above — regardless of where the import statement appears
// in the source. __tests__/helpers.js transitively touches generalConfig.ts
// (which validates JWT_REFRESH_SECRET at module-evaluation time), so a
// static import here was triggering that validation before mockAppConfigs()
// had a chance to set it — same root cause as the earlier CACHE_PORT issue.
// ---------------------------------------------------------------------------
const { logger } = await import("../../logger.js");
const { getRandomEnumValue } = await import("../../__tests__/helpers.js");
const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { Template, TemplateVisibility } = await import("../../models/Template.js");
const { generateTemplateVersion } = await import("../templateService.js");
const { TemplateVersionType, VersionedTemplate } = await import("../../models/VersionedTemplate.js");
const { Section } = await import("../../models/Section.js");
const { getCurrentDate } = await import("../../utils/helpers.js");
const { Question } = await import("../../models/Question.js");
const { Tag } = await import("../../models/Tag.js");
const { VersionedSection } = await import("../../models/VersionedSection.js");
const { MySqlModel } = await import("../../models/MySqlModel.js");
const { VersionedQuestion } = await import("../../models/VersionedQuestion.js");
const { QuestionCondition } = await import("../../models/QuestionCondition.js");
const { QuestionConditionGroup } = await import("../../models/QuestionConditionGroup.js");
const { VersionedQuestionCondition } = await import("../../models/VersionedQuestionCondition.js");
const { VersionedQuestionConditionGroup } = await import("../../models/VersionedQuestionConditionGroups.js");

type MySqlModelInstance = InstanceType<typeof MySqlModel>;

// A bare jest.fn() resolves its parameters to `unknown` in this project's
// jest typings, which breaks every property access inside these
// .mockImplementation callbacks (obj.id, entry.templateId, etc.). This
// helper gives every one of them a real (...args: any[]) => Promise<any>
// signature instead, since there are ~15 of these in this file and typing
// the generic out at each call site would be repetitive.
function mockAsyncFn() {
  return jest.fn<(...args: any[]) => Promise<any>>();
}

let context;

let mockInsert;
let mockUpdate;
let mockFindTemplateById;
let mockFindSections;
let mockFindSectionById;
let mockFindQuestions;
let mockFindQuestionById;
let mockFindQuestionConditions;
let mockFindQuestionConditionById;
let mockFindQuestionConditionGroupsByQuestionId;
let mockFindQuestionConditionGroupById;
let mockFindVersionedTemplatebyId;
let mockFindVersionedSectionbyId;
let mockFindVersionedQuestionById;
let mockFindVersionedQuestionConditionById

let templateStore;
let sectionStore;
let questionStore;
let questionConditionStore;
let questionConditionGroupStore;
let versionedTemplateStore;
let versionedSectionStore;
let versionedQuestionStore;
let versionedQuestionConditionStore;
let versionedQuestionConditionGroupStore;
let tagStore; // <-- add tag store

// Update an entry in one of the stores
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateStore(store: any[], tableName: string, obj: MySqlModelInstance) {
  const existing = store.find((entry) => { return entry.id === obj.id });
  if (!existing) {
    throw new Error(`No entry in the ${tableName} for id: ${obj.id}`);
  }
  store.splice(store.indexOf(existing), 1, obj);
}

describe('Integration test: Template Versioning', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    // Mock the Apollo context
    context = await buildMockContextWithToken(logger);

    // Fetch an item from the templateStore
    mockFindTemplateById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return templateStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the question
    mockFindSections = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return sectionStore.filter((entry) => { return entry.templateId === id; });
    });

    // Fetch an item from the sectionStore
    mockFindSectionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return sectionStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the question
    mockFindQuestions = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionStore.filter((entry) => { return entry.sectionId === id; });
    });

    // Fetch an item from the questionStore
    mockFindQuestionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the group
    mockFindQuestionConditions = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionConditionStore.filter((entry) => { return entry.groupId === id; });
    });

    // Fetch an item from the questionConditionStore
    mockFindQuestionConditionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionConditionStore.find((entry) => { return entry.id === id });
    });

    // Find all of the QuestionConditionGroups for a question
    mockFindQuestionConditionGroupsByQuestionId = mockAsyncFn().mockImplementation(async (_, __, questionId) => {
      return questionConditionGroupStore.filter((entry) => { return entry.questionId === questionId; });
    });

    // Fetch an item from the questionConditionGroupStore
    mockFindQuestionConditionGroupById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return questionConditionGroupStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedTemplateStore
    mockFindVersionedTemplatebyId = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedTemplateStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedSectionStore
    mockFindVersionedSectionbyId = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedSectionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionStore
    mockFindVersionedQuestionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedQuestionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionConditionStore
    mockFindVersionedQuestionConditionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      const entry = versionedQuestionConditionStore.find((e) => { return e.id === id });
      return entry ? new VersionedQuestionCondition(entry) : null;
    });

    // Fetch an item from the versionedQuestionConditionGroupStore
    const mockFindVersionedQuestionConditionGroupById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedQuestionConditionGroupStore.find((entry) => { return entry.id === id });
    });

    // Tag mocks (needed after templateService started querying tags)
    const mockFindTagById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return tagStore.find(t => t.id === id);
    });
    const mockFindTagsBySectionId = mockAsyncFn().mockImplementation(async (_, __, sectionId) => {
      const section = sectionStore.find(s => s.id === sectionId);
      return section ? section.tags : [];
    });

    const mockFindTagsByQuestionId = mockAsyncFn().mockImplementation(async (_, __, questionId) => {
      const question = questionStore.find(q => q.id === questionId);
      return question?.tags ?? [];
    });

    const mockAddToVersionedSectionTags = mockAsyncFn().mockImplementation(async () => true);
    const mockAddToVersionedQuestionTags = mockAsyncFn().mockImplementation(async () => true);

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
        case 'templates': {
          templateStore.push(obj);
          break;
        }
        case 'sections': {
          sectionStore.push(obj);
          break;
        }
        case 'questions': {
          questionStore.push(obj);
          break;
        }
        case 'questionConditions': {
          questionConditionStore.push(obj);
          break;
        }
        case 'questionConditionGroups': {
          questionConditionGroupStore.push(obj);
          break;
        }

        case 'versionedTemplates': {
          versionedTemplateStore.push(obj);
          break;
        }
        case 'versionedSections': {
          versionedSectionStore.push(obj);
          break;
        }
        case 'versionedQuestions': {
          versionedQuestionStore.push(obj);
          break;
        }
        case 'versionedQuestionConditions': {
          versionedQuestionConditionStore.push(obj);
          break;
        }
        case 'versionedQuestionConditionGroups': {
          versionedQuestionConditionGroupStore.push(obj);
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
        case 'templates': {
          updateStore(templateStore, 'templateStore', obj);
          break;
        }
        case 'sections': {
          updateStore(sectionStore, 'sectionStore', obj);
          break;
        }
        case 'questions': {
          updateStore(questionStore, 'questionStore', obj);
          break;
        }
        case 'questionConditions': {
          updateStore(questionConditionStore, 'questionConditionStore', obj);
          break;
        }
        case 'questionConditionGroups': {
          updateStore(questionConditionGroupStore, 'questionConditionGroupStore', obj);
          break;
        }

        case 'versionedTemplates': {
          updateStore(versionedTemplateStore, 'questionStore', obj);
          break;
        }
        case 'versionedSections': {
          updateStore(versionedSectionStore, 'versionedSectionStore', obj);
          break;
        }
        case 'versionedQuestions': {
          updateStore(versionedQuestionStore, 'versionedQuestionStore', obj);
          break;
        }
        case 'versionedQuestionConditions': {
          updateStore(versionedQuestionConditionStore, 'versionedQuestionConditionStore', obj);
          break;
        }
      }
      return obj;
    });

    const tstamp = getCurrentDate();

    // Setup the mock data stores for a temnplate
    templateStore = [
      new Template({
        id: casual.integer(1, 99),
        name: casual.sentence,
        description: casual.sentences(5),
        ownerId: casual.url,
        visibility: getRandomEnumValue(TemplateVisibility),
        latestPublishVersion: '',
        isDirty: true,
        bestPractice: false,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedTemplateStore = [];

    // Add 2 sections to the template
    sectionStore = [
      new Section({
        id: casual.integer(1, 99),
        templateId: templateStore[0].id,
        name: casual.sentence,
        introduction: casual.sentences(3),
        requirements: casual.sentences(2),
        guidance: casual.sentences(5),
        displayOrder: casual.integer(1, 9),
        tags: [
          new Tag({ id: casual.integer(1, 9999), name: casual.words(3) }),
          new Tag({ id: casual.integer(1, 9999), name: casual.words(1) }),
        ],
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),

      new Section({
        id: casual.integer(100, 999),
        templateId: templateStore[0].id,
        name: casual.sentence,
        introduction: casual.sentences(3),
        requirements: casual.sentences(2),
        guidance: casual.sentences(5),
        displayOrder: casual.integer(1, 9),
        tags: [
          new Tag({ id: casual.integer(1, 9999), name: casual.words(3) }),
          new Tag({ id: casual.integer(1, 9999), name: casual.words(1) }),
        ],
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedSectionStore = [];

    // Build tagStore from section tags
    tagStore = [...sectionStore[0].tags, ...sectionStore[1].tags];

    // Add 1 question to section 1 and 2 questions to section 2
    questionStore = [
      new Question({
        id: casual.integer(1, 49),
        templateId: templateStore[0].id,
        sectionId: sectionStore[0].id,
        json: `{"type":"textArea","attributes":{"asRichText":true},"meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`,
        questionText: casual.sentences(2),
        requirementText: casual.sentences(3),
        guidanceText: casual.sentences(2),
        sampleText: casual.sentences(2),
        required: true,
        tags: [
          new Tag({ id: casual.integer(1, 9999), name: casual.words(3) }),
          new Tag({ id: casual.integer(1, 9999), name: casual.words(1) }),
        ],
        displayOrder: casual.integer(1, 9),
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
      new Question({
        id: casual.integer(50, 99),
        templateId: templateStore[0].id,
        sectionId: sectionStore[1].id,
        json: `{"type":"text","attributes":{},"meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`,
        questionText: casual.sentences(2),
        requirementText: casual.sentences(3),
        guidanceText: casual.sentences(2),
        sampleText: casual.sentences(2),
        required: true,
        tags: [
          new Tag({ id: casual.integer(1, 9999), name: casual.words(3) }),
          new Tag({ id: casual.integer(1, 9999), name: casual.words(1) }),
        ],
        displayOrder: casual.integer(1, 9),
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
      new Question({
        id: casual.integer(100, 149),
        templateId: templateStore[0].id,
        sectionId: sectionStore[1].id,
        json: `{"type":"email","attributes":{},"meta":{"schemaVersion":"${CURRENT_SCHEMA_VERSION}"}}`,
        questionText: casual.sentences(2),
        requirementText: casual.sentences(3),
        guidanceText: casual.sentences(2),
        sampleText: casual.sentences(2),
        required: true,
        tags: [
          new Tag({ id: casual.integer(1, 9999), name: casual.words(3) }),
          new Tag({ id: casual.integer(1, 9999), name: casual.words(1) }),
        ],
        displayOrder: casual.integer(1, 9),
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionStore = [];

    // Add 1 QuestionConditionGroup for question[1] in section 2
    questionConditionGroupStore = [
      new QuestionConditionGroup({
        id: casual.integer(1, 49),
        questionId: questionStore[1].id,
        triggerQuestionId: questionStore[0].id,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionConditionGroupStore = [];

    // Add 2 conditions to the group above
    questionConditionStore = [
      new QuestionCondition({
        id: casual.integer(50, 99),
        groupId: questionConditionGroupStore[0].id,
        conditionType: "EQUAL",
        conditionMatch: casual.words(2),
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
      new QuestionCondition({
        id: casual.integer(100, 149),
        groupId: questionConditionGroupStore[0].id,
        conditionType: "EQUAL",
        conditionMatch: casual.words(2),
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionConditionStore = [];

    // Template dataStore mocks
    jest.spyOn(VersionedTemplate, 'insert').mockImplementation(mockInsert as any);
    jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockImplementation(mockFindVersionedTemplatebyId as any);
    jest.spyOn(Template, 'update').mockImplementation(mockUpdate as any);
    jest.spyOn(Template, 'findById').mockImplementation(mockFindTemplateById as any);

    // Section dataStore mocks
    jest.spyOn(Section, 'findByTemplateId').mockImplementation(mockFindSections as any);
    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert as any);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId as any);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate as any);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById as any);

    // Question dataStore mocks
    jest.spyOn(Question, 'findBySectionId').mockImplementation(mockFindQuestions as any);
    jest.spyOn(VersionedQuestion, 'insert').mockImplementation(mockInsert as any);
    jest.spyOn(VersionedQuestion, 'findById').mockImplementation(mockFindVersionedQuestionById as any);
    jest.spyOn(Question, 'update').mockImplementation(mockUpdate as any);
    jest.spyOn(Question, 'findById').mockImplementation(mockFindQuestionById as any);

    // QuestionCondition dataStore mocks
    jest.spyOn(QuestionCondition, 'findByGroupId').mockImplementation(mockFindQuestionConditions as any);
    jest.spyOn(VersionedQuestionCondition, 'insert').mockImplementation(mockInsert as any);
    jest.spyOn(VersionedQuestionCondition, 'findById').mockImplementation(mockFindVersionedQuestionConditionById as any);
    jest.spyOn(QuestionCondition, 'update').mockImplementation(mockUpdate as any);
    jest.spyOn(QuestionCondition, 'findById').mockImplementation(mockFindQuestionConditionById as any);

    // QuestionConditionGroup dataStore mocks
    jest.spyOn(QuestionConditionGroup, 'findByQuestionId').mockImplementation(mockFindQuestionConditionGroupsByQuestionId as any);
    jest.spyOn(QuestionConditionGroup, 'findById').mockImplementation(mockFindQuestionConditionGroupById as any);
    jest.spyOn(VersionedQuestionConditionGroup, 'insert').mockImplementation(mockInsert as any);
    jest.spyOn(VersionedQuestionConditionGroup, 'findById').mockImplementation(mockFindVersionedQuestionConditionGroupById as any);

    // Tag dataStore mocks
    jest.spyOn(Tag, 'findById').mockImplementation(mockFindTagById as any);
    jest.spyOn(Tag, 'findBySectionId').mockImplementation(mockFindTagsBySectionId as any);
    jest.spyOn(Tag, 'findByQuestionId').mockImplementation(mockFindTagsByQuestionId as any);
    jest.spyOn(Tag.prototype, 'addToVersionedSectionTags').mockImplementation(mockAddToVersionedSectionTags as any);
    jest.spyOn(Tag.prototype, 'addToVersionedQuestionTags').mockImplementation(mockAddToVersionedQuestionTags as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  })

  it('can version a Template for the first time', async () => {
    const tmplt = templateStore[0];
    const versionType = TemplateVersionType.DRAFT; // deterministic
    const firstVersion = await generateTemplateVersion(
      context,
      tmplt,
      [],
      context.token.id,
      versionType,
    );

    expect(firstVersion.version).toEqual('v1');
    expect(versionedTemplateStore.length).toBe(1);
    expect(versionedSectionStore.length).toBe(2);
    expect(versionedSectionStore[0].versionedTemplateId).toEqual(versionedTemplateStore[0].id);
    expect(versionedQuestionStore.length).toBe(3);
    expect(versionedQuestionStore[0].versionedSectionId).toEqual(versionedSectionStore[0].id);
    expect(versionedQuestionConditionGroupStore.length).toBe(1);
    expect(versionedQuestionConditionGroupStore[0].versionedQuestionId).toEqual(versionedQuestionStore[1].id);
    expect(versionedQuestionConditionStore.length).toBe(2);
    expect(versionedQuestionConditionStore[0].versionedQuestionConditionGroupId).toEqual(versionedQuestionConditionGroupStore[0].id);
  });

  it('can version a Template multiple times', async () => {
    const tmplt = templateStore[0];
    const versionType = TemplateVersionType.DRAFT;
    const firstVersion = await generateTemplateVersion(
      context,
      tmplt,
      [],
      context.token.id,
      versionType,
    );
    expect(firstVersion.version).toEqual('v1');

    // Remove a questionCondition and generate a new version
    questionConditionStore.splice(0, 1);
    tmplt.isDirty = true;
    const secondVersion = await generateTemplateVersion(
      context,
      tmplt,
      versionedTemplateStore,
      context.token.id,
      versionType,
    );
    expect(secondVersion.version).toEqual('v2');
    expect(versionedTemplateStore.length).toBe(2);
    expect(versionedSectionStore.length).toBe(4);
    expect(versionedSectionStore[3].versionedTemplateId).toEqual(versionedTemplateStore[1].id);
    expect(versionedQuestionStore.length).toBe(6);
    expect(versionedQuestionStore[5].versionedSectionId).toEqual(versionedSectionStore[3].id);
    expect(versionedQuestionConditionGroupStore.length).toBe(2);
    expect(versionedQuestionConditionGroupStore[1].versionedQuestionId).toEqual(versionedQuestionStore[4].id);
    expect(versionedQuestionConditionStore.length).toBe(3);
    expect(versionedQuestionConditionStore[2].versionedQuestionConditionGroupId).toEqual(versionedQuestionConditionGroupStore[1].id);
  });
});