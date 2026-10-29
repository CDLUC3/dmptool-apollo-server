/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import casual from 'casual';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// templateCustomizationService.js: safe to spread-actual here (unlike the
// heavier templateService.js itself, deliberately kept un-spread in
// questionService.test.ts/sectionService.test.ts) — its own spec file
// confirmed it has no import-time dependency on emailService/awsConfig/
// OpenSearch, just real model classes. Only handleFunderTemplateRepublication
// needs to be controllable per-test here.
// ---------------------------------------------------------------------------
const mockHandleFunderTemplateRepublication = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0);

const actualTemplateCustomizationService = await import('../templateCustomizationService.js');
jest.unstable_mockModule('../templateCustomizationService.js', () => ({
  ...actualTemplateCustomizationService,
  handleFunderTemplateRepublication: mockHandleFunderTemplateRepublication,
}));

// --- authService.js ---
// isSuperAdmin needs to be independently controllable per-test (unlike files
// where the real role-check logic is exercised), so it's replaced here
// rather than left real.
const mockIsSuperAdmin = jest.fn<(...args: any[]) => boolean>();

const actualAuthService = await import('../authService.js');
jest.unstable_mockModule('../authService.js', () => ({
  ...actualAuthService,
  isSuperAdmin: mockIsSuperAdmin,
}));

import type { MyContext } from '../../context.js';

// A bare jest.fn() resolves its parameters to `unknown` (and its return type
// collapses to `never` once .mockResolvedValue/.mockReturnValue is chained)
// in this project's jest typings. mockAsyncFn() gives every mock a real
// (...args: any[]) => Promise<any> signature; every .mockImplementation
// callback built from it must be `async`, even when the value it returns is
// available synchronously.
function mockAsyncFn() {
  return jest.fn<(...args: any[]) => Promise<any>>();
}

const { Template, TemplateVisibility } = await import("../../models/Template.js");
const { VersionedTemplate, TemplateVersionType } = await import('../../models/VersionedTemplate.js');
const {
  cloneTemplate, generateTemplateVersion, hasPermissionOnTemplate,
  setDefaultTemplate
} = await import('../templateService.js');
const { TemplateCollaborator } = await import('../../models/Collaborator.js');
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { Section } = await import('../../models/Section.js');
const { getRandomEnumValue } = await import('../../__tests__/helpers.js');
const { getCurrentDate } = await import('../../utils/helpers.js');
const { logger } = await import('../../logger.js');
const { Tag } = await import('../../models/Tag.js');

let context: MyContext;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('hasPermissionOnTemplate', () => {
  let template: InstanceType<typeof Template>;
  let collaborator: InstanceType<typeof TemplateCollaborator>;
  let mockFindByTemplateAndEmail: ReturnType<typeof jest.spyOn>;
  let context: MyContext;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockFindByTemplateAndEmail = jest.spyOn(TemplateCollaborator, 'findByTemplateIdAndEmail');

    template = new Template({
      id: casual.integer(1, 999),
      name: casual.sentence,
      ownerId: casual.url,
    });

    collaborator = new TemplateCollaborator({
      id: casual.integer(1, 999),
      templateId: template.id,
      email: casual.email,
      userId: casual.integer(1, 999),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true if the current user is a Super Admin', async () => {
    mockIsSuperAdmin.mockReturnValue(true);

    context.token = { affiliationId: 'https://test.example.com/foo' } as any;
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it('returns true if the current user\'s affiliation is the same as the template\'s owner', async () => {
    mockIsSuperAdmin.mockReturnValue(false);

    context.token = { affiliationId: template.ownerId } as any;
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);

  });

  it('returns true if the current user is a collaborator for the template', async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockFindByTemplateAndEmail.mockResolvedValueOnce(collaborator);

    context.token = { affiliationId: 'https://test.example.com/foo' } as any;
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockFindByTemplateAndEmail).toHaveBeenCalledTimes(1);
  });

  it('returns false when the user does not have permission', async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockFindByTemplateAndEmail.mockResolvedValueOnce(null);

    context.token = { affiliationId: 'https://test.example.com/other-foo' } as any;
    expect(await hasPermissionOnTemplate(context, template)).toBe(false)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockFindByTemplateAndEmail).toHaveBeenCalledTimes(1);
  });
});

