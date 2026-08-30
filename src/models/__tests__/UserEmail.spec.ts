import { jest } from '@jest/globals';
import casual from "casual";

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

//Dynamic imports AFTER all mocks are registered
const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { User } = await import("../User.js");
const { UserEmail } = await import("../UserEmail.js");
const { TemplateCollaborator } = await import("../Collaborator.js");
const { sendEmailConfirmationNotification } = await import("../../services/emailService.js");

let context;
let mockUser;

beforeEach(async () => {
  jest.resetAllMocks();

  mockUser = new User({
    id: casual.integer(1, 999),
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId: casual.url,
    acceptedTerms: true,
  });

  context = buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
})

describe('constructor', () => {
  it('should set the expected properties', () => {
    const props = {
      id: casual.integer(1, 99999),
      userId: casual.integer(1, 999),
      email: casual.email,
      isPrimary: casual.boolean,
      isConfirmed: casual.boolean,
    }

    const userEmail = new UserEmail(props);
    expect(userEmail.id).toEqual(props.id);
    expect(userEmail.email).toEqual(props.email);
    expect(userEmail.userId).toEqual(props.userId);
    expect(userEmail.isPrimary).toEqual(props.isPrimary);
    expect(userEmail.isConfirmed).toEqual(props.isConfirmed);
  });

  it('should set the defaults properly', () => {
    const props = {
      email: casual.email,
      userId: casual.integer(1, 99),
      createdById: casual.integer(1, 99),
    };
    const userEmail = new UserEmail(props);
    expect(userEmail.id).toBeFalsy();
    expect(userEmail.email).toEqual(props.email);
    expect(userEmail.userId).toEqual(props.userId);
    expect(userEmail.isPrimary).toBe(false);
    expect(userEmail.isConfirmed).toBe(false);
    expect(userEmail.created).toBeTruthy();
    expect(userEmail.createdById).toEqual(props.createdById);
    expect(userEmail.modified).toBeTruthy();
    expect(userEmail.modifiedById).toBe(props.createdById);
  });
});

describe('validate a new UserEmail', () => {
  let mockUserEmail;

  beforeEach(() => {
    mockUserEmail = new UserEmail({
      email: casual.email,
      userId: casual.integer(1, 999),
      isPrimary: casual.boolean,
      isConfirmed: casual.boolean,
      createdById: casual.integer(1, 99),
      modifiedById: casual.integer(1, 99),
    });
  })

  it('should return true when we have a new user with a valid password', async () => {
    expect(await mockUserEmail.isValid()).toBe(true);
  });

  it('should return false when the email is missing', async () => {
    mockUserEmail.email = null;
    expect(await mockUserEmail.isValid()).toBe(false);
    expect(Object.keys(mockUserEmail.errors).length).toBe(1);
    expect(mockUserEmail.errors['email']).toEqual('Invalid email address');
  });

  it('should return false when the userId is missing', async () => {
    mockUserEmail.userId = null;
    expect(await mockUserEmail.isValid()).toBe(false);
    expect(Object.keys(mockUserEmail.errors).length).toBe(1);
    expect(mockUserEmail.errors['userId']).toEqual('User can\'t be blank');
  });
});

