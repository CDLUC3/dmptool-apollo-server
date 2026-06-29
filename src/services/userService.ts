import { generalConfig } from "../config/generalConfig";
import { MyContext } from "../context";
import { TemplateCollaborator } from "../models/Collaborator";
import { defaultLanguageId } from "../models/Language";
import { User, UserRole } from "../models/User";
import { UserEmail } from "../models/UserEmail";
import { randomHex } from "../utils/helpers";

// Generate a random password (used when anonymizing and when creating an account via SSO)
export const generateRandomPassword = () => {
  const chars = ['!', '@', '#', '$', '%', '^', '&', '*', '_', '+', '-', '=', '?', '~', ' '];
  // generate a random hex
  const basePwd = randomHex(24).split('');

  // Swap out 3 characters with special chars
  for (let i = 0; i < 3; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    const idx = Math.floor(Math.random() * basePwd.length);
    basePwd.splice(idx, 1, char);
  }

  // Upper case some of the alpha characters
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * basePwd.length);
    if (/[a-z]/.test(basePwd[idx])) {
      basePwd.splice(idx, 1, basePwd[idx].toUpperCase());
    }
  }

  let pwd = basePwd.join('');
  // if there is no upper case add one
  if (basePwd.findIndex(str => /[A-Z]/.test(str)) <= 0) {
    pwd = `${pwd}Z`;
  }
  // if there is no lower case add one
  if (basePwd.findIndex(str => /[a-z]/.test(str)) <= 0) {
    pwd = `${pwd}q`;
  }
  // if there is no number add one
  if (basePwd.findIndex(str => /[0-9]/.test(str)) <= 0) {
    pwd = `${pwd}99`;
  }
  return pwd;
}

// Anonymize the User record (our version of deleting the account)
export const anonymizeUser = async (context: MyContext, user: User): Promise<User> => {
  const ref = 'UserService.anonymize';
  if (!user.id) {
    user.addError('general', 'This user has never been saved so can not anonymize their information');
    return user;
  }

  const userBefore = await User.findById(ref, context, user.id);

  // Anonymize the user's information
  await UserEmail.createOrUpdatePrimary(context,
    user.id,
    `${randomHex(6)}@deleted-account.${generalConfig.domain}`);
  user.password = await user.hashPassword(generateRandomPassword());
  user.givenName = 'Deleted';
  user.surName = 'Account';
  user.affiliationId = null;
  user.orcid = null;
  user.ssoId = null;
  user.isArchived = true;
  user.role = UserRole.RESEARCHER;
  user.languageId = defaultLanguageId;

  // Make sure all the notification settings are false!
  user.notify_on_comment_added = false;
  user.notify_on_feedback_complete = false;
  user.notify_on_plan_shared = false;
  user.notify_on_plan_visibility_change = false;
  user.notify_on_template_shared = false;

  // Deactivate the account
  user.active = false;

  const anonymized = await user.update(context);

  // If the anonymized record couldn't be saved add an error
  if (!anonymized) {
    userBefore.addError('general', 'Unable to anonymize your account at this time');
  } else {
    // Remove all UserEmail entries
    const userEmails = await UserEmail.findByUserId(ref, context, user.id);
    for (const userEmail of userEmails) {
      const deleted = await userEmail.delete(context);

      if (deleted) {
        // Remove any collaborations
        const templateCollaborators = await TemplateCollaborator.findByEmail(ref, context, userEmail.email);
        for (const collaborator of templateCollaborators) {
          await collaborator.delete(context);
        }
      }
    }
  }
  // Return the record before it was anoymized
  return userBefore;
}

// Merge the 1st User (userToMerge) into the 2nd User (userToKeep) returns the userToKeep
export const mergeUsers = async (
  context: MyContext,
  userToMerge: User,
  userToKeep: User,
): Promise<User> => {
  const ref = 'UserService.mergeUsers';
  const original = await User.findById(ref, context, userToKeep.id);

  const toBeMerged = new User(userToMerge);
  const toBeKept = new User(userToKeep);

  // Only replace these properties if the one we are keeping does not have them defined
  const propsToMergeIfEmpty = ['givenName', 'surName', 'affiliationId', 'orcid', 'ssoId', 'languageId', 'active'];
  for (const prop of propsToMergeIfEmpty) {
    if (toBeMerged[prop] && toBeMerged[prop] !== '' && !toBeKept[prop] || toBeKept[prop] === '') {
      toBeKept[prop] = toBeMerged[prop];
    }
  }

  // Update the user's role ONLY if the one being merged is an admin
  if (toBeKept.role === UserRole.RESEARCHER && toBeMerged.role === UserRole.ADMIN) {
    toBeKept.role = toBeMerged.role
  }

  const merged = await toBeKept.update(context);
  if (merged && Array.isArray(merged.errors) && merged.errors.length > 0) {
    original.addError('general', 'Unable to merge the user at this time');
    return original;

  } else {
    const mergingEmails = await UserEmail.findByUserId(ref, context, toBeMerged.id);
    const keepingEmails = await UserEmail.findByUserId(ref, context, toBeKept.id);

    // Update any Collaboration invites
    const invites = await TemplateCollaborator.findByInvitedById(ref, context, toBeMerged.id);
    for (const collab of invites) {
      collab.invitedById = toBeKept.id;
      await collab.update(context);
    }

    // Merge the UserEmails
    for (const mergeEmail of mergingEmails) {
      const matched = keepingEmails.find((entry) => { return entry.email === mergeEmail.email; });
      // If the User we are keeping doesn't have the email then update the UserId
      if (!matched) {
        mergeEmail.userId = toBeKept.id;
        await mergeEmail.update(context);

        // See if there are any collaborations for the email and attach it to the user to keep
        const tmpltCollaborators = await TemplateCollaborator.findByEmail(ref, context, mergeEmail.email);
        for (const collab of tmpltCollaborators) {
          collab.userId = toBeKept.id;
          await collab.update(context);
        }

      } else {
        if (!matched.isConfirmed && mergeEmail.isConfirmed) {
          // Otherwise update it if it exists and is confirmed in the User to merge but not the other
          matched.isConfirmed = true;
          await matched.update(context);
        }

        // Then delete the original
        await mergeEmail.delete(context);
      }
    }

    // TODO: Need to loop through everything and replace the createdById and modifiedById!

    // TODO: Once we've solved the above issue with createdById we can delete
    //       for now just anonymize
    if (!await anonymizeUser(context, toBeMerged)) {
      toBeKept.addError('general', 'Unable to anonymize the user being merged at this time');
    }
    return toBeKept;
  }
}
