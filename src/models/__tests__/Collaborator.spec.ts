import { jest } from '@jest/globals';
import casual from 'casual';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

// Register config + logger mocks FIRST — before anything that transitively imports them
mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  sendProjectCollaborationEmail: jest.fn(),
  sendTemplateCollaborationEmail: jest.fn(),
  sendEmailConfirmationNotification: jest.fn(),
}));

// Dynamic imports AFTER all mocks are registered
const {
  Collaborator,
  ProjectCollaborator,
  ProjectCollaboratorAccessLevel,
  TemplateCollaborator
} = await import("../Collaborator.js");
const { Template } = await import("../Template.js");
const { User } = await import("../User.js");
const { Project } = await import("../Project.js");
const { Affiliation } = await import("../Affiliation.js");
const { UserEmail } = await import("../UserEmail.js");
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { sendProjectCollaborationEmail, sendTemplateCollaborationEmail } = await import('../../services/emailService.js');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Collaborator', () => {
  it('constructor should initialize as expected', () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const collaborator = new Collaborator({ email, invitedById, createdById });

    expect(collaborator.email).toEqual(email);
    expect(collaborator.invitedById).toEqual(invitedById);
    expect(collaborator.userId).toBeFalsy();
  });

  it('isValid returns true when the email and invitedById are present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const collaborator = new Collaborator({ email, invitedById, createdById });
    expect(await collaborator.isValid()).toBe(true);
  });

  it('isValid returns false when the email is NOT present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const collaborator = new Collaborator({ email, invitedById, createdById });
    collaborator.email = null;
    expect(await collaborator.isValid()).toBe(false);
    expect(Object.keys(collaborator.errors).length).toBe(1);
    expect(collaborator.errors['email']).toBeTruthy()
  });

  it('isValid returns false when the invitedById is NOT present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const collaborator = new Collaborator({ email, invitedById, createdById });
    collaborator.invitedById = null;
    expect(await collaborator.isValid()).toBe(false);
    expect(Object.keys(collaborator.errors).length).toBe(1);
    expect(collaborator.errors['invitedById']).toBeTruthy()
  });
});