describe('cloneTemplate', () => {
  let id: number;
  let name: string;
  let description: string;
  let createdById: number;
  let ownerId: string;
  let tmplt: InstanceType<typeof Template>;

  beforeEach(() => {
    id = casual.integer(1, 999);
    name = casual.title;
    description = casual.sentences(3);
    ownerId = casual.url;
    createdById = casual.integer(1, 999);

    tmplt = new Template({ id, name, description, ownerId, createdById });
  });

  it('Clone retains the expected parts of the specified Template', () => {
    const clonedById = casual.integer(1, 99);
    const newOwnerId = casual.url;
    const copy = cloneTemplate(clonedById, newOwnerId, tmplt);

    expect(copy).toBeInstanceOf(Template);
    expect(copy.id).toBeFalsy();
    expect(copy.sourceTemplateId).toEqual(tmplt.id);
    expect(copy.name).toEqual(tmplt.name);
    expect(copy.ownerId).toEqual(newOwnerId);
    expect(copy.latestPublishVisibility).toEqual(TemplateVisibility.ORGANIZATION);
    expect(copy.latestPublishVersion).toBeFalsy();
    expect(copy.errors).toEqual({});
    expect(copy.description).toEqual(description);
    expect(copy.created).toBeTruthy();
    expect(copy.createdById).toEqual(clonedById)
    expect(copy.modified).toBeTruthy();
  });

  it('Clone retains the expected parts of the specified VersionedTemplate', () => {
    const clonedById = casual.integer(1, 999);
    const newOwnerId = casual.url;
    const published = new VersionedTemplate({
      templateId: tmplt.id,
      version: `v34`,
      name: 'Published version',
      description,
      ownerId: casual.url,
      VersionType: TemplateVersionType.DRAFT,
      createdById: casual.integer(1, 9999),
    });

    const copy = cloneTemplate(clonedById, newOwnerId, published);

    expect(copy).toBeInstanceOf(Template);
    expect(copy.id).toBeFalsy();
    expect(copy.sourceTemplateId).toEqual(published.templateId);
    expect(copy.name).toEqual(published.name);
    expect(copy.ownerId).toEqual(newOwnerId);
    expect(copy.latestPublishVisibility).toEqual(TemplateVisibility.ORGANIZATION);
    expect(copy.latestPublishVersion).toBeFalsy();
    expect(copy.errors).toEqual({});
    expect(copy.createdById).toEqual(clonedById);
    expect(copy.description).toEqual(description);
    expect(copy.created).toBeTruthy();
    expect(copy.modified).toBeTruthy();
  });
});