describe('findBy functions', () => {
  let mockUserEmail;

  let mockQuery;

  beforeEach(() => {
    mockUserEmail = new UserEmail({
      id: casual.integer(1, 9999),
      email: casual.email,
      userId: casual.integer(1, 999),
      isPrimary: casual.boolean,
      isConfirmed: casual.boolean,
    });

    mockQuery = jest.fn();
    (UserEmail.query as jest.Mock) = mockQuery;
  });

  it('findById returns the UserEmail', async () => {
    mockQuery.mockResolvedValueOnce([mockUserEmail]);

    const id = mockUserEmail.id;
    const result = await UserEmail.findById('Test', context, id);
    const expectedSql = 'SELECT * FROM userEmails WHERE id = ?';
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
    expect(result).toEqual(mockUserEmail);
  });

  it('findById returns null if the record does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await UserEmail.findById('Test', context, mockUserEmail.id);
    expect(result).toEqual(null);
  });

  it('findByUserIdAndEmail returns the UserEmail', async () => {
    mockQuery.mockResolvedValueOnce([mockUserEmail]);

    const id = mockUserEmail.userId;
    const email = mockUserEmail.email;
    const result = await UserEmail.findByUserIdAndEmail('Test', context, id, email);
    const expectedSql = 'SELECT * FROM userEmails WHERE userId = ? AND email = ?';
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString(), email], 'Test');
    expect(result).toEqual(mockUserEmail);
  });

  it('findByUserIdAndEmail returns null if the record does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const id = mockUserEmail.userId;
    const email = mockUserEmail.email;
    const result = await UserEmail.findByUserIdAndEmail('Test', context, id, email);
    expect(result).toEqual(null);
  });

  it('findByUserId returns the UserEmail', async () => {
    mockQuery.mockResolvedValueOnce([mockUserEmail]);

    const id = mockUserEmail.userId;
    const result = await UserEmail.findByUserId('Test', context, id);
    const expectedSql = 'SELECT * FROM userEmails WHERE userId = ?';
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(context, expectedSql, [id.toString()], 'Test');
    expect(result).toEqual([mockUserEmail]);
  });

  it('findByUserId returns null if the record does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await UserEmail.findByUserId('Test', context, mockUserEmail.userId);
    expect(result).toEqual([]);
  });

  it('findByEmail returns the UserEmail', async () => {
    mockQuery.mockResolvedValueOnce([mockUserEmail]);

    const result = await UserEmail.findByEmail('Test', context, mockUserEmail.email);
    const expectedSql = 'SELECT * FROM userEmails WHERE email = ?';
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(context, expectedSql, [mockUserEmail.email], 'Test');
    expect(result).toEqual([mockUserEmail]);
  });

  it('findByEmail returns null if the record does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await UserEmail.findByEmail('Test', context, mockUserEmail.email);
    expect(result).toEqual([]);
  });
});