describe('TemplateCollaborator', () => {
  it('constructor should initialize as expected', () => {
    const email = casual.email;
    const templateId = casual.integer(1, 999);
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const templateCollaborator = new TemplateCollaborator({ templateId, email, invitedById, createdById });

    expect(templateCollaborator.email).toEqual(email);
    expect(templateCollaborator.templateId).toEqual(templateId);
    expect(templateCollaborator.invitedById).toEqual(invitedById);
    expect(templateCollaborator.userId).toBeFalsy();
  });

  it('isValid returns true when the templateId is present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);
    const templateId = casual.integer(1, 999);

    const collaborator = new TemplateCollaborator({ email, invitedById, createdById, templateId });
    expect(await collaborator.isValid()).toBe(true);
  });

  it('isValid returns false when the templateId is NOT present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);
    const templateId = casual.integer(1, 999);

    const collaborator = new TemplateCollaborator({ email, invitedById, createdById, templateId });
    collaborator.templateId = null;
    expect(await collaborator.isValid()).toBe(false);
    expect(Object.keys(collaborator.errors).length).toBe(1);
    expect(collaborator.errors['templateId']).toBeTruthy()
  });

  describe('findBy queries', () => {
    const originalQuery = TemplateCollaborator.query;

    let localQuery;
    let context;
    let templateCollaborator;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (TemplateCollaborator.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);

      templateCollaborator = new TemplateCollaborator({
        id: casual.integer(1, 9),
        createdById: casual.integer(1, 999),
        templateId: casual.integer(1, 99),
        email: casual.email,
        invitedById: casual.integer(1, 999),
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      TemplateCollaborator.query = originalQuery;
    });

    it('findByTemplateId returns all of the Collaborators for the Template', async () => {
      localQuery.mockResolvedValueOnce([templateCollaborator]);

      const templateId = templateCollaborator.templateId;
      const result = await TemplateCollaborator.findByTemplateId('Test', context, templateId);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE templateId = ? ORDER BY email ASC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test');
      expect(result).toEqual([templateCollaborator]);
    });

    it('findByTemplateId returns an empty array if the Template has no Collaborators', async () => {
      localQuery.mockResolvedValueOnce([]);

      const templateId = templateCollaborator.templateId;
      const result = await TemplateCollaborator.findByTemplateId('Test', context, templateId);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE templateId = ? ORDER BY email ASC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString()], 'Test');
      expect(result).toEqual([]);
    });

    it('findById returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([templateCollaborator]);

      const id = templateCollaborator.id;
      const result = await TemplateCollaborator.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
      expect(result).toEqual(templateCollaborator);
    });

    it('findById returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValueOnce([]);

      const id = templateCollaborator.id;
      const result = await TemplateCollaborator.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
      expect(result).toEqual(null);
    });

    it('findByInvitedById returns the Collaborator records', async () => {
      localQuery.mockResolvedValueOnce([templateCollaborator]);

      const invitedById = templateCollaborator.invitedById;
      const result = await TemplateCollaborator.findByInvitedById('Test', context, invitedById);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE invitedById = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [invitedById.toString()], 'Test');
      expect(result).toEqual([templateCollaborator]);
    });

    it('findByEmail returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([templateCollaborator]);

      const email = templateCollaborator.email;
      const result = await TemplateCollaborator.findByEmail('Test', context, email);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [email], 'Test');
      expect(result).toEqual([templateCollaborator]);
    });

    it('findByEmail returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValueOnce([]);

      const email = templateCollaborator.email;
      const result = await TemplateCollaborator.findByEmail('Test', context, email);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [email], 'Test');
      expect(result).toEqual([]);
    });

    it('findByTemplateIdAndEmail returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([templateCollaborator]);

      const templateId = templateCollaborator.templateId;
      const email = templateCollaborator.email;
      const result = await TemplateCollaborator.findByTemplateIdAndEmail('Test', context, templateId, email);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE templateId = ? AND email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString(), email], 'Test');
      expect(result).toEqual(templateCollaborator);
    });

    it('findByTemplateIdAndEmail returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValue([]);

      const templateId = templateCollaborator.templateId;
      const email = templateCollaborator.email;
      const result = await TemplateCollaborator.findByTemplateIdAndEmail('Test', context, templateId, email);
      const expectedSql = 'SELECT * FROM templateCollaborators WHERE templateId = ? AND email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [templateId.toString(), email], 'Test');
      expect(result).toEqual(null);
    });

  });

  describe('create', () => {
    const originalFindByTemplateIdAndEmail = TemplateCollaborator.findByTemplateIdAndEmail;

    let insertQuery;
    let collaborator;

    beforeEach(() => {
      insertQuery = jest.fn();
      (TemplateCollaborator.insert as jest.Mock) = insertQuery;

      collaborator = new TemplateCollaborator({
        createdById: casual.integer(1, 999),
        templateId: casual.integer(1, 999),
        email: casual.email,
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      TemplateCollaborator.findByTemplateIdAndEmail = originalFindByTemplateIdAndEmail;
    })

    it('returns the TemplateCollaborator with errors if it is not valid', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const mockFindByTemplateIdAndEmail = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findByTemplateIdAndEmail as jest.Mock) = mockFindByTemplateIdAndEmail;
      mockFindByTemplateIdAndEmail.mockResolvedValueOnce(null);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      const result = await collaborator.create(context);
      expect(result instanceof TemplateCollaborator).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns the TemplateCollaborator with an error if the template already has that email', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockFindBy = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findByTemplateIdAndEmail as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValueOnce(collaborator);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      const result = await collaborator.create(context);
      expect(localValidator).toHaveBeenCalledTimes(0);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the newly added TemplateCollaborator', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockFindBy = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findByTemplateIdAndEmail as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValue(null);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      insertQuery.mockResolvedValueOnce(casual.integer(1, 999));

      const inviter = new User({ givenName: casual.first_name, surName: casual.last_name });
      const mockFindUserById = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      mockFindUserById.mockResolvedValueOnce(inviter);
      (User.findById as jest.Mock) = mockFindUserById;

      const tName = casual.sentence;
      const mockFindTemplateById = jest.fn<() => Promise<InstanceType<typeof Template> | null>>();
      mockFindTemplateById.mockResolvedValueOnce(new Template({ name: tName }));
      (Template.findById as jest.Mock) = mockFindTemplateById;

      jest.mocked(sendTemplateCollaborationEmail).mockResolvedValue(true);

      const mockFindById = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findById as jest.Mock) = mockFindById;
      mockFindById.mockResolvedValue(collaborator);

      const result = await collaborator.create(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(sendTemplateCollaborationEmail).toHaveBeenCalledWith(
        context, tName, inviter.getName(), collaborator.email, collaborator.userId
      );

      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(TemplateCollaborator);
    });
  });

  describe('update', () => {
    const originalUpdate = TemplateCollaborator.update;

    let updateQuery;
    let collaborator;

    beforeEach(() => {
      jest.resetAllMocks();
      updateQuery = jest.fn();
      (TemplateCollaborator.update as jest.Mock) = updateQuery;

      collaborator = new TemplateCollaborator({
        id: casual.integer(1, 99),
        createdById: casual.integer(1, 999),
        templateId: casual.integer(1, 999),
        email: casual.email,
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      TemplateCollaborator.update = originalUpdate;
    });

    it('returns the TemplateCollaborator with errors if it is not valid', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await collaborator.update(context);
      expect(result instanceof TemplateCollaborator).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns an error if the TemplateCollaborator has no id', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      collaborator.id = null;
      const result = await collaborator.update(context);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the updated TemplateCollaborator', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockExists = jest.fn<() => Promise<boolean>>();
      (Template.exists as jest.Mock) = mockExists;
      mockExists.mockResolvedValueOnce(true);

      const findById = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findById as jest.Mock) = findById;
      findById.mockResolvedValueOnce(collaborator);
      updateQuery.mockResolvedValueOnce(collaborator);

      const result = await collaborator.update(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(TemplateCollaborator);
    });
  });

  describe('delete', () => {
    let collaborator;

    beforeEach(() => {
      jest.resetAllMocks();

      collaborator = new TemplateCollaborator({
        id: casual.integer(1, 99),
        createdById: casual.integer(1, 999),
        templateId: casual.integer(1, 999),
        email: casual.email,
      });
    })

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('returns null if the TemplateCollaborator has no id', async () => {
      collaborator.id = null;
      expect(await collaborator.delete(context)).toBe(null);
    });

    it('returns the original record with an error if it was not able to delete the record', async () => {
      const deleteQuery = jest.fn<() => Promise<boolean>>();
      const findQuery = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      (TemplateCollaborator.findById as jest.Mock) = findQuery;
      (TemplateCollaborator.delete as jest.Mock) = deleteQuery;

      findQuery.mockResolvedValueOnce(collaborator);
      deleteQuery.mockResolvedValueOnce(null);
      const result = await collaborator.delete(context);
      expect(result.errors?.general).toBeDefined();
    });

    it('returns the original record if it was able to delete the record', async () => {
      const findQuery = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator> | null>>();
      const deleteQuery = jest.fn<() => Promise<boolean>>();
      (TemplateCollaborator.findById as jest.Mock) = findQuery;
      (TemplateCollaborator.delete as jest.Mock) = deleteQuery;

      findQuery.mockResolvedValueOnce(collaborator);
      deleteQuery.mockResolvedValueOnce(collaborator);
      const result = await collaborator.delete(context);
      expect(result.errors).toEqual({});
      expect(result).toBeInstanceOf(TemplateCollaborator);
    });
  });
});


