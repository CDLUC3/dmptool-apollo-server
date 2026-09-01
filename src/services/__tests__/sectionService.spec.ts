import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

const mockGenerateQuestionVersion = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('../questionService.js', () => ({
  generateQuestionVersion: mockGenerateQuestionVersion,
}));

const mockHasPermissionOnTemplate = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('../templateService.js', () => ({
  hasPermissionOnTemplate: mockHasPermissionOnTemplate,
}));

import type { MyContext } from "../../context.js";

// A bare jest.fn() resolves its parameters to `unknown` (and its return type
// collapses to `never` the moment .mockResolvedValue/.mockReturnValue is
// chained) in this project's jest typings. mockAsyncFn() gives every mock a
// real (...args: any[]) => Promise<any> signature instead; every
// .mockImplementation callback built from it must be `async`, even when the
// value it returns is available synchronously, since TS needs the callback
// to actually return a Promise to satisfy that signature.
function mockAsyncFn() {
  return jest.fn<(...args: any[]) => Promise<any>>();
}

const { buildMockContextWithToken } = await import("../../__mocks__/context.js");
const { logger } = await import("../../logger.js");
const { Template } = await import("../../models/Template.js");
const { NotFoundError } = await import("../../utils/graphQLErrors.js");
const { Question } = await import("../../models/Question.js");
const { Section } = await import("../../models/Section.js");
const { VersionedSection } = await import("../../models/VersionedSection.js");
const { generateQuestionVersion } = await import("../questionService.js");
const { Tag } = await import("../../models/Tag.js");
const { getCurrentDate } = await import("../../utils/helpers.js");
const { cloneSection, generateSectionVersion, hasPermissionOnSection, updateDisplayOrders } = await import("../sectionService.js");

let context: MyContext;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('hasPermissionOnSection', () => {
  let template: InstanceType<typeof Template>;
  let mockFindById: ReturnType<typeof jest.fn>;
  let context: MyContext;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockFindById = jest.fn<(...args: any[]) => Promise<any>>();
    jest.spyOn(Template, 'findById').mockImplementation(mockFindById);

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
    expect(async () => { await hasPermissionOnSection(context, template.id) }).rejects.toThrow(NotFoundError());
  });

  it('returns true if the current user has permission on the Template', async () => {
    mockFindById.mockResolvedValueOnce(template);
    mockHasPermissionOnTemplate.mockResolvedValueOnce(true);

    expect(await hasPermissionOnSection(context, template.id)).toBe(true)
    expect(Template.findById).toHaveBeenCalledTimes(1);
    expect(mockHasPermissionOnTemplate).toHaveBeenCalledTimes(1);
  });

  it('returns false if the current user does NOT have permission on the Template', async () => {
    mockFindById.mockResolvedValueOnce(template);
    mockHasPermissionOnTemplate.mockResolvedValueOnce(false);

    expect(await hasPermissionOnSection(context, template.id)).toBe(false)
    expect(Template.findById).toHaveBeenCalledTimes(1);
    expect(mockHasPermissionOnTemplate).toHaveBeenCalledTimes(1);
  });
});

