
import casual from "casual";
import { User, UserRole } from "../User.js";
import { MyContext } from "../../context.js";
import { getMockROR, getRandomEnumValue } from "../../__tests__/helpers.js";

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

// Clean up all mock/test Users
export const cleanUpAddedUsers = async (
  context: MyContext,
): Promise<void> => {
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
