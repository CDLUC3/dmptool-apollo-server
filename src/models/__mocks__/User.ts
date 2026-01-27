
import casual from "casual";
import { isNullOrUndefined } from "../../utils/helpers";
import { User, UserRole } from "../User";
import { MyContext } from "../../context";
import { getMockROR, getRandomEnumValue } from "../../__tests__/helpers";
import {prepareObjectForLogs} from "../../logger";

// Store for all mock/test Users that were persisted to the DB
const addedUserIds: number[] = [];

export interface MockUserOptions {
  email?: string;
  password?: string;
  givenName?: string;
  surName?: string;
  affiliationId?: string;
  role?: UserRole;
  languageId?: string;
  orcid?: string;
  acceptedTerms?: boolean;
}

// Generate a mock/test User
export const mockUser = (
  options: Partial<MockUserOptions>
): User => {
  // Use the options provided or default a value
  return new User({
    email: options.email ?? casual.email,
    password: options.password ?? casual.password,
    role: options.role ?? getRandomEnumValue(UserRole),
    givenName: options.givenName ?? casual.first_name,
    surName: options.surName ?? casual.last_name,
    affiliationId: options.affiliationId ?? getMockROR(),
    acceptedTerms: options.acceptedTerms ?? casual.boolean,
  });
}

// Save a mock/test User in the DB for integration tests
export const persistUser = async (
  context: MyContext,
  user: User,
  email = casual.email,
): Promise<User | null> => {
  try {
    const created = await user.register(context, email);
    if (!isNullOrUndefined(created)) {
      // Keep track of the id so we can clean up afterward
      addedUserIds.push(created.id);
      return created;
    }
    console.error(prepareObjectForLogs({ errors: user.errors }), "Unable to persist user");
  } catch {
    console.error("Error persisting user");
  }
  return null;
}

// Clean up all mock/test Users
export const cleanUpAddedUsers = async (
  context: MyContext,
) : Promise<void> => {
  const reference = 'cleanUpAddedUsers';
  for (const id of addedUserIds) {
    try {
      // User doesn't have an actual delete function, so we go direct to the MySQL model
      await User.delete(context, 'users', id, reference);
    } catch (e) {
      console.error(`Error cleaning up affiliation id ${id}: ${e.message}`);
    }
  }
}
