import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { User, UserRole } from "../../models/User";
import { anonymizeUser, generateRandomPassword, mergeUsers } from "../userService";
import { getCurrentDate } from "../../utils/helpers";
import { UserEmail } from "../../models/UserEmail";
import { TemplateCollaborator } from "../../models/Collaborator";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { sendEmailConfirmationNotification } from "../emailService";
import { defaultLanguageId } from "../../models/Language";

let affiliationId;
let adminUser;

let userStore;
let userEmailStore;
let templateCollaboratorStore;
let mockFindUserById;
let mockFindEmailsByUserId;
let mockFindEmailById;
let mockFindEmailByUserIdAndEmail;
let mockFindEmailByEmail;
let mockfindTemplateCollaboratorByInvitedById;
let mockFindTemplateCollaboratorById;
let mockFindTemplateCollaboratorsByEmail;
let mockInsert;
let mockUpdate;
let mockDelete;

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  affiliationId = casual.url;

  // Define a fake logged in admin user
  adminUser = new User({
    id: casual.integer(1, 9999),
    givenName: casual.first_name,
    surName: casual.last_name,
    affiliationId,
    role: UserRole.ADMIN,
  });

  jest.spyOn(adminUser, 'getEmail').mockResolvedValue(casual.email);
  context = await buildMockContextWithToken(logger, adminUser);

  const mockSendEmail = jest.fn().mockReturnValue(true);
  (sendEmailConfirmationNotification as jest.Mock) = mockSendEmail;

  userStore = [];
  userEmailStore = [];
  templateCollaboratorStore = [];

  // Fetch an item from the userStore instead of the DB
  mockFindUserById = jest.fn().mockImplementation((_, __, id) => {
    return userStore.find((entry) => { return entry.id === id });
  });
  (User.findById as jest.Mock) = mockFindUserById;

  // Fetch items from the userEmailStore instead of the DB
  mockFindEmailById = jest.fn().mockImplementation((_, __, id) => {
    return userEmailStore.filter((entry) => { return entry.id === id });
  });
  (UserEmail.findById as jest.Mock) = mockFindEmailById;

  // Fetch items from the userEmailStore instead of the DB
  mockFindEmailsByUserId = jest.fn().mockImplementation((_, __, userId) => {
    return userEmailStore.filter((entry) => { return entry.userId === userId });
  });
  (UserEmail.findByUserId as jest.Mock) = mockFindEmailsByUserId;

  mockFindEmailByUserIdAndEmail = jest.fn().mockImplementation((_, __, userId, email) => {
    return userEmailStore.filter((entry) => {
      return entry.email === email  && entry.userId === userId;
    });
  });
  (UserEmail.findByUserIdAndEmail as jest.Mock) = mockFindEmailByUserIdAndEmail;

  // Fetch items from the userEmailStore instead of the DB
  mockFindEmailByEmail = jest.fn().mockImplementation((_, __, email) => {
    return userEmailStore.filter((entry) => { return entry.email === email });
  });
  (UserEmail.findByEmail as jest.Mock) = mockFindEmailByEmail;

  // Fetch items from the templateCollaboratorsStore instead of the DB
  mockfindTemplateCollaboratorByInvitedById = jest.fn().mockImplementation((_, __, id) => {
    return templateCollaboratorStore.filter((entry) => { return entry.invitedById === id });
  });
  (TemplateCollaborator.findByInvitedById as jest.Mock) = mockfindTemplateCollaboratorByInvitedById;

  // Fetch items from the templateCollaboratorsStore instead of the DB
  mockFindTemplateCollaboratorsByEmail = jest.fn().mockImplementation((_, __, email) => {
    return templateCollaboratorStore.filter((entry) => { return entry.email === email });
  });
  (TemplateCollaborator.findByEmail as jest.Mock) = mockFindTemplateCollaboratorsByEmail;

  mockFindTemplateCollaboratorById = jest.fn().mockImplementation((_, __, id) => {
    return templateCollaboratorStore.find((entry) => { return entry.id === id });
  });
  (TemplateCollaborator.findById as jest.Mock) = mockFindTemplateCollaboratorById;

  // Override the MySQLModel update function
  mockUpdate = jest.fn().mockImplementation((context, table, obj) => {
    obj.modifed = getCurrentDate();
    obj.modifiedById = context.token.id;

    switch(table) {
      case 'users': {
        const existing = userStore.find((entry) => { return entry.id === obj.id });
        if (!existing) {
          throw new Error(`No entry in the userStore for id: ${obj.id}`);
        }
        userStore.splice(userStore.indexOf(existing), 1, obj);
        break;
      }
      case 'userEmails': {
        const existing = userEmailStore.find((entry) => { return entry.id === obj.id });
        if (!existing) {
          throw new Error(`No entry in the userEmailStore for id: ${obj.id}`);
        }
        userEmailStore.splice(userEmailStore.indexOf(existing), 1, obj);
        break;
      }
      case 'templateCollaborators': {
        const existing = templateCollaboratorStore.find((entry) => { return entry.id === obj.id });
        if (!existing) {
          throw new Error(`No entry in the templateCollaboratorStore for id: ${obj.id}`);
        }
        templateCollaboratorStore.splice(templateCollaboratorStore.indexOf(existing), 1, obj);
        break;
      }
    }
    return obj;
  });
  (User.update as jest.Mock) = mockUpdate;
  (UserEmail.update as jest.Mock) = mockUpdate;
  (TemplateCollaborator.update as jest.Mock) = mockUpdate;

  // Override the MySQLModel delete function
  mockDelete = jest.fn().mockImplementation((_, table, objId) => {
    switch(table) {
      case 'userEmails': {
        const obj = userEmailStore.find((e) => { return e.id === objId });
        userEmailStore.splice(userEmailStore.indexOf(obj), 1);
        break;
      }
      case 'templateCollaborators': {
        const obj = templateCollaboratorStore.find((e) => { return e.id === objId });
        templateCollaboratorStore.splice(templateCollaboratorStore.indexOf(obj), 1);
        break;
      }
    }
    return true;
  });
  (UserEmail.delete as jest.Mock) = mockDelete;
  (TemplateCollaborator.delete as jest.Mock) = mockDelete;

  // Override the MySQLModel insert function
  mockInsert = jest.fn().mockImplementation((_, table, obj) => {
    obj.created = getCurrentDate();
    obj.createdById = casual.integer(1, 999);
    obj.modified = getCurrentDate();
    obj.modifiedById = casual.integer(1, 999);
    userEmailStore.push(obj);

    return obj.id;
  });
  (UserEmail.insert as jest.Mock) = mockInsert;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('generateRandomPassword', () => {
  it('generates a valid password', () => {
    const result = generateRandomPassword();
    expect(result.match(/[A-Z]/).length > 0).toBe(true);
    expect(result.match(/[a-z]/).length > 0).toBe(true);
    expect(result.match(/[0-9]/).length > 0).toBe(true);
    // One of the special characters isn't working in this regex, so just make sure it has between 2-3
    expect(result.match(/[`!@#$%^&*_+\-=?~\s]/g).length).toBeGreaterThanOrEqual(2);
    expect(result.match(/[`!@#$%^&*_+\-=?~\s]/g).length).toBeLessThanOrEqual(3);
    expect(result.length >= 8).toBe(true);
  })
});

describe('anonymizeUser', () => {
  let user;

  beforeEach(() => {
    // Define a fake user
    user = new User({
      id: casual.integer(1, 9999),
      createdById: casual.integer(1, 999),
      created: getCurrentDate(),
      modifiedById: casual.integer(1, 999),
      modified: getCurrentDate(),
      password: 'TestPa$$word987',
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: casual.url,
      ssoId: casual.uuid,
      languageId: casual.language_code,
      notify_on_comment_added: casual.boolean,
      notify_on_feedback_complete: casual.boolean,
      notify_on_plan_shared: casual.boolean,
      notify_on_plan_visibility_change: casual.boolean,
      notify_on_template_shared: casual.boolean,
      affiliationId: casual.url,
      role: UserRole.ADMIN,
      active: true,
      acceptedTerms: true,
      errors: [],
    });
    userStore.push(user);
  });

  it('fails if the user has never been saved', async () => {
    user.id = null;
    const result = await anonymizeUser(context, user);
    expect(Object.keys(result.errors['general'])).toBeTruthy();
  });

  it('anonymizes the expected User properties', async () => {

    jest.spyOn(UserEmail, 'createOrUpdatePrimary').mockResolvedValue(
      new UserEmail({ id: 123, userId: user.id, email: 'anonymized@deleted-account.example.com', isPrimary: true })
    );

    // First call: original email
    jest.spyOn(UserEmail, 'findPrimaryByUserId').mockResolvedValueOnce(
      new UserEmail({ id: 1, userId: user.id, email: 'original@example.com', isPrimary: true })
    );

    // After anonymization: new email
    jest.spyOn(UserEmail, 'findPrimaryByUserId').mockResolvedValueOnce(
      new UserEmail({ id: 1, userId: user.id, email: 'anonymized@deleted-account.example.com', isPrimary: true })
    );

    const original = structuredClone(user);
    const originalEmail = await user.getEmail(context);

    const result = await anonymizeUser(context, user);

    const anonymizedEmail = await result.getEmail(context);

    expect(mockFindUserById).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // Expect some properties to have been unchanged
    expect(result.id).toEqual(original.id);
    expect(result.created).toEqual(original.created);
    expect(result.createdById).toEqual(original.createdById);
    expect(result.acceptedTerms).toEqual(original.acceptedTerms);
    expect(result.locked).toEqual(original.locked);
    expect(result.last_sign_in).toEqual(original.last_sign_in);
    expect(result.last_sign_in_via).toEqual(original.last_sign_in_via);
    expect(result.failed_sign_in_attempts).toEqual(original.failed_sign_in_attempts);

    // Should record the modifier's info
    expect(result.modifiedById).toEqual(context.token.id);

    // Expect others to change
    expect(originalEmail).not.toEqual(anonymizedEmail);
    expect(result.password).not.toEqual(original.password);
    expect(result.givenName).not.toEqual(original.givenName);
    expect(result.surName).not.toEqual(original.surName);
    expect(result.languageId).toEqual(defaultLanguageId);
    expect(result.affiliationId).toEqual(null);
    expect(result.orcid).toBeFalsy();
    expect(result.ssoId).toBeFalsy();
    expect(result.role).toEqual(UserRole.RESEARCHER);

    // Expect notifications to be off
    expect(result.notify_on_comment_added).toBe(false);
    expect(result.notify_on_feedback_complete).toBe(false);
    expect(result.notify_on_plan_shared).toBe(false);
    expect(result.notify_on_plan_visibility_change).toBe(false);
    expect(result.notify_on_template_shared).toBe(false);

    // Expect the account to now be inactive
    expect(result.active).toBe(false);
  });

  it('removes all associated UserEmail records', async () => {
    userEmailStore = [
      new UserEmail({ id: 1, email: casual.email, userId: user.id, isConfirmed: true }),
      new UserEmail({ id: 2, email: casual.email, userId: user.id, isConfirmed: false }),
    ];
    await anonymizeUser(context, user);
    expect(mockFindEmailsByUserId).toHaveBeenCalledTimes(1);
    expect(userEmailStore.length).toBe(0);
  });

  it('removes all associated TemplateCollaborators', async () => {
    const secondaryEmail = casual.email;
    const templateId = casual.integer(1, 99);
    userEmailStore = [
      new UserEmail({ id: 1, email: user.email, userId: user.id, isPrimary: true }),
      new UserEmail({ id: 1, email: secondaryEmail, userId: user.id }),
    ];
    templateCollaboratorStore = [
      new TemplateCollaborator({ id: 1, email: casual.email, invitedById: user.id, templateId }),
      new TemplateCollaborator({ id: 2, email: secondaryEmail, userId: user.id, templateId }),
      new TemplateCollaborator({ id: 3, email: user.email, userId: user.id, templateId }),
    ];
    await anonymizeUser(context, user);
    expect(mockFindTemplateCollaboratorsByEmail).toHaveBeenCalledTimes(2);
    expect(templateCollaboratorStore.length).toBe(1);
  });
});

describe('mergeUsers', () => {
  let mergeUser;
  let keepUser;

  beforeEach(() => {
    // Define a fake user we want to merge
    mergeUser = new User({
      id: casual.integer(1, 9999),
      createdById: casual.integer(1, 999),
      created: getCurrentDate(),
      modifiedById: casual.integer(1, 999),
      modified: getCurrentDate(),
      email: casual.email,
      password: 'TestPa$$word123',
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: casual.url,
      ssoId: casual.uuid,
      languageId: casual.language_code,
      notify_on_comment_added: casual.boolean,
      notify_on_feedback_complete: casual.boolean,
      notify_on_plan_shared: casual.boolean,
      notify_on_plan_visibility_change: casual.boolean,
      notify_on_template_shared: casual.boolean,
      affiliationId,
      role: UserRole.RESEARCHER,
      active: true,
      acceptedTerms: true,
      errors: [],
    });
    userStore.push(mergeUser);

    // Define a fake user we want to keep
    keepUser = new User({
      id: casual.integer(1, 9999),
      createdById: casual.integer(1, 999),
      created: getCurrentDate(),
      modifiedById: casual.integer(1, 999),
      modified: getCurrentDate(),
      email: casual.email,
      password: 'TestPa$$word987',
      givenName: casual.first_name,
      surName: casual.last_name,
      orcid: casual.url,
      ssoId: casual.uuid,
      languageId: casual.language_code,
      notify_on_comment_added: casual.boolean,
      notify_on_feedback_complete: casual.boolean,
      notify_on_plan_shared: casual.boolean,
      notify_on_plan_visibility_change: casual.boolean,
      notify_on_template_shared: casual.boolean,
      affiliationId,
      role: UserRole.RESEARCHER,
      active: true,
      acceptedTerms: true,
      errors: [],
    });
    userStore.push(keepUser);

    const mockAnonymize = jest.fn().mockResolvedValueOnce('anonymizeResult');
    (anonymizeUser as jest.Mock) = mockAnonymize;
  });

  it('does not overwrite base MySQLModel properties', async () => {
    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    // Expect core MySQLModel properties to have remained unchanged
    expect(mergedUser.id).toEqual(keepUser.id);
    expect(mergedUser.created).toEqual(keepUser.created);
    expect(mergedUser.createdById).toEqual(keepUser.createdById);
  });

  it('does not overwrite properties if they are already defined in the User to keep', async () => {
    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    // Expect core MySQLModel properties to have remained unchanged
    expect(mergedUser.acceptedTerms).toEqual(keepUser.acceptedTerms);
    expect(mergedUser.active).toEqual(keepUser.active);
    expect(mergedUser.affiliationId).toEqual(keepUser.affiliationId);
    expect(mergedUser.notify_on_template_shared).toEqual(keepUser.notify_on_template_shared);
    expect(mergedUser.notify_on_plan_visibility_change).toEqual(keepUser.notify_on_plan_visibility_change);
    expect(mergedUser.notify_on_plan_shared).toEqual(keepUser.notify_on_plan_shared);
    expect(mergedUser.notify_on_feedback_complete).toEqual(keepUser.notify_on_feedback_complete);
    expect(mergedUser.notify_on_comment_added).toEqual(keepUser.notify_on_comment_added);
    expect(mergedUser.languageId).toEqual(keepUser.languageId);
    expect(mergedUser.ssoId).toEqual(keepUser.ssoId);
    expect(mergedUser.orcid).toEqual(keepUser.orcid);
    expect(mergedUser.surName).toEqual(keepUser.surName);
    expect(mergedUser.givenName).toEqual(keepUser.givenName);
    expect(mergedUser.password).toEqual(keepUser.password);
    expect(await mergedUser.getEmail(context)).toEqual(await keepUser.getEmail(context));
  });

  it('Overwrites some properties if they are NOT defined on the User to keep', async () => {
    keepUser.givenName = null;
    keepUser.surName = undefined;
    keepUser.orcid = '';
    keepUser.ssoId = null;
    keepUser.languageId = '';
    keepUser.affiliationId = null;
    keepUser.active = false;

    const original = structuredClone(keepUser);
    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mergedUser.acceptedTerms).toEqual(original.acceptedTerms);
    expect(mergedUser.active).toEqual(mergeUser.active);
    expect(mergedUser.affiliationId).toEqual(mergeUser.affiliationId);
    expect(mergedUser.notify_on_template_shared).toEqual(original.notify_on_template_shared);
    expect(mergedUser.notify_on_plan_visibility_change).toEqual(original.notify_on_plan_visibility_change);
    expect(mergedUser.notify_on_plan_shared).toEqual(original.notify_on_plan_shared);
    expect(mergedUser.notify_on_feedback_complete).toEqual(original.notify_on_feedback_complete);
    expect(mergedUser.notify_on_comment_added).toEqual(original.notify_on_comment_added);
    expect(mergedUser.languageId).toEqual(mergeUser.languageId);
    expect(mergedUser.ssoId).toEqual(null);
    expect(mergedUser.orcid).toEqual(mergeUser.orcid);
    expect(mergedUser.surName).toEqual(mergeUser.surName);
    expect(mergedUser.givenName).toEqual(mergeUser.givenName);
    expect(mergedUser.password).toEqual(original.password);
    expect(await mergedUser.getEmail(context)).toEqual(await keepUser.getEmail(context));
  });

  it('promotes the User to keep if the merge user is an ADMIN', async () => {
    mergeUser.role = UserRole.ADMIN;

    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mergedUser.role).toEqual(UserRole.ADMIN);
  });

  it('does NOT demote to user to keep', async () => {
    keepUser.role = UserRole.ADMIN;

    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mergedUser.role).toEqual(UserRole.ADMIN);
  });

  it('does NOT promote to SUPERADMIN', async () => {
    mergeUser.role = UserRole.SUPERADMIN;

    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mergedUser.role).toEqual(UserRole.RESEARCHER);
  });

  it('returns the original user to keep with errors if it fails to update', async () => {
    keepUser.password = null;
    const mergedUser = await mergeUsers(context, mergeUser, keepUser);
    expect(mockUpdate).toHaveBeenCalledTimes(0);
    expect(Object.keys(mergedUser.errors)).toBeTruthy();
  });

  it('merges UserEmail entries', async () => {
    userEmailStore = [
      new UserEmail({ userId: mergeUser.id, email: 'match-confirmed@test.org', isConfirmed: true, id: 1 }),
      new UserEmail({ userId: mergeUser.id, email: 'match-unconfirmed@test.org', isConfirmed: false, id: 2 }),
      new UserEmail({ userId: mergeUser.id, email: 'unmatched@test.org', id: 3 }),

      new UserEmail({ userId: keepUser.id, email: 'match-confirmed@test.org', isConfirmed: false, id: 4 }),
      new UserEmail({ userId: keepUser.id, email: 'match-unconfirmed@test.org', isConfirmed: true, id: 5 }),
      new UserEmail({ userId: keepUser.id, email: 'original@test.org', id: 6 }),
    ];

    await mergeUsers(context, mergeUser, keepUser);
    expect(mockFindEmailsByUserId).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledTimes(2);

    const matchConfirmed = userEmailStore.filter((e) => { return e.email === 'match-confirmed@test.org' });
    expect(matchConfirmed.length).toBe(1);
    expect(matchConfirmed[0].isConfirmed).toBe(true);
    expect(matchConfirmed[0].userId).toBe(keepUser.id);

    const matchUnConfirmed = userEmailStore.filter((e) => { return e.email === 'match-unconfirmed@test.org' });
    expect(matchUnConfirmed.length).toBe(1);
    expect(matchUnConfirmed[0].isConfirmed).toBe(true);
    expect(matchUnConfirmed[0].userId).toBe(keepUser.id);

    const unmatched = userEmailStore.filter((e) => { return e.email === 'unmatched@test.org' });
    expect(unmatched.length).toBe(1);
    expect(unmatched[0].userId).toBe(keepUser.id);

    const original = userEmailStore.filter((e) => { return e.email === 'original@test.org' });
    expect(original.length).toBe(1);
    expect(original[0].userId).toBe(keepUser.id);
  });

  it('merges Collaborator entries', async () => {
    userEmailStore = [
      new UserEmail({ userId: mergeUser.id, email: 'no-userId@test.org', id: 1 }),
      new UserEmail({ userId: mergeUser.id, email: 'with-userId@test.org', id: 1 }),
    ];
    const otherEmail = casual.email
    templateCollaboratorStore = [
      new TemplateCollaborator({
        templateId: casual.integer(1, 99),
        email: 'no-userId@test.org',
        invitedById: casual.integer(1, 99),
        id: 1
      }),
      new TemplateCollaborator({
        templateId: casual.integer(1, 99),
        email: 'with-userId@test.org',
        invitedById: casual.integer(1, 99),
        userId: casual.integer(1, 99),
        id: 2
      }),
      new TemplateCollaborator({
        templateId: casual.integer(1, 99),
        email: otherEmail,
        invitedById: mergeUser.id,
        id: 3
      }),
    ];

    await mergeUsers(context, mergeUser, keepUser);
    expect(mockfindTemplateCollaboratorByInvitedById).toHaveBeenCalledTimes(1);
    expect(mockFindTemplateCollaboratorsByEmail).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(4);

    const byInvitedById = templateCollaboratorStore.filter((e) => {
      return e.invitedById === keepUser.id;
    });
    expect(byInvitedById.length).toBe(1);
    expect(byInvitedById[0].invitedById).toBe(keepUser.id);
    expect(byInvitedById[0].email).toBe(otherEmail);
    expect(byInvitedById[0].userId).not.toBe(keepUser.id);

    const byEmail = templateCollaboratorStore.filter((e) => {
      return e.email === 'no-userId@test.org';
    });
    expect(byEmail.length).toBe(1);
    expect(byEmail[0].invitedById).not.toBe(keepUser.id);
    expect(byEmail[0].email).toBe('no-userId@test.org');
    expect(byEmail[0].userId).toBe(keepUser.id);

    const withUserId = templateCollaboratorStore.filter((e) => {
      return e.email === 'with-userId@test.org';
    });
    expect(withUserId.length).toBe(1);
    expect(withUserId[0].invitedById).not.toBe(keepUser.id);
    expect(withUserId[0].email).toBe('with-userId@test.org');
    expect(withUserId[0].userId).toBe(keepUser.id);
  });
});
