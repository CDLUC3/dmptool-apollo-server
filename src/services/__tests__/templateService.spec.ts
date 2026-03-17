import casual from 'casual';
import { Template, TemplateVisibility } from "../../models/Template";
import { VersionedTemplate, TemplateVersionType } from '../../models/VersionedTemplate';
import { cloneTemplate, generateTemplateVersion, hasPermissionOnTemplate } from '../templateService';
import { TemplateCollaborator } from '../../models/Collaborator';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { isSuperAdmin } from '../authService';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { Section } from '../../models/Section';
import { getRandomEnumValue } from '../../__tests__/helpers';
import { getCurrentDate } from '../../utils/helpers';
import { logger } from '../../logger';
import { Tag } from '../../models/Tag';

// Mock all calls to process template customizations
jest.mock('../../services/templateCustomizationService', () => ({
  handleFunderTemplateRepublication: jest.fn().mockResolvedValue(0)
}));

// Pulling context in here so that the mysql gets mocked
jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('hasPermissionOnTemplate', () => {
  let template;
  let collaborator;
  let mockIsSuperAdmin;
  let mockFindByTemplateAndEmail;
  let context;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    mockIsSuperAdmin = jest.fn();
    (isSuperAdmin as jest.Mock) = mockIsSuperAdmin;

    mockFindByTemplateAndEmail = jest.fn();
    (TemplateCollaborator.findByTemplateIdAndEmail as jest.Mock) = mockFindByTemplateAndEmail;

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

    context.token = { affiliationId: 'https://test.example.com/foo' };
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it('returns true if the current user\'s affiliation is the same as the template\'s owner', async () => {
    mockIsSuperAdmin.mockReturnValue(false);

    context.token = { affiliationId: template.ownerId };
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);

  });

  it('returns true if the current user is a collaborator for the template', async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockFindByTemplateAndEmail.mockResolvedValueOnce(collaborator);

    context.token = { affiliationId: 'https://test.example.com/foo' };
    expect(await hasPermissionOnTemplate(context, template)).toBe(true)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockFindByTemplateAndEmail).toHaveBeenCalledTimes(1);
  });

  it('returns false when the user does not have permission', async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockFindByTemplateAndEmail.mockResolvedValueOnce(null);

    context.token = { affiliationId: 'https://test.example.com/other-foo' };
    expect(await hasPermissionOnTemplate(context, template)).toBe(false)
    expect(mockIsSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockFindByTemplateAndEmail).toHaveBeenCalledTimes(1);
  });
});

describe('cloneTemplate', () => {
  let id;
  let name;
  let description;
  let createdById;
  let ownerId;
  let tmplt;

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
  let templateStore;
  let versionedTemplateStore;
  let mockInsert;
  let mockUpdate;
  let mockFindTemplateById;
  let mockFindVersionedTemplatebyId;
  let mockTagFindBySectionId;

  beforeEach(() => {
    // Mock the Sections
    const mockSectionFindByTemplateId = jest.fn().mockResolvedValue([]);
    (Section.findByTemplateId as jest.Mock) = mockSectionFindByTemplateId;

    // Mock the Tags for each section
    mockTagFindBySectionId = jest.fn().mockResolvedValue([]);
    (Tag.findBySectionId as jest.Mock) = mockTagFindBySectionId;

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
        createdById: casual.integer(1, 999),
        created: tstamp,
        modifiedById: casual.integer(1, 999),
        modified: tstamp,
      }),
    ];
    versionedTemplateStore = [];

    // Fetch an item from the templateStore
    mockFindTemplateById = jest.fn().mockImplementation((_, __, id) => {
      return templateStore.find((entry) => { return entry.id === id });
    });

    // Fetch an item from the versionedTemplateStore
    mockFindVersionedTemplatebyId = jest.fn().mockImplementation((_, __, id) => {
      return versionedTemplateStore.find((entry) => { return entry.id === id });
    });

    // Add the entry to the appropriate store
    mockInsert = jest.fn().mockImplementation((context, table, obj) => {
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
    mockUpdate = jest.fn().mockImplementation((context, table, obj, _ref, _keys, noTouch) => {
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

    (context.dataSources.sqlDataSource.query as jest.Mock).mockResolvedValueOnce(null);
    (VersionedTemplate.insert as jest.Mock) = mockInsert;
    const mockFindByFailure = jest.fn().mockImplementation(() => { return versioned; });
    (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindByFailure;

    const err = `Unable to generate a new version of template ${tmplt.id}`;
    expect(async () => {
      await generateTemplateVersion(context, tmplt, [], context.token.id)
    }).rejects.toThrow(Error(err));
  });

  it('does not version if the Template could not be updated', async () => {
    const tmplt = templateStore[0];
    const updated = new Template({ id: tmplt.id });
    updated.errors = { general: 'Test failure' };

    (VersionedTemplate.insert as jest.Mock) = mockInsert;
    (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindVersionedTemplatebyId;
    const mockUpdateFailure = jest.fn().mockImplementation(() => { return updated; });
    (Template.update as jest.Mock) = mockUpdate;
    (Template.findById as jest.Mock) = mockUpdateFailure;

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
    (VersionedTemplate.insert as jest.Mock) = mockInsert;
    (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindVersionedTemplatebyId;
    (Template.update as jest.Mock) = mockUpdate;
    (Template.findById as jest.Mock) = mockFindTemplateById;

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
    });
    versionedTemplateStore.push(oldVersion);
    const comment = casual.sentences(3);
    const versionType = TemplateVersionType.DRAFT;
    const latestPublishVisibility = TemplateVisibility.PUBLIC;

    (VersionedTemplate.insert as jest.Mock) = mockInsert;
    (VersionedTemplate.findVersionedTemplateById as jest.Mock) = mockFindVersionedTemplatebyId;
    (Template.update as jest.Mock) = mockUpdate;
    (Template.findById as jest.Mock) = mockFindTemplateById;

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
