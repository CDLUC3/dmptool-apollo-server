import { KeyvAdapter } from "@apollo/utils.keyvadapter";

const VERSION_TAG = '{dmspt}';
const versionKey = (userId: number | string): string => {
  return `${VERSION_TAG}${userId}`;
};

/**
 * Retrieves the current token version for a specified user from the cache. If the
 * token version is not found or cannot be parsed as a number, it defaults to 0.
 * This function is useful for managing token versions in scenarios where tokens
 * may need to be invalidated or refreshed based on user actions or security policies.
 *
 * @param cache - The KeyvAdapter instance used for caching the token version.
 * @param userId - The unique identifier of the user whose token version is to be retrieved.
 * @returns A Promise that resolves to the current token version as a number, or 0 if not found.
 */
export const getUserTokenVersion = async (
  cache: KeyvAdapter,
  userId: number | string
): Promise<number> => {
  const raw: string = await cache.get(versionKey(userId));
  const parsed: number = parseInt(raw as string, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Bumps the token version for a user in the cache. This function retrieves the
 * current token version for the specified user, increments it by one, and updates
 * the cache with the new version. The updated version is returned as a number.
 *
 * @param cache - The KeyvAdapter instance used for caching the token version.
 * @param userId - The unique identifier of the user whose token version is to be bumped.
 * @returns A Promise that resolves to the new token version as a number.
 */
export const bumpUserTokenVersion = async (
  cache: KeyvAdapter,
  userId: number | string
): Promise<number> => {
  const next: number = (await getUserTokenVersion(cache, userId)) + 1;
  await cache.set(versionKey(userId), next.toString()); // no TTL — must outlive any token
  return next;
};