describe('cloneSection', () => {
  let section: InstanceType<typeof Section>;

  let id: number;
  let templateId: number;
  let name: string;
  let introduction: string;
  let requirements: string;
  let guidance: string;
  let displayOrder: number;
  let isDirty: boolean;
  let createdById: number;

  beforeEach(() => {
    templateId = casual.integer(1, 999);
    id = casual.integer(1, 999);
    name = casual.sentence;
    introduction = casual.sentences(3);
    requirements = casual.sentences(5);
    guidance = casual.sentences(5);
    displayOrder = casual.integer(1, 9);
    isDirty = true;
    createdById = casual.integer(1, 999);

    section = new Section({ id, templateId, name, introduction, requirements, guidance, displayOrder, isDirty, createdById });
  });

  it('Clone retains the expected parts of the specified Section', () => {
    const clonedById = casual.integer(1, 99);
    const copy = cloneSection(clonedById, templateId, section);

    expect(copy).toBeInstanceOf(Section);
    expect(copy.id).toBeFalsy();
    expect(copy.sourceSectionId).toEqual(section.id);
    expect(copy.templateId).toEqual(templateId);
    expect(copy.name).toEqual(section.name);
    expect(copy.introduction).toEqual(introduction);
    expect(copy.requirements).toEqual(requirements);
    expect(copy.guidance).toEqual(guidance);
    expect(copy.errors).toEqual({});
    expect(copy.displayOrder).toEqual(displayOrder);
    expect(copy.isDirty).toEqual(true);//The cloneSection function accepts Section | VersionedSection, and VersionedSection doesn't have isDirty, so in this test will always be true
    expect(copy.created).toBeTruthy();
    expect(copy.createdById).toEqual(clonedById)
    expect(copy.modified).toBeTruthy();
  });

  it('Clone retains the expected parts of the specified VersionedSection', () => {
    const clonedById = casual.integer(1, 999);
    const published = new VersionedSection({
      versionedTemplateId: templateId,
      sectionId: section.id,
      name: casual.sentence,
      introduction: casual.sentences(3),
      requirements: casual.sentences(5),
      guidance: casual.sentences(5),
      displayOrder: casual.integer(1, 9),
      createdById: casual.integer(1, 9999),
    });

    const copy = cloneSection(clonedById, templateId, published);

    expect(copy).toBeInstanceOf(Section);
    expect(copy.id).toBeFalsy();
    expect(copy.sourceSectionId).toEqual(published.sectionId);
    expect(copy.name).toEqual(published.name);
    expect(copy.introduction).toEqual(published.introduction);
    expect(copy.requirements).toEqual(published.requirements);
    expect(copy.guidance).toEqual(published.guidance);
    expect(copy.errors).toEqual({});
    expect(copy.createdById).toEqual(clonedById);
    expect(copy.displayOrder).toEqual(published.displayOrder);
    expect(copy.isDirty).toEqual(true);
    expect(copy.created).toBeTruthy();
    expect(copy.modified).toBeTruthy();
  });
});

describe('generateSectionVersion', () => {
  let sectionStore: any[];
  let versionedSectionStore: any[];
  let mockInsert: ReturnType<typeof mockAsyncFn>;
  let mockUpdate: ReturnType<typeof mockAsyncFn>;
  let mockFindSectionById: ReturnType<typeof mockAsyncFn>;
  let mockFindVersionedSectionbyId: ReturnType<typeof mockAsyncFn>;
  let mockTagFindById: ReturnType<typeof mockAsyncFn>;
  let mockAddToVersionedSectionTags: ReturnType<typeof jest.fn>;
  let mockQuestionFindBySectionId: ReturnType<typeof mockAsyncFn>;
  let mockTagFindByQuestionId: ReturnType<typeof mockAsyncFn>;

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock the Questions
    mockQuestionFindBySectionId = mockAsyncFn().mockResolvedValue([]);
    jest.spyOn(Question, 'findBySectionId').mockImplementation(mockQuestionFindBySectionId);

    // Mock Tag.findByQuestionId (used to populate questionInstance.tags before versioning)
    mockTagFindByQuestionId = mockAsyncFn().mockResolvedValue([]);
    jest.spyOn(Tag, 'findByQuestionId').mockImplementation(mockTagFindByQuestionId);

    const tstamp = getCurrentDate();

    // Setup the mock data stores
    sectionStore = [
      new Section({
        id: casual.integer(1, 99),
        templateId: casual.integer(1, 9),
        name: casual.sentence,
        introduction: casual.sentences(3),
        requirements: casual.sentences(2),
        guidance: casual.sentences(5),
        displayOrder: casual.integer(1, 9),
        tags: [
          new Tag({ id: 1, name: casual.words(3) }),
          new Tag({ id: 2, name: casual.words(1) }),
        ],
        isDirty: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedSectionStore = [];

    // Fetch an item from the sectionStore
    mockFindSectionById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return sectionStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedSectionStore
    mockFindVersionedSectionbyId = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedSectionStore.find((entry) => { return entry.id === id });
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
        case 'sections': {
          sectionStore.push(obj);
          break;
        }
        case 'versionedSections': {
          versionedSectionStore.push(obj);
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
        case 'sections': {
          const existing = sectionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the sectionStore for id: ${obj.id}`);
          }
          sectionStore.splice(sectionStore.indexOf(existing), 1, obj);
          break;
        }
        case 'versionedSections': {
          const existing = versionedSectionStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the versionedSectionStore for id: ${obj.id}`);
          }
          versionedSectionStore.splice(versionedSectionStore.indexOf(existing), 1, obj);
          break;
        }
      }
      return obj;
    });

    // Mock Tag.findById
    mockTagFindById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      const tag = sectionStore[0].tags.find((t) => t.id === id);
      return tag ? new Tag({ ...tag }) : null;
    });
    jest.spyOn(Tag, 'findById').mockImplementation(mockTagFindById);

    // Mock Tag.prototype.addToVersionedSectionTags
    mockAddToVersionedSectionTags = jest.fn<(...args: any[]) => boolean>().mockReturnValue(true);
    jest.spyOn(Tag.prototype, 'addToVersionedSectionTags').mockImplementation(mockAddToVersionedSectionTags);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not allow an unsaved section to be versioned', async () => {
    const section = new Section({ name: casual.words(4) });

    expect(async () => {
      await generateSectionVersion(context, section, casual.integer(1, 999));
    }).rejects.toThrow(Error('Cannot publish unsaved Section'));
  });

  it('does not version if the VersionedSection could not be created', async () => {
    const section = sectionStore[0];
    const versioned = new VersionedSection({ sectionId: section.id });
    versioned.errors = { general: 'Test failure' };

    context.dataSources.sqlDataSource = {
      query: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValueOnce(null)
    } as any;



    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    const mockFindByFailure = mockAsyncFn().mockImplementation(async () => { return versioned; });
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindByFailure);

    const err = `Unable to create a new version for section: ${section.id}`;
    expect(async () => {
      await generateSectionVersion(context, section, casual.integer(1, 999));
    }).rejects.toThrow(Error(err));
  });

  it('does not version if the Section could not be updated', async () => {
    const section = sectionStore[0];
    const updated = new Section({ id: section.id });
    updated.errors = { general: 'Test failure' };

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    const mockUpdateFailure = mockAsyncFn().mockImplementation(async () => { return updated; });
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockUpdateFailure);

    const err = `Unable to set the isDirty flag for section: ${section.id}`;
    expect(async () => {
      await generateSectionVersion(context, section, casual.integer(1, 999))
    }).rejects.toThrow(Error(err));
  });

  it('versions the Section', async () => {
    const section = new Section(sectionStore[0]);

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById);

    const versionedTemplateId = casual.integer(1, 999);
    expect(await generateSectionVersion(context, section, versionedTemplateId)).toEqual(true);

    // Verify that the Version was created as expected
    const newVersion = versionedSectionStore[0];
    expect(mockInsert).toHaveBeenCalled();
    expect(newVersion.id).toBeTruthy();
    expect(newVersion.created).toBeTruthy();
    expect(newVersion.modified).toBeTruthy();
    expect(newVersion.createdById).toEqual(context.token.id);
    expect(newVersion.modifiedById).toEqual(context.token.id);
    expect(newVersion.versionedTemplateId).toEqual(versionedTemplateId);
    expect(newVersion.sectionId).toEqual(section.id);
    expect(newVersion.name).toEqual(section.name);
    expect(newVersion.introduction).toEqual(section.introduction);
    expect(newVersion.requirements).toEqual(section.requirements);
    expect(newVersion.guidance).toEqual(section.guidance);
    expect(newVersion.displayOrder).toEqual(section.displayOrder);
    expect(newVersion.tags).toEqual(section.tags);

    // Verify that the template was updated as expected
    expect(mockUpdate).toHaveBeenCalled();
    const updated = sectionStore.find((entry) => { return entry.id === section.id; });
    expect(updated.modifiedById).toEqual(section.modifiedById);
    expect(updated.modified).toEqual(section.modified);
    expect(updated.isDirty).toEqual(false);
  });

  it('versions the Section and adds an error when a tag is not found', async () => {
    const section = new Section(sectionStore[0]);
    const missingTagId = 999;
    section.tags = [
      new Tag({ id: 1, name: casual.words(3) }),
      new Tag({ id: missingTagId, name: casual.words(2) }),
    ];

    mockTagFindById.mockImplementation(async (_, __, id) => {
      return id === missingTagId ? null : new Tag({ id, name: casual.words(3) });
    });

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById);
    // Ensure Question.findBySectionId is mocked
    jest.spyOn(Question, 'findBySectionId').mockImplementation(mockQuestionFindBySectionId);

    const versionedTemplateId = casual.integer(1, 999);
    expect(await generateSectionVersion(context, section, versionedTemplateId)).toEqual(true);

    const newVersion = versionedSectionStore[0];
    expect(newVersion.errors.tags).toContain(`Tag ${missingTagId} not found`);
    expect(mockAddToVersionedSectionTags).toHaveBeenCalledTimes(1); // Only called for the found tag
  });

  it('versions the Section and adds an error when tag association fails', async () => {
    const section = new Section(sectionStore[0]);
    const failingTagName = 'Failing Tag';
    section.tags = [
      new Tag({ id: 1, name: failingTagName }),
    ];

    mockTagFindById.mockResolvedValue(new Tag({ id: 1, name: failingTagName }));
    mockAddToVersionedSectionTags.mockReturnValue(false);

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById);

    const versionedTemplateId = casual.integer(1, 999);
    expect(await generateSectionVersion(context, section, versionedTemplateId)).toEqual(true);

    const newVersion = versionedSectionStore[0];
    expect(newVersion.errors.tags).toContain(failingTagName);
    expect(mockAddToVersionedSectionTags).toHaveBeenCalled();
  });

  it('versions the Section without errors when there are no tags', async () => {
    const section = new Section({ ...sectionStore[0], tags: [] });

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById);

    const versionedTemplateId = casual.integer(1, 999);
    expect(await generateSectionVersion(context, section, versionedTemplateId)).toEqual(true);

    expect(mockTagFindById).not.toHaveBeenCalled();
    expect(mockAddToVersionedSectionTags).not.toHaveBeenCalled();
  });

  it('fetches tags for each question and passes them to generateQuestionVersion', async () => {
    const section = new Section(sectionStore[0]);
    section.tags = [];

    const question1 = new Question({ id: casual.integer(1, 99), sectionId: section.id });
    mockQuestionFindBySectionId.mockResolvedValue([question1]);

    const question1Tags = [new Tag({ id: 10, name: casual.word })];
    mockTagFindByQuestionId.mockResolvedValue(question1Tags);

    jest.spyOn(VersionedSection, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedSection, 'findById').mockImplementation(mockFindVersionedSectionbyId);
    jest.spyOn(Section, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Section, 'findById').mockImplementation(mockFindSectionById);
    mockGenerateQuestionVersion.mockResolvedValue(true);

    const versionedTemplateId = casual.integer(1, 999);
    expect(await generateSectionVersion(context, section, versionedTemplateId)).toEqual(true);

    expect(mockTagFindByQuestionId).toHaveBeenCalledWith('generateSectionVersion', context, question1.id);
    expect(generateQuestionVersion).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ id: question1.id, tags: question1Tags }),
      versionedTemplateId,
      expect.any(Number)
    );
  });
});