describe('confirmEmail', () => {
  let mockUserEmail;
  let mockOtherEmails;
  let mockTemplateCollaborators;

  let mockFindUserEmailById;
  let mockFindUserEmailByUserIdAndEmail;
  let mockFindUserEmailByEmail;
  let mockUpdate;
  let mockFindTemplateCollaboratorByEmail;
  let mockFindTemplateCollaboratorById;
  let mockUpdateTemplateCollaborator;
  let mockDelete;

  beforeEach(async () => {
    context = buildMockContextWithToken(logger);

    mockUserEmail = new UserEmail({ id: casual.integer(1, 99), email: casual.email, userId: mockUser.id });

    mockOtherEmails = [
      new UserEmail({ id: 1, email: mockUserEmail.email, userId: casual.integer(99991, 999999) }),
      new UserEmail({ id: 2, email: mockUserEmail.email, userId: casual.integer(99991, 999999) }),
    ];

    mockTemplateCollaborators = [
      new TemplateCollaborator({ id: 1, email: mockUserEmail.email, templateId: casual.integer(1, 999) }),
      new TemplateCollaborator({ id: 2, email: mockUserEmail.email, templateId: casual.integer(1, 999) }),
    ]

    mockFindUserEmailById = jest.fn();
    (UserEmail.findById as jest.Mock) = mockFindUserEmailById;

    mockFindUserEmailByUserIdAndEmail = jest.fn();
    (UserEmail.findByUserIdAndEmail as jest.Mock) = mockFindUserEmailByUserIdAndEmail;

    mockFindUserEmailByEmail = jest.fn();
    (UserEmail.findByEmail as jest.Mock) = mockFindUserEmailByEmail;

    mockFindTemplateCollaboratorByEmail = jest.fn();
    (TemplateCollaborator.findByEmail as jest.Mock) = mockFindTemplateCollaboratorByEmail;

    mockFindTemplateCollaboratorById = jest.fn();
    (TemplateCollaborator.findById as jest.Mock) = mockFindTemplateCollaboratorById;

    mockUpdateTemplateCollaborator = jest.fn();
    (TemplateCollaborator.update as jest.Mock) = mockUpdateTemplateCollaborator;

    mockUpdate = jest.fn();
    (UserEmail.update as jest.Mock) = mockUpdate;
    (TemplateCollaborator.update as jest.Mock) = mockUpdate;

    mockDelete = jest.fn();
    (UserEmail.delete as jest.Mock) = mockDelete;
  });

  it('returns null if the UserEmail does not exist', async () => {
    mockFindUserEmailByUserIdAndEmail.mockResolvedValue(null);
    expect(await UserEmail.confirmEmail(context, mockUser.id, mockUser.email)).toBeFalsy();
  });

  it('returns the UserEmail with errors if it was already confirmed by another user', async () => {
    mockFindUserEmailByUserIdAndEmail.mockResolvedValue(mockUserEmail);

    mockOtherEmails[0].isConfirmed = true;
    mockFindUserEmailByEmail.mockResolvedValue(mockOtherEmails);
    const result = await UserEmail.confirmEmail(context, mockUser.id, mockUser.email)
    expect(result).toEqual(mockUserEmail);
    expect(result.errors['email']).toEqual('Email has already been confirmed by another account');
  });

  it('returns the confirmed UserEmail if successful', async () => {
    mockFindUserEmailByUserIdAndEmail.mockResolvedValue(mockUserEmail);
    mockFindUserEmailByEmail.mockResolvedValue([]);
    const confirmedEmail = structuredClone(mockUserEmail);
    confirmedEmail.isConfirmed = true;
    mockFindUserEmailById.mockResolvedValue(confirmedEmail);
    mockFindTemplateCollaboratorByEmail.mockResolvedValue([]);

    const result = await UserEmail.confirmEmail(context, mockUser.id, mockUserEmail.email)
    expect(result).toEqual(confirmedEmail);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('claims open collaboration invites if successful', async () => {
    mockFindUserEmailByUserIdAndEmail.mockResolvedValue(mockUserEmail);
    mockFindUserEmailByEmail.mockResolvedValue([]);
    const confirmedEmail = structuredClone(mockUserEmail);
    confirmedEmail.isConfirmed = true;
    mockFindUserEmailById.mockResolvedValue(confirmedEmail);
    mockFindTemplateCollaboratorByEmail.mockResolvedValue(mockTemplateCollaborators);
    mockFindTemplateCollaboratorById.mockResolvedValue(mockTemplateCollaborators[0]);
    mockUpdateTemplateCollaborator.mockResolvedValue(mockTemplateCollaborators[0]);

    // Mock the instance method update for each collaborator
    for (const collab of mockTemplateCollaborators) {
      collab.update = jest.fn<() => Promise<InstanceType<typeof TemplateCollaborator>>>().mockResolvedValue(collab);
    }

    const result = await UserEmail.confirmEmail(context, mockUser.id, mockUserEmail.email)
    expect(result).toEqual(confirmedEmail);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    for (const collab of mockTemplateCollaborators) {
      expect(collab.update).toHaveBeenCalledTimes(1);
    }
  });

  it('removes other unconfirmed records associated with other users if successful', async () => {
    mockFindUserEmailByUserIdAndEmail.mockResolvedValue(mockUserEmail);
    mockFindUserEmailByEmail.mockResolvedValue(mockOtherEmails);
    const confirmedEmail = structuredClone(mockUserEmail);
    confirmedEmail.isConfirmed = true;
    mockFindUserEmailById.mockResolvedValue(confirmedEmail);
    mockFindTemplateCollaboratorByEmail.mockResolvedValue([]);

    const result = await UserEmail.confirmEmail(context, mockUser.id, mockUserEmail.email)
    expect(result).toEqual(confirmedEmail);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});

describe('create', () => {
  let mockUserEmail;

  let mockValid;
  let mockFindByEmail;
  let mockFindById;
  let mockInsert;

  beforeEach(() => {
    jest.resetAllMocks();

    mockUserEmail = new UserEmail({
      email: casual.email,
      userId: casual.integer(1, 999),
      isPrimary: casual.boolean,
      isConfirmed: casual.boolean,
    });

    mockValid = jest.fn<() => Promise<boolean>>();
    (mockUserEmail.isValid as jest.Mock) = mockValid;

    mockFindByEmail = jest.fn<() => Promise<InstanceType<typeof UserEmail>[]>>().mockResolvedValue([]);
    (UserEmail.findByEmail as jest.Mock) = mockFindByEmail;

    mockFindById = jest.fn<() => Promise<InstanceType<typeof UserEmail> | null>>().mockResolvedValue(mockUserEmail);
    (UserEmail.findById as jest.Mock) = mockFindById;

    mockInsert = jest.fn<() => Promise<InstanceType<typeof UserEmail>>>().mockResolvedValue(mockUserEmail);
    (UserEmail.insert as jest.Mock) = mockInsert;

    jest.mocked(sendEmailConfirmationNotification).mockResolvedValue(true);
  });

  it('returns the UserEmail with errors if it is not valid', async () => {
    mockValid.mockResolvedValueOnce(false);

    const result = await mockUserEmail.create(context);
    expect(result.errors).toEqual({});
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns the UserEmail with an error if the record already exists', async () => {
    mockValid.mockResolvedValueOnce(true);
    mockFindByEmail.mockResolvedValueOnce([mockUserEmail]);

    const result = await mockUserEmail.create(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockFindByEmail).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(Object.keys(result.errors).length > 0).toBe(true);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the UserEmail with an error if the record belongs to another user', async () => {
    mockValid.mockResolvedValueOnce(true);
    mockFindByEmail.mockResolvedValueOnce([
      new UserEmail({
        email: mockUserEmail.email,
        userId: casual.integer(1, 999),
        isConfirmed: true,
      }),
    ]);

    const result = await mockUserEmail.create(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockFindByEmail).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the newly added UserEmail', async () => {
    mockValid.mockResolvedValueOnce(true);
    mockFindByEmail.mockResolvedValueOnce([]);
    mockFindById.mockResolvedValue(mockUserEmail);

    const result = await mockUserEmail.create(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockFindByEmail).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalled();
    expect(result).toBeInstanceOf(UserEmail);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});

describe('update', () => {
  let mockUserEmail;

  let mockValid;
  let mockFindById;
  let mockUpdate;

  beforeEach(() => {
    mockUserEmail = new UserEmail({
      id: casual.integer(1, 9999),
      email: casual.email,
      userId: casual.integer(1, 999),
      isPrimary: casual.boolean,
      isConfirmed: true,
    });

    mockValid = jest.fn();
    (mockUserEmail.isValid as jest.Mock) = mockValid;

    mockFindById = jest.fn();
    (UserEmail.findById as jest.Mock) = mockFindById;

    mockUpdate = jest.fn<() => Promise<InstanceType<typeof UserEmail>>>().mockResolvedValue(mockUserEmail);
    (UserEmail.update as jest.Mock) = mockUpdate;
  });

  it('returns an error if the UserEmail has never been created', async () => {
    mockUserEmail.id = null;
    const result = await mockUserEmail.update(context);
    expect(result.errors['general']).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns an error if the UserEmail is invalid', async () => {
    mockValid.mockResolvedValueOnce(false);

    await mockUserEmail.update(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns an error if the UserEmail has not been confirmed yet', async () => {
    mockUserEmail.isConfirmed = false;
    mockValid.mockResolvedValueOnce(true);
    mockFindById.mockResolvedValueOnce(mockUserEmail);

    const result = await mockUserEmail.update(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(result.errors['general']).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the UserEmail successfully', async () => {
    mockValid.mockResolvedValueOnce(true);
    mockFindById.mockResolvedValue(mockUserEmail);

    const result = await mockUserEmail.update(context);
    expect(mockValid).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(UserEmail);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('delete', () => {
  let mockUserEmail;

  let mockFindById;
  let mockDelete;

  beforeEach(() => {
    mockUserEmail = new UserEmail({
      id: casual.integer(1, 9999),
      email: casual.email,
      userId: casual.integer(1, 999),
      isPrimary: casual.boolean,
      isConfirmed: true,
    });

    mockFindById = jest.fn();
    (UserEmail.findById as jest.Mock) = mockFindById;

    mockDelete = jest.fn<() => Promise<InstanceType<typeof UserEmail>>>().mockResolvedValue(mockUserEmail);
    (UserEmail.delete as jest.Mock) = mockDelete;
  });

  it('returns the UserEmail with errors if it has not been deleted', async () => {
    mockUserEmail.id = null;
    const result = await mockUserEmail.delete(context);
    expect(result.errors['general']).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns null if the UserEmail doesn\'t exist', async () => {
    mockFindById.mockResolvedValueOnce(null);

    const result = await mockUserEmail.delete(context);
    expect(result).toBeFalsy();
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns null if the UserEmail could not be deletd', async () => {
    mockFindById.mockResolvedValueOnce(mockUserEmail);
    mockDelete.mockResolvedValueOnce(null);

    const result = await mockUserEmail.delete(context);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(result).toBeFalsy();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns the deleted UserEmail if successful', async () => {
    mockFindById.mockResolvedValue(mockUserEmail);
    mockDelete.mockResolvedValueOnce(null);

    const result = await mockUserEmail.delete(context);
    expect(result).toBeFalsy();
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('findPrimaryByUserId', () => {
  const reference = 'test-ref';
  const userId = casual.integer(1, 999);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return the primary email when it exists', async () => {
    const primaryEmail = casual.email;
    const mockResult = [{
      id: casual.integer(1, 99999),
      userId,
      email: primaryEmail,
      isPrimary: 1,
      isConfirmed: true,
      created: new Date().toISOString(),
      createdById: userId,
      modified: new Date().toISOString(),
      modifiedById: userId,
      errors: {},
    }];
    jest.spyOn(UserEmail, 'query').mockResolvedValueOnce(mockResult);
    const result = await UserEmail.findPrimaryByUserId(reference, context, userId);
    expect(result).toBeInstanceOf(UserEmail);
    expect(result.email).toBe(primaryEmail);
    expect(result.isPrimary).toBeTruthy();
  });

  it('should return null if no primary email exists', async () => {
    jest.spyOn(UserEmail, 'query').mockResolvedValueOnce([]);
    const result = await UserEmail.findPrimaryByUserId(reference, context, userId);
    expect(result).toBeNull();
  });

  it('should only return the primary email if multiple emails exist', async () => {
    const emails = [
      {
        id: casual.integer(1, 99999),
        userId,
        email: casual.email,
        isPrimary: 0,
        isConfirmed: true,
        created: new Date().toISOString(),
        createdById: userId,
        modified: new Date().toISOString(),
        modifiedById: userId,
        errors: {},
      },
      {
        id: casual.integer(1, 99999),
        userId,
        email: casual.email,
        isPrimary: 1,
        isConfirmed: true,
        created: new Date().toISOString(),
        createdById: userId,
        modified: new Date().toISOString(),
        modifiedById: userId,
        errors: {},
      }
    ];
    jest.spyOn(UserEmail, 'query').mockResolvedValueOnce([emails[1]]);
    const result = await UserEmail.findPrimaryByUserId(reference, context, userId);
    expect(result).toBeInstanceOf(UserEmail);
    expect(result.isPrimary).toBeTruthy();
  });
});

describe('createOrUpdatePrimary', () => {
  const userId = casual.integer(1, 999);
  const email = casual.email;
  let mockFindPrimaryByUserId;
  let mockFindByUserIdAndEmail;
  let mockCreate;
  let mockUpdate;

  beforeEach(() => {
    mockFindPrimaryByUserId = jest.spyOn(UserEmail, 'findPrimaryByUserId');
    mockFindByUserIdAndEmail = jest.spyOn(UserEmail, 'findByUserIdAndEmail');
    mockCreate = jest.fn();
    mockUpdate = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a new primary if none exists', async () => {
    mockFindPrimaryByUserId.mockResolvedValueOnce(null);
    mockFindByUserIdAndEmail.mockResolvedValueOnce(null);
    const newPrimary = new UserEmail({ userId, email, isPrimary: true, isConfirmed: false });
    mockCreate.mockResolvedValueOnce(newPrimary);
    jest.spyOn(UserEmail.prototype, 'create').mockImplementation(mockCreate);
    const result = await UserEmail.createOrUpdatePrimary(context, userId, email, false);
    expect(result).toBe(newPrimary);
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should set an existing email as primary and unset the old primary', async () => {
    const oldPrimary = new UserEmail({ id: 1, userId, email: casual.email, isPrimary: true, isConfirmed: true });
    const existingEmail = new UserEmail({ id: 2, userId, email, isPrimary: false, isConfirmed: true });
    mockFindPrimaryByUserId.mockResolvedValueOnce(oldPrimary);
    mockFindByUserIdAndEmail.mockResolvedValueOnce(existingEmail);
    mockUpdate.mockResolvedValueOnce(existingEmail);
    jest.spyOn(existingEmail, 'update').mockImplementation(mockUpdate);
    jest.spyOn(oldPrimary, 'update').mockImplementation(mockUpdate);
    const result = await UserEmail.createOrUpdatePrimary(context, userId, email, true);
    expect(result).toBe(existingEmail);
    expect(existingEmail.isPrimary).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should do nothing if the email is already primary', async () => {
    const primary = new UserEmail({ id: 1, userId, email, isPrimary: true, isConfirmed: true });
    mockFindPrimaryByUserId.mockResolvedValueOnce(primary);
    mockFindByUserIdAndEmail.mockResolvedValueOnce(primary);
    const result = await UserEmail.createOrUpdatePrimary(context, userId, email, true);
    expect(result).toBe(primary);
  });

  it('should update the current primary record to have the new email if email does not exist', async () => {
    const oldPrimary = new UserEmail({ id: 1, userId, email: casual.email, isPrimary: true, isConfirmed: true });
    mockFindPrimaryByUserId.mockResolvedValueOnce(oldPrimary);
    mockFindByUserIdAndEmail.mockResolvedValueOnce(null);
    mockUpdate.mockResolvedValueOnce(oldPrimary);
    jest.spyOn(oldPrimary, 'update').mockImplementation(mockUpdate);
    const result = await UserEmail.createOrUpdatePrimary(context, userId, email, true);
    expect(oldPrimary.email).toBe(email);
    expect(mockUpdate).toHaveBeenCalled();
    expect(result).toBe(oldPrimary);
  });
});