describe('ProjectCollaborator', () => {
  it('constructor should initialize as expected', () => {
    const email = casual.email;
    const projectId = casual.integer(1, 999);
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);

    const projectCollaborator = new ProjectCollaborator({ projectId, email, invitedById, createdById });

    expect(projectCollaborator.email).toEqual(email);
    expect(projectCollaborator.projectId).toEqual(projectId);
    expect(projectCollaborator.invitedById).toEqual(invitedById);
    expect(projectCollaborator.userId).toBeFalsy();
    expect(projectCollaborator.accessLevel).toEqual(ProjectCollaboratorAccessLevel.COMMENT);
  });

  it('isValid returns true when the projectId is present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);
    const projectId = casual.integer(1, 999);

    const collaborator = new ProjectCollaborator({ email, invitedById, createdById, projectId });
    expect(await collaborator.isValid()).toBe(true);
  });

  it('isValid returns false when the projectId is NOT present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);
    const projectId = casual.integer(1, 999);

    const collaborator = new ProjectCollaborator({ email, invitedById, createdById, projectId });
    collaborator.projectId = null;
    expect(await collaborator.isValid()).toBe(false);
    expect(Object.keys(collaborator.errors).length).toBe(1);
    expect(collaborator.errors['projectId']).toBeTruthy()
  });

  it('isValid returns false when the accessLevel is NOT present', async () => {
    const email = casual.email;
    const invitedById = casual.integer(1, 999);
    const createdById = casual.integer(1, 999);
    const projectId = casual.integer(1, 999);

    const collaborator = new ProjectCollaborator({ email, invitedById, createdById, projectId });
    collaborator.accessLevel = null;
    expect(await collaborator.isValid()).toBe(false);
    expect(Object.keys(collaborator.errors).length).toBe(1);
    expect(collaborator.errors['accessLevel']).toBeTruthy()
  });

  describe('findBy queries', () => {
    const originalQuery = ProjectCollaborator.query;

    let localQuery;
    let context;
    let projectCollaborator;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (ProjectCollaborator.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);

      projectCollaborator = new ProjectCollaborator({
        id: casual.integer(1, 9),
        createdById: casual.integer(1, 999),
        projectId: casual.integer(1, 99),
        email: casual.email,
        invitedById: casual.integer(1, 999),
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      ProjectCollaborator.query = originalQuery;
    });

    it('findByProjectId returns all of the Collaborators for the Template', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const projectId = projectCollaborator.projectId;
      const result = await ProjectCollaborator.findByProjectId('Test', context, projectId);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE projectId = ? ORDER BY email ASC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'Test');
      expect(result).toEqual([projectCollaborator]);
    });

    it('findByTemplateId returns an empty array if the Template has no Collaborators', async () => {
      localQuery.mockResolvedValueOnce([]);

      const projectId = projectCollaborator.projectId;
      const result = await ProjectCollaborator.findByProjectId('Test', context, projectId);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE projectId = ? ORDER BY email ASC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'Test');
      expect(result).toEqual([]);
    });

    it('findById returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const id = projectCollaborator.id;
      const result = await ProjectCollaborator.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
      expect(result).toEqual(projectCollaborator);
    });

    it('findById returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValueOnce([]);

      const id = projectCollaborator.id;
      const result = await ProjectCollaborator.findById('Test', context, id);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
      expect(result).toEqual(null);
    });

    it('findByInvitedById returns the Collaborator records', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const invitedById = projectCollaborator.invitedById;
      const result = await ProjectCollaborator.findByInvitedById('Test', context, invitedById);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE invitedById = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [invitedById.toString()], 'Test');
      expect(result).toEqual([projectCollaborator]);
    });

    it('findByEmail returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const email = projectCollaborator.email;
      const result = await ProjectCollaborator.findByEmail('Test', context, email);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [email], 'Test');
      expect(result).toEqual([projectCollaborator]);
    });

    it('findByEmail returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValueOnce([]);

      const email = projectCollaborator.email;
      const result = await ProjectCollaborator.findByEmail('Test', context, email);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [email], 'Test');
      expect(result).toEqual([]);
    });

    it('findByUserIdAndProjectId returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const userId = casual.integer(1, 999);
      const projectId = projectCollaborator.projectId;
      const result = await ProjectCollaborator.findByUserIdAndProjectId('Test', context, userId, projectId);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE userId = ? AND projectId = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [userId.toString(), projectId.toString()], 'Test');
      expect(result).toEqual(projectCollaborator);
    });

    it('findByUserIdAndProjectId returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValueOnce([]);

      const userId = casual.integer(1, 999);
      const projectId = projectCollaborator.projectId;
      const result = await ProjectCollaborator.findByUserIdAndProjectId('Test', context, userId, projectId);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE userId = ? AND projectId = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [userId.toString(), projectId.toString()], 'Test');
      expect(result).toEqual(null);
    });

    it('findByProjectIdAndEmail returns the Collaborator', async () => {
      localQuery.mockResolvedValueOnce([projectCollaborator]);

      const projectId = projectCollaborator.projectId;
      const email = projectCollaborator.email;
      const result = await ProjectCollaborator.findByProjectIdAndEmail('Test', context, projectId, email);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE projectId = ? AND email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString(), email], 'Test');
      expect(result).toEqual(projectCollaborator);
    });

    it('findByTemplateIdAndEmail returns null if there is no Collaborator', async () => {
      localQuery.mockResolvedValue([]);

      const projectId = projectCollaborator.projectId;
      const email = projectCollaborator.email;
      const result = await ProjectCollaborator.findByProjectIdAndEmail('Test', context, projectId, email);
      const expectedSql = 'SELECT * FROM projectCollaborators WHERE projectId = ? AND email = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString(), email], 'Test');
      expect(result).toEqual(null);
    });

  });

  describe('create', () => {
    const originalFindByTemplateIdAndEmail = ProjectCollaborator.findByProjectIdAndEmail;

    let insertQuery;
    let collaborator;

    beforeEach(() => {
      insertQuery = jest.fn();
      (ProjectCollaborator.insert as jest.Mock) = insertQuery;

      collaborator = new ProjectCollaborator({
        createdById: casual.integer(1, 999),
        projectId: casual.integer(1, 999),
        email: casual.email,
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
      ProjectCollaborator.findByProjectIdAndEmail = originalFindByTemplateIdAndEmail;
    })

    it('returns the ProjectCollaborator with errors if it is not valid', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const mockFindBy = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findByProjectIdAndEmail as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValue(null);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      const result = await collaborator.create(context);
      expect(result instanceof ProjectCollaborator).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns the ProjectCollaborator with an error if the template already has that email', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockFindBy = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findByProjectIdAndEmail as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValueOnce(collaborator);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      const result = await collaborator.create(context);
      expect(localValidator).toHaveBeenCalledTimes(0);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the newly added ProjectCollaborator', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockFindBy = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findByProjectIdAndEmail as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValue(null);

      const mockUser = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      (User.findByEmail as jest.Mock) = mockUser;
      mockUser.mockResolvedValueOnce(null);

      insertQuery.mockResolvedValueOnce(casual.integer(1, 999));

      const inviter = new User({ givenName: casual.first_name, surName: casual.last_name });
      const mockFindUserById = jest.fn<() => Promise<InstanceType<typeof User> | null>>();
      mockFindUserById.mockResolvedValueOnce(inviter);
      (User.findById as jest.Mock) = mockFindUserById;

      const pName = casual.sentence;
      const mockFindProjectById = jest.fn<() => Promise<InstanceType<typeof Project> | null>>();
      mockFindProjectById.mockResolvedValueOnce(new Project({ title: pName }));
      (Project.findById as jest.Mock) = mockFindProjectById;

      jest.mocked(sendProjectCollaborationEmail).mockResolvedValue(true);
      const mockFindById = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findById as jest.Mock) = mockFindById;
      mockFindById.mockResolvedValue(collaborator);

      const result = await collaborator.create(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(sendProjectCollaborationEmail).toHaveBeenCalledWith(
        context, pName, inviter.getName(), collaborator.email, collaborator.userId
      );
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(ProjectCollaborator);
    });
  });

  describe('update', () => {
    const originalUpdate = ProjectCollaborator.update;

    let updateQuery;
    let collaborator;

    beforeEach(() => {
      jest.resetAllMocks();
      updateQuery = jest.fn();
      (ProjectCollaborator.update as jest.Mock) = updateQuery;

      collaborator = new ProjectCollaborator({
        id: casual.integer(1, 99),
        createdById: casual.integer(1, 999),
        projectId: casual.integer(1, 999),
        email: casual.email,
      })
    });

    afterEach(() => {
      jest.clearAllMocks();
      ProjectCollaborator.update = originalUpdate;
    });

    it('returns the ProjectCollaborator with errors if it is not valid', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await collaborator.update(context);
      expect(result instanceof ProjectCollaborator).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns an error if the ProjectCollaborator has no id', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      collaborator.id = null;
      const result = await collaborator.update(context);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the updated ProjectCollaborator', async () => {
      const localValidator = jest.fn<() => Promise<boolean>>();
      (collaborator.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      const mockExists = jest.fn<() => Promise<boolean>>();
      (Project.exists as jest.Mock) = mockExists;
      mockExists.mockResolvedValueOnce(true);

      const findById = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findById as jest.Mock) = findById;
      findById.mockResolvedValueOnce(collaborator);
      updateQuery.mockResolvedValueOnce(collaborator);

      const result = await collaborator.update(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(ProjectCollaborator);
    });
  });

  describe('delete', () => {
    let collaborator;

    beforeEach(() => {
      jest.resetAllMocks();

      collaborator = new ProjectCollaborator({
        id: casual.integer(1, 99),
        createdById: casual.integer(1, 999),
        projectId: casual.integer(1, 999),
        email: casual.email,
      });
    })

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('returns null if the ProjectCollaborator has no id', async () => {
      collaborator.id = null;
      expect(await collaborator.delete(context)).toBe(null);
    });

    it('returns the original record with an error if it was not able to delete the record', async () => {
      const deleteQuery = jest.fn<() => Promise<boolean>>();
      const findQuery = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      (ProjectCollaborator.findById as jest.Mock) = findQuery;
      (ProjectCollaborator.delete as jest.Mock) = deleteQuery;

      findQuery.mockResolvedValueOnce(collaborator);
      deleteQuery.mockResolvedValueOnce(null);
      const result = await collaborator.delete(context);
      expect(result.errors?.general).toBeDefined();
    });

    it('returns the original record if it was able to delete the record', async () => {
      const findQuery = jest.fn<() => Promise<InstanceType<typeof ProjectCollaborator> | null>>();
      const deleteQuery = jest.fn<() => Promise<boolean>>();
      (ProjectCollaborator.findById as jest.Mock) = findQuery;
      (ProjectCollaborator.delete as jest.Mock) = deleteQuery;

      findQuery.mockResolvedValueOnce(collaborator);
      deleteQuery.mockResolvedValueOnce(collaborator);
      const result = await collaborator.delete(context);
      expect(result.errors).toEqual({});
      expect(result).toBeInstanceOf(ProjectCollaborator);
    });
  });

  describe('findPrimaryUserByProjectId', () => {
    const originalQuery = ProjectCollaborator.query;

    let localQuery;
    let projectId;

    beforeEach(async () => {
      jest.resetAllMocks();
      projectId = casual.integer(1, 999);

      localQuery = jest.fn();
      (ProjectCollaborator.query as jest.Mock) = localQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      ProjectCollaborator.query = originalQuery;
    });

    it('returns null when no results are found', async () => {
      localQuery.mockResolvedValueOnce([]);

      const result = await ProjectCollaborator.findPrimaryUserByProjectId(
        'Test', context, projectId
      );
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('returns null when query returns a non-array', async () => {
      localQuery.mockResolvedValueOnce(null);

      const result = await ProjectCollaborator.findPrimaryUserByProjectId(
        'Test', context, projectId
      );
      expect(result).toBeNull();
    });

    it('returns a ProjectCollaboratorWithUser with affiliationId from the result row', async () => {
      const affiliationId = casual.uuid;
      const row = {
        collaboratorId: casual.integer(1, 99),
        projectId,
        email: casual.email,
        accessLevel: 'PRIMARY',
        collaboratorCreated: new Date().toISOString(),
        userId: casual.integer(1, 99),
        affiliationId,
        active: 1,
      };
      localQuery.mockResolvedValueOnce([row]);

      const result = await ProjectCollaborator.findPrimaryUserByProjectId(
        'Test', context, projectId
      );
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('pc.accessLevel = "PRIMARY"'),
        [projectId.toString()],
        'Test'
      );
      expect(result).toBeInstanceOf(ProjectCollaborator);
      expect(result.affiliationId).toEqual(affiliationId);
    });

    it('sets affiliationId to null when the row has no affiliationId', async () => {
      const row = {
        collaboratorId: casual.integer(1, 99),
        projectId,
        email: casual.email,
        accessLevel: 'PRIMARY',
        collaboratorCreated: new Date().toISOString(),
        userId: casual.integer(1, 99),
        affiliationId: null,
        active: 1,
      };
      localQuery.mockResolvedValueOnce([row]);

      const result = await ProjectCollaborator.findPrimaryUserByProjectId(
        'Test', context, projectId
      );
      expect(result).toBeInstanceOf(ProjectCollaborator);
      expect(result.affiliationId).toBeNull();
    });
  });

  describe('findOwnerByProjectId', () => {
    const originalQuery = ProjectCollaborator.query;

    let localQuery;
    let projectId;

    beforeEach(async () => {
      jest.resetAllMocks();
      projectId = casual.integer(1, 999);

      localQuery = jest.fn();
      (ProjectCollaborator.query as jest.Mock) = localQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      ProjectCollaborator.query = originalQuery;
    });

    it('returns null when no results are found', async () => {
      localQuery.mockResolvedValueOnce([]);

      const result = await ProjectCollaborator.findOwnerByProjectId(
        'Test', context, projectId
      );
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('returns null when query returns a non-array', async () => {
      localQuery.mockResolvedValueOnce(null);

      const result = await ProjectCollaborator.findOwnerByProjectId(
        'Test', context, projectId
      );
      expect(result).toBeNull();
    });

    it('returns a ProjectCollaboratorWithUser with affiliationId from the result row', async () => {
      const affiliationId = casual.uuid;
      const row = {
        collaboratorId: casual.integer(1, 99),
        projectId,
        email: casual.email,
        accessLevel: 'OWN', // Testing for OWN access level
        collaboratorCreated: new Date().toISOString(),
        userId: casual.integer(1, 99),
        affiliationId,
        active: 1,
      };
      localQuery.mockResolvedValueOnce([row]);

      const result = await ProjectCollaborator.findOwnerByProjectId(
        'Test', context, projectId
      );
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenCalledWith(
        context,
        expect.stringContaining('pc.accessLevel = "OWN"'),
        [projectId.toString()],
        'Test'
      );
      expect(result).toBeInstanceOf(ProjectCollaborator);
      expect(result.affiliationId).toEqual(affiliationId);
    });

    it('sets affiliationId to null when the row has no affiliationId', async () => {
      const row = {
        collaboratorId: casual.integer(1, 99),
        projectId,
        email: casual.email,
        accessLevel: 'PRIMARY',
        collaboratorCreated: new Date().toISOString(),
        userId: casual.integer(1, 99),
        affiliationId: null,
        active: 1,
      };
      localQuery.mockResolvedValueOnce([row]);

      const result = await ProjectCollaborator.findOwnerByProjectId(
        'Test', context, projectId
      );
      expect(result).toBeInstanceOf(ProjectCollaborator);
      expect(result.affiliationId).toBeNull();
    });
  });

  describe('findPotentialCollaboratorByORCID', () => {
    const originalFindByOrcid = User.findByOrcid;
    const originalProjectMemberFindByOrcid = ProjectCollaborator.findPotentialCollaboratorByORCID;

    let localQuery;
    let orcidId;

    beforeEach(async () => {
      jest.resetAllMocks();
      orcidId = 'https://sandbox.orcid.org/0000-0002-1825-0097';

      localQuery = jest.fn();
      (User.findByOrcid as jest.Mock) = localQuery;
      (ProjectCollaborator.findPotentialCollaboratorByORCID as jest.Mock) = localQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
      User.findByOrcid = originalFindByOrcid;
      ProjectCollaborator.findPotentialCollaboratorByORCID = originalProjectMemberFindByOrcid;
    });

    it('returns null if ORCID is invalid', async () => {
      const result = await ProjectCollaborator.findPotentialCollaboratorByORCID(
        'Test',
        context,
        'abcdefg'
      );
      expect(result).toBeFalsy();
    });

    it('returns user data if found in User table', async () => {
      const user = new User({
        id: casual.integer(1, 99),
        givenName: casual.first_name,
        surName: casual.last_name,
        orcid: orcidId,
      });
      localQuery.mockResolvedValueOnce(user);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValueOnce(null);
      jest.spyOn(UserEmail, 'findPrimaryByUserId').mockResolvedValueOnce(new UserEmail({
        userId: user.id,
        email: casual.email
      }));

      const result = await ProjectCollaborator.findPotentialCollaboratorByORCID('Test', context, orcidId);
      expect(result).toBeDefined();
      expect(result.orcid).toEqual(orcidId);
      expect(result.givenName).toEqual(user.givenName);
    });
  });

  describe('findPotentialCollaboratorsByTerm', () => {
    let localQuery;

    beforeEach(async () => {
      jest.resetAllMocks();

      localQuery = jest.fn();
      (ProjectCollaborator.query as jest.Mock) = localQuery;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('returns empty results if no projects found', async () => {
      const mockFindByAffiliation = jest.fn<() => Promise<InstanceType<typeof Project>[]>>().mockResolvedValueOnce([]);
      (Project.findByAffiliation as jest.Mock) = mockFindByAffiliation;

      const result = await ProjectCollaborator.findPotentialCollaboratorsByTerm('Test', context, 'search');
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });

    it('returns paginated results when projects exist', async () => {
      const projects = [
        new Project({ id: casual.integer(1, 99) }),
        new Project({ id: casual.integer(100, 199) })
      ];
      const mockFindByAffiliation = jest.fn<() => Promise<InstanceType<typeof Project>[]>>();
      mockFindByAffiliation.mockResolvedValueOnce(projects);
      (Project.findByAffiliation as jest.Mock) = mockFindByAffiliation;

      const collaborators = Array.from({ length: 3 }, () => ({
        id: casual.integer(1, 99),
        givenName: casual.first_name,
        surName: casual.last_name,
        email: casual.email,
        cursorId: casual.uuid
      }));
      localQuery.mockResolvedValueOnce(collaborators);
      localQuery.mockResolvedValueOnce([{ total: collaborators.length }]);

      const result = await ProjectCollaborator.findPotentialCollaboratorsByTerm('Test', context, 'search');
      expect(result.items).toHaveLength(collaborators.length);
      expect(result.totalCount).toBe(collaborators.length);
      expect(result.hasNextPage).toBe(false);
    });
  });


});