describe('updateDisplayOrders', () => {
  describe('updateDisplayOrders', () => {
    let sectionStore: any[];
    let templateId: number;
    let mockFindByTemplateId: ReturnType<typeof mockAsyncFn>;
    let mockUpdate: ReturnType<typeof mockAsyncFn>;

    beforeEach(() => {
      jest.resetAllMocks();

      const tstamp = getCurrentDate();

      templateId = casual.integer(1, 999);

      // Setup the mock data store
      sectionStore = [
        new Section({
          id: 1,
          templateId: templateId,
          name: casual.sentence,
          introduction: casual.sentences(3),
          requirements: casual.sentences(2),
          guidance: casual.sentences(5),
          displayOrder: 1,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
        new Section({
          id: 2,
          templateId: templateId,
          name: casual.sentence,
          introduction: casual.sentences(3),
          requirements: casual.sentences(2),
          guidance: casual.sentences(5),
          displayOrder: 2,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
        new Section({
          id: 3,
          templateId: templateId,
          name: casual.sentence,
          introduction: casual.sentences(3),
          requirements: casual.sentences(2),
          guidance: casual.sentences(5),
          displayOrder: 3,
          isDirty: false,
          createdById: casual.integer(1, 999),
          created: tstamp,
          modifiedById: casual.integer(1, 999),
          modified: tstamp,
        }),
      ];

      // Mock the findByTemplateId method
      mockFindByTemplateId = mockAsyncFn().mockResolvedValue(sectionStore);
      jest.spyOn(Section, 'findByTemplateId').mockImplementation(mockFindByTemplateId);

      // Mock the update method
      mockUpdate = mockAsyncFn().mockImplementation(async (context: any) => {
        const tstamp = getCurrentDate();
        const userId = context.token.id;
        return new Section({
          ...sectionStore[0],
          modified: tstamp,
          modifiedById: userId,
        });
      });
      jest.spyOn(Section.prototype, 'update').mockImplementation(mockUpdate);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('throws NotFoundError if no sections are found', async () => {
      mockFindByTemplateId.mockResolvedValueOnce(null);

      await expect(
        updateDisplayOrders(context, templateId, casual.integer(1, 99), 1)
      ).rejects.toThrow(NotFoundError());
    });

    it('reorders sections and updates them successfully', async () => {
      const newDisplayOrder = 2;
      const reorderedSections = await updateDisplayOrders(
        context,
        templateId,
        sectionStore[0].id,
        newDisplayOrder
      );

      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(2); // Should have updated the 1st and 2nd sections
      expect(reorderedSections).toHaveLength(sectionStore.length);
      expect(reorderedSections[0].displayOrder).toEqual(1);
      expect(reorderedSections[0].id).toEqual(2);
      expect(reorderedSections[1].displayOrder).toEqual(2);
      expect(reorderedSections[1].id).toEqual(1);
      expect(reorderedSections[2].displayOrder).toEqual(3);
      expect(reorderedSections[2].id).toEqual(3);
    });

    it('skips updating sections with unchanged display order', async () => {
      const newDisplayOrder = sectionStore[0].displayOrder;

      const reorderedSections = await updateDisplayOrders(
        context,
        templateId,
        sectionStore[0].id,
        newDisplayOrder
      );

      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled(); // No updates should occur
      expect(reorderedSections).toHaveLength(sectionStore.length);
    });

    it('throws an error if a section update fails', async () => {
      mockUpdate.mockImplementationOnce(async () => {
        throw new Error('Update failed');
      });

      await expect(
        updateDisplayOrders(context, templateId, sectionStore[0].id, 2)
      ).rejects.toThrow('Update failed');
      expect(mockFindByTemplateId).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });
});