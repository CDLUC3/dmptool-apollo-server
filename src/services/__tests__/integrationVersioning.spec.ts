import casual from "casual";
import { getRandomEnumValue } from "../../__tests__/helpers";
import { Template, TemplateVisibility } from "../../models/Template";
import { generateTemplateVersion } from "../templateService";
import { logger } from "../../logger";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { TemplateVersionType, VersionedTemplate } from "../../models/VersionedTemplate";
import { Section } from "../../models/Section";
import { getCurrentDate } from "../../utils/helpers";
import { Question } from "../../models/Question";
import { Tag } from "../../models/Tag";
import { VersionedSection } from "../../models/VersionedSection";
import { MySqlModel } from "../../models/MySqlModel";
import { VersionedQuestion } from "../../models/VersionedQuestion";
import { QuestionCondition, QuestionConditionActionType, QuestionConditionCondition } from "../../models/QuestionCondition";
import { VersionedQuestionCondition } from "../../models/VersionedQuestionCondition";
import { CURRENT_SCHEMA_VERSION } from "@dmptool/types";

// Pulling context in here so that the mysql gets mocked
jest.mock('../../context.ts');

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
let mockFindVersionedTemplatebyId;
let mockFindVersionedSectionbyId;
let mockFindVersionedQuestionById;
let mockFindVersionedQuestionConditionById

let templateStore;
let sectionStore;
let questionStore;
let questionConditionStore;
let versionedTemplateStore;
let versionedSectionStore;
let versionedQuestionStore;
let versionedQuestionConditionStore;
let tagStore; // <-- add tag store

// Update an entry in one of the stores
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateStore(store: any[], tableName: string, obj: MySqlModel) {
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
    mockFindTemplateById = jest.fn().mockImplementation(async (_, __, id) => {
      return templateStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the question
    mockFindSections = jest.fn().mockImplementation(async (_, __, id) => {
      return sectionStore.filter((entry) => { return entry.templateId === id; });
    });

    // Fetch an item from the sectionStore
    mockFindSectionById = jest.fn().mockImplementation(async (_, __, id) => {
      return sectionStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the question
    mockFindQuestions = jest.fn().mockImplementation(async (_, __, id) => {
      return questionStore.filter((entry) => { return entry.sectionId === id; });
    });

    // Fetch an item from the questionStore
    mockFindQuestionById = jest.fn().mockImplementation(async (_, __, id) => {
      return questionStore.find((entry) => { return entry.id === id });
    });

    // Find all of the questionConditions for the question
    mockFindQuestionConditions = jest.fn().mockImplementation(async (_, __, id) => {
      return questionConditionStore.filter((entry) => { return entry.questionId === id; });
    });

    // Fetch an item from the questionConditionStore
    mockFindQuestionConditionById = jest.fn().mockImplementation(async (_, __, id) => {
      return questionConditionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedTemplateStore
    mockFindVersionedTemplatebyId = jest.fn().mockImplementation(async (_, __, id) => {
      return versionedTemplateStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedSectionStore
    mockFindVersionedSectionbyId = jest.fn().mockImplementation(async (_, __, id) => {
      return versionedSectionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionStore
    mockFindVersionedQuestionById = jest.fn().mockImplementation(async (_, __, id) => {
      return versionedQuestionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedQuestionConditionStore
    mockFindVersionedQuestionConditionById = jest.fn().mockImplementation(async (_, __, id) => {
      return versionedQuestionConditionStore.find((entry) => { return entry.id === id });
    });

    // Tag mocks (needed after templateService started querying tags)
    const mockFindTagById = jest.fn().mockImplementation(async (_, __, id) => {
      return tagStore.find(t => t.id === id);
    });
    const mockFindTagsBySectionId = jest.fn().mockImplementation(async (_, __, sectionId) => {
      const section = sectionStore.find(s => s.id === sectionId);
      return section ? section.tags : [];
    });
    const mockAddToVersionedSectionTags = jest.fn().mockImplementation(async () => true);

    // Add the entry to the appropriate store
    mockInsert = jest.fn().mockImplementation(async (context, table, obj) => {
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
      }
      // Need to return the new id for the object
      return obj.id;
    });

    // Update the entry in the store
    mockUpdate = jest.fn().mockImplementation(async (context, table, obj, _ref, _keys, noTouch) => {
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
        displayOrder: casual.integer(1, 9),
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionStore = [];

    // Add 2 conditions to one of the questions in section 2
    questionConditionStore = [
      new QuestionCondition({
        id: casual.integer(1, 49),
        questionId: questionStore[1].id,
        action: getRandomEnumValue(QuestionConditionActionType),
        conditionType: getRandomEnumValue(QuestionConditionCondition),
        conditionMatch: casual.words(2),
        target: casual.words(3),
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
      new QuestionCondition({
        id: casual.integer(50, 99),
        questionId: questionStore[1].id,
        action: getRandomEnumValue(QuestionConditionActionType),
        conditionType: getRandomEnumValue(QuestionConditionCondition),
        conditionMatch: casual.words(2),
        target: casual.words(3),
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedQuestionConditionStore = [];

    // Template dataStore mocks
    (VersionedTemplate.insert as jest.Mock) = mockInsert;
    (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindVersionedTemplatebyId;
    (Template.update as jest.Mock) = mockUpdate;
    (Template.findById as jest.Mock) = mockFindTemplateById;

    // Section dataStore mocks
    (Section.findByTemplateId as jest.Mock) = mockFindSections;
    (VersionedSection.insert as jest.Mock) = mockInsert;
    (VersionedSection.findById as jest.Mock) = mockFindVersionedSectionbyId;
    (Section.update as jest.Mock) = mockUpdate;
    (Section.findById as jest.Mock) = mockFindSectionById;

    // Question dataStore mocks
    (Question.findBySectionId as jest.Mock) = mockFindQuestions;
    (VersionedQuestion.insert as jest.Mock) = mockInsert;
    (VersionedQuestion.findById as jest.Mock) = mockFindVersionedQuestionById;
    (Question.update as jest.Mock) = mockUpdate;
    (Question.findById as jest.Mock) = mockFindQuestionById;

    // QuestionCondition dataStore mocks
    (QuestionCondition.findByQuestionId as jest.Mock) = mockFindQuestionConditions;
    (VersionedQuestionCondition.insert as jest.Mock) = mockInsert;
    (VersionedQuestionCondition.findById as jest.Mock) = mockFindVersionedQuestionConditionById;
    (QuestionCondition.update as jest.Mock) = mockUpdate;
    (QuestionCondition.findById as jest.Mock) = mockFindQuestionConditionById;

    // Tag dataStore mocks
    (Tag.findById as jest.Mock) = mockFindTagById;
    (Tag.findBySectionId as jest.Mock) = mockFindTagsBySectionId;
    (Tag.prototype.addToVersionedSectionTags as unknown as jest.Mock) = mockAddToVersionedSectionTags;
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
    expect(versionedQuestionConditionStore.length).toBe(2);
    expect(versionedQuestionConditionStore[0].versionedQuestionId).toEqual(versionedQuestionStore[1].id);
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
    expect(versionedQuestionConditionStore.length).toBe(3);
    expect(versionedQuestionConditionStore[2].versionedQuestionId).toEqual(versionedQuestionStore[4].id);
  });
});