describe('template versioning', () => {
  let templateStore: any[];
  let versionedTemplateStore: any[];
  let mockInsert: ReturnType<typeof mockAsyncFn>;
  let mockUpdate: ReturnType<typeof mockAsyncFn>;
  let mockFindTemplateById: ReturnType<typeof mockAsyncFn>;
  let mockFindVersionedTemplatebyId: ReturnType<typeof mockAsyncFn>;
  let mockTagFindBySectionId: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    // Mock the Sections
    const mockSectionFindByTemplateId = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
    jest.spyOn(Section, 'findByTemplateId').mockImplementation(mockSectionFindByTemplateId);

    // Mock the Tags for each section
    mockTagFindBySectionId = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
    jest.spyOn(Tag, 'findBySectionId').mockImplementation(mockTagFindBySectionId as any);

    const tstamp = getCurrentDate();

    // Setup the mock data stores
    templateStore = [
      new Template({
        id: casual.integer(1, 99),
        name: casual.sentence,
        description: casual.sentences(5),
        ownerId: casual.url,
        latestPublishVisibility: getRandomEnumValue(TemplateVisibility),
        latestPublishVersion: '',
        isDirty: true,
        bestPractice: false,
        isDefault: true,
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedTemplateStore = [];

    // Fetch an item from the templateStore
    mockFindTemplateById = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return templateStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedTemplateStore
    mockFindVersionedTemplatebyId = mockAsyncFn().mockImplementation(async (_, __, id) => {
      return versionedTemplateStore.find((entry) => { return entry.id === id });
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
        case 'templates': {
          templateStore.push(obj);
          break;
        }
        case 'versionedTemplates': {
          versionedTemplateStore.push(obj);
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
          const existing = templateStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the templateStore for id: ${obj.id}`);
          }
          templateStore.splice(templateStore.indexOf(existing), 1, obj);
          break;
        }
        case 'versionedTemplates': {
          const existing = versionedTemplateStore.find((entry) => { return entry.id === obj.id });
          if (!existing) {
            throw new Error(`No entry in the versionedTemplateStore for id: ${obj.id}`);
          }
          versionedTemplateStore.splice(versionedTemplateStore.indexOf(existing), 1, obj);
          break;
        }
      }
      return obj;
    });
  });

  it('does not allow an unsaved template to be versioned', async () => {
    const tmplt = new Template({ name: casual.words(4) });

    expect(async () => {
      await generateTemplateVersion(context, tmplt, [], context.token.id)
    }).rejects.toThrow(Error('Cannot publish unsaved Template'));
  });

  it('does not version the Template if it is not dirty', async () => {
    const tmplt = new Template({
      id: casual.integer(1, 99),
      name: casual.words(4),
      latestPublishVersion: 'v1',
    });

    // isDirty is true when the class is instantiated, so reset it
    tmplt.isDirty = false;

    expect(async () => {
      await generateTemplateVersion(context, tmplt, [], context.token.id)
    }).rejects.toThrow(Error('There are no changes to publish'));
  });

  it('does not version if the TemplateVersion could not be created', async () => {
    const tmplt = templateStore[0];
    const versioned = new VersionedTemplate({ templateId: tmplt.id });
    versioned.errors = { general: 'Test failure' };

    (context.dataSources.sqlDataSource.query as any).mockResolvedValueOnce(null);
    jest.spyOn(VersionedTemplate, 'insert').mockImplementation(mockInsert);
    const mockFindByFailure = mockAsyncFn().mockImplementation(async () => { return versioned; });
    jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockImplementation(mockFindByFailure);

    const err = `Unable to generate a new version of template ${tmplt.id}`;
    expect(async () => {
      await generateTemplateVersion(context, tmplt, [], context.token.id)
    }).rejects.toThrow(Error(err));
  });

  it('does not version if the Template could not be updated', async () => {
    const tmplt = templateStore[0];
    const updated = new Template({ id: tmplt.id });
    updated.errors = { general: 'Test failure' };

    jest.spyOn(VersionedTemplate, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockImplementation(mockFindVersionedTemplatebyId);
    const mockUpdateFailure = mockAsyncFn().mockImplementation(async () => { return updated; });
    jest.spyOn(Template, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Template, 'findById').mockImplementation(mockUpdateFailure);

    const err = `Unable to update template: ${tmplt.id}`;
    expect(async () => {
      await generateTemplateVersion(context, tmplt, [], context.token.id)
    }).rejects.toThrow(Error(err));
  });

  it('versions the Template when it has no prior versions', async () => {
    const tmplt = new Template(templateStore[0]);
    const comment = casual.sentences(3);
    const latestPublishVisibility = TemplateVisibility.ORGANIZATION;
    const versionType = TemplateVersionType.PUBLISHED;
    jest.spyOn(VersionedTemplate, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockImplementation(mockFindVersionedTemplatebyId);
    jest.spyOn(Template, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Template, 'findById').mockImplementation(mockFindTemplateById);

    const newVersion = await generateTemplateVersion(
      context,
      tmplt,
      [],
      context.token.id,
      comment,
      latestPublishVisibility,
      versionType
    );

    // Verify that the Version was created as expected
    expect(mockInsert).toHaveBeenCalled();
    expect(newVersion.id).toBeTruthy();
    expect(newVersion.created).toBeTruthy();
    expect(newVersion.modified).toBeTruthy();
    expect(newVersion.createdById).toEqual(context.token.id);
    expect(newVersion.modifiedById).toEqual(context.token.id);
    expect(newVersion.templateId).toEqual(tmplt.id);
    expect(newVersion.name).toEqual(tmplt.name);
    expect(newVersion.description).toEqual(tmplt.description);
    expect(newVersion.ownerId).toEqual(tmplt.ownerId);
    expect(newVersion.visibility).toEqual(latestPublishVisibility);
    expect(newVersion.bestPractice).toEqual(tmplt.bestPractice);
    expect(newVersion.isDefault).toEqual(tmplt.isDefault);
    expect(newVersion.version).toEqual('v1');
    expect(newVersion.versionedById).toEqual(context.token.id);
    expect(newVersion.comment).toEqual(comment);
    expect(newVersion.versionType).toEqual(versionType);
    expect(newVersion.active).toEqual(true);

    // Verify that the template was updated as expected
    expect(mockUpdate).toHaveBeenCalled();
    const updated = templateStore.find((entry) => { return entry.id === tmplt.id; });
    expect(updated.modifiedById).toEqual(tmplt.modifiedById);
    expect(updated.modified).toEqual(tmplt.modified);
    expect(updated.latestPublishVersion).toEqual(newVersion.version);
    expect(updated.isDirty).toEqual(false);
  });

  it('versions the Template when there are prior versions', async () => {
    const tmplt = new Template(templateStore[0]);
    tmplt.latestPublishVersion = 'v1';

    const oldVersion = new VersionedTemplate({
      templateId: tmplt.id,
      version: 'v1',
      versionType: getRandomEnumValue(TemplateVersionType),
      name: casual.sentence,
      description: casual.sentences(3),
      ownerId: casual.url,
      versionedById: casual.integer(1, 99),
      comment: casual.sentences(5),
      active: true,
      latestPublishVisibility: getRandomEnumValue(TemplateVisibility),
      bestPractice: true,
      isDefault: false,
    });
    versionedTemplateStore.push(oldVersion);
    const comment = casual.sentences(3);
    const versionType = TemplateVersionType.DRAFT;
    const latestPublishVisibility = TemplateVisibility.PUBLIC;

    jest.spyOn(VersionedTemplate, 'insert').mockImplementation(mockInsert);
    jest.spyOn(VersionedTemplate, 'findVersionedTemplateById').mockImplementation(mockFindVersionedTemplatebyId);
    jest.spyOn(Template, 'update').mockImplementation(mockUpdate);
    jest.spyOn(Template, 'findById').mockImplementation(mockFindTemplateById);

    const newVersion = await generateTemplateVersion(
      context,
      tmplt,
      [oldVersion],
      context.token.id,
      comment,
      latestPublishVisibility,
      versionType
    );

    // Verify that the Version was created as expected
    expect(mockInsert).toHaveBeenCalled();
    expect(newVersion.id).toBeTruthy();
    expect(newVersion.created).toBeTruthy();
    expect(newVersion.modified).toBeTruthy();
    expect(newVersion.createdById).toEqual(context.token.id);
    expect(newVersion.modifiedById).toEqual(context.token.id);
    expect(newVersion.templateId).toEqual(tmplt.id);
    expect(newVersion.name).toEqual(tmplt.name);
    expect(newVersion.description).toEqual(tmplt.description);
    expect(newVersion.ownerId).toEqual(tmplt.ownerId);
    expect(newVersion.visibility).toEqual(latestPublishVisibility);
    expect(newVersion.bestPractice).toEqual(tmplt.bestPractice);
    expect(newVersion.isDefault).toEqual(tmplt.isDefault);
    expect(newVersion.version).toEqual('v2');
    expect(newVersion.versionedById).toEqual(context.token.id);
    expect(newVersion.comment).toEqual(comment);
    expect(newVersion.versionType).toEqual(versionType);
    expect(newVersion.active).toEqual(true);

    // Verify that the template was updated as expected
    expect(mockUpdate).toHaveBeenCalled();
    const updated = templateStore.find((entry) => { return entry.id === tmplt.id; });
    expect(updated.modifiedById).toEqual(tmplt.modifiedById);
    expect(updated.modified).toEqual(tmplt.modified);
    expect(updated.latestPublishVersion).toEqual(newVersion.version);
    expect(updated.isDirty).toEqual(true);
  });
});

describe('setDefaultTemplate', () => {
  let template: InstanceType<typeof Template>;
  let oldTemplate: InstanceType<typeof VersionedTemplate>;

  beforeEach(async () => {
    jest.clearAllMocks();

    template = new Template({
      id: casual.integer(1, 99),
      name: casual.sentence,
      ownerId: casual.url,
      createdById: casual.integer(1, 99),
    });

    oldTemplate = new VersionedTemplate({
      id: casual.integer(100, 999),
      templateId: casual.integer(1000, 9999),
      name: casual.sentence,
      ownerId: casual.url,
      createdById: casual.integer(1, 99),
    });
  });

  it('successfully marks the template as default when there was no default before', async () => {
    jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(undefined);
    jest.spyOn(Template, 'query').mockResolvedValue([{}] as any);
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue([{}] as any);
    await setDefaultTemplate('Test', context, template);
    expect(VersionedTemplate.defaultTemplate).toHaveBeenCalled();
    expect(Template.query).toHaveBeenCalledTimes(1);
    expect(VersionedTemplate.query).toHaveBeenCalledTimes(1);
    expect(Template.query).toHaveBeenLastCalledWith(context, 'UPDATE templates SET isDefault = ? WHERE id = ?;', ['1', template.id.toString()], 'Test');
    expect(VersionedTemplate.query).toHaveBeenLastCalledWith(context, 'UPDATE versionedTemplates SET isDefault = ? WHERE templateId = ?;', ['1', template.id.toString()], 'Test');
  });

  it('successfully marks the template as default when one already is set', async () => {
    jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(oldTemplate);
    jest.spyOn(Template, 'query').mockResolvedValue([{}] as any);
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue([{}] as any);
    await setDefaultTemplate('Test', context, template);
    expect(VersionedTemplate.defaultTemplate).toHaveBeenCalled();
    expect(Template.query).toHaveBeenCalledTimes(2);
    expect(VersionedTemplate.query).toHaveBeenCalledTimes(2);
    expect(Template.query).toHaveBeenLastCalledWith(context, 'UPDATE templates SET isDefault = ? WHERE id = ?;', ['0', oldTemplate.templateId.toString()], 'Test');
    expect(VersionedTemplate.query).toHaveBeenLastCalledWith(context, 'UPDATE versionedTemplates SET isDefault = ? WHERE templateId = ?;', ['0', oldTemplate.templateId.toString()], 'Test');
  });

  it('does not unmark the existing template as default if the marking failed', async () => {
    jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(oldTemplate);
    jest.spyOn(Template, 'query').mockResolvedValue([]);
    await setDefaultTemplate('Test', context, template);
    expect(Template.query).toHaveBeenCalledTimes(1);
    expect(Template.query).toHaveBeenLastCalledWith(context, 'UPDATE templates SET isDefault = ? WHERE id = ?;', ['1', template.id.toString()], 'Test');
  });

  it('rolls back if marking the versionedTemplates as default fails', async () => {
    jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(undefined);
    jest.spyOn(Template, 'query').mockResolvedValue([{}] as any);
    jest.spyOn(VersionedTemplate, 'query').mockResolvedValue([]);
    await setDefaultTemplate('Test', context, template);
    expect(Template.query).toHaveBeenCalledTimes(2);
    expect(Template.query).toHaveBeenLastCalledWith(context, 'UPDATE templates SET isDefault = ? WHERE id = ?;', ['0', template.id.toString()], 'Test');
  });

  it('rolls back if the unmarking fails', async () => {
    jest.spyOn(VersionedTemplate, 'defaultTemplate').mockResolvedValue(oldTemplate);
    const tSpy = jest.spyOn(Template, 'query');
    const vtSpy = jest.spyOn(VersionedTemplate, 'query');
    tSpy.mockResolvedValueOnce([{}] as any); // Mark new template as default
    vtSpy.mockResolvedValueOnce([{}] as any); // Mark new versionedTemplate as default
    tSpy.mockResolvedValueOnce([{}] as any); // Unmark old template as default
    vtSpy.mockResolvedValueOnce([]); // Unmark old versionedTemplate as default (FAIL)
    tSpy.mockResolvedValueOnce([{}] as any); // Mark old template as default (Rollback)
    vtSpy.mockResolvedValueOnce([{}] as any); // Mark old versionedTemplate as default (Rollback)
    tSpy.mockResolvedValueOnce([{}] as any); // Unmark new template as default (Rollback)
    vtSpy.mockResolvedValueOnce([{}] as any); // Unmark new versionedTemplate as default (Rollback)

    await setDefaultTemplate('Test', context, template);
    expect(Template.query).toHaveBeenCalledTimes(4);
    expect(VersionedTemplate.query).toHaveBeenCalledTimes(4);
    expect(Template.query).toHaveBeenLastCalledWith(context, 'UPDATE templates SET isDefault = ? WHERE id = ?;', ['0', template.id.toString()], 'Test');
    expect(VersionedTemplate.query).toHaveBeenLastCalledWith(context, 'UPDATE versionedTemplates SET isDefault = ? WHERE templateId = ?;', ['0', template.id.toString()], 'Test');
  });
});