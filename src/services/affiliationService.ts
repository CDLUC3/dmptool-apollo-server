import { MyContext } from "../context.js";
import { Affiliation } from "../models/Affiliation.js";
import { AffiliationEmailDomain } from "../models/AffiliationEmailDomain.js";
import { isNullOrUndefined } from "../utils/helpers.js";
import { AffiliationLink } from "../models/AffiliationLink.js";

export interface ResolveAffiliationInput {
  affiliationId?: string | null;
  affiliationName?: string | null;
}

export interface ResolveAffiliationResult {
  affiliationId: string | null;
  error?: string;
}


/**
 * Resolves the affiliationId to use for a ProjectMember create/update.
 *
 * - If affiliationId is set and doesn't already exist, creates a new Affiliation
 *   using the provided id as the uri and affiliationName as its name.
 * - If affiliationId is blank but affiliationName is set (the "Other" case),
 *   delegates to processOtherAffiliationName to look up/generate a uri.
 * - Otherwise returns the affiliationId unchanged (including null/blank).
 *
 * @param reference the reference for logging purposes
 * @param context the Apollo context
 * @param input the affiliationId/affiliationName pair from the mutation input
 * @param userId the id of the user performing the action (used when registering a new affiliation)
 */
export const resolveAffiliation = async (
  reference: string,
  context: MyContext,
  input: ResolveAffiliationInput,
  userId?: number,
): Promise<ResolveAffiliationResult> => {
  // Guard against the frontend's "other" sentinel leaking through as a literal
  // affiliationId instead of being left blank
  if (input.affiliationId === 'other') {
    if (input.affiliationName) {
      const affiliation = await processOtherAffiliationName(context, input.affiliationName, userId);
      return { affiliationId: affiliation ? String(affiliation.uri) : null };
    }
    return { affiliationId: null, error: 'An affiliation name is required when "Other" is selected' };
  }

  if (input.affiliationId && input.affiliationId.length > 0) {
    const existingAffiliation = await Affiliation.findByURI(reference, context, input.affiliationId);
    if (!existingAffiliation && input.affiliationName) {
      const newAffiliation = new Affiliation({
        uri: input.affiliationId,
        name: input.affiliationName,
      });

      const createdAffiliation = await newAffiliation.create(context);

      if (!createdAffiliation || createdAffiliation.hasErrors()) {
        return { affiliationId: null, error: 'Unable to create required affiliation' };
      }

      return { affiliationId: createdAffiliation.uri };
    }
    return { affiliationId: input.affiliationId };
  } else if (input.affiliationName) {
    const affiliation = await processOtherAffiliationName(context, input.affiliationName, userId);
    return { affiliationId: affiliation ? String(affiliation.uri) : null };
  }

  return { affiliationId: input.affiliationId || null };
};


export const processOtherAffiliationName = async (
  context: MyContext,
  name: string,
  userId?: number,
): Promise<Affiliation> => {
  // First look to see if the affiliation name already exists
  const existing = await Affiliation.findByName('processOtherAffiliation', context, name);
  if (existing) {
    return existing;
  } else {
    // Create the affiliation
    const newAffiliation = new Affiliation({ displayName: name });

    // If there is no UserId in the token context but a userId was provided, then we are registering a new user
    if (!context?.token?.id && userId) {
      newAffiliation.createdById = userId;
      newAffiliation.modifiedById = userId;
    }
    const result = await newAffiliation.create(context);

    // Reinit the Affiliation to ensure it has access to functions like hasErrors()
    return new Affiliation(result);
  }
}

/**
 * Compare the Affiliation's existing email domains to the ones that are specified.
 * Remove any that are no longer there and add any that are not there.
 *
 * @param context the Apollo context
 * @param reference the reference for logging purposes
 * @param affiliation the Affiliation
 * @param desiredEmailDomainIds the desired Email Domains
 * @returns true if successful. If not, errors are added to the Affiliation object
 */
export const reconcileAffiliationEmailDomains = async (
  context: MyContext,
  reference: string,
  affiliation: Affiliation,
  desiredEmailDomainIds: AffiliationEmailDomain[],
): Promise<boolean> => {
  // If the Affiliation has an id then it already exists so we need to fetch the
  // current email domains so we can compare them to the new ones
  const currentEmailDomains: AffiliationEmailDomain[] = !isNullOrUndefined(affiliation.id)
    ? await AffiliationEmailDomain.findByAffiliationId(reference, context, affiliation.uri)
    : [];

  const { idsToBeRemoved, idsToBeSaved } = Affiliation.reconcileAssociationIds(
    currentEmailDomains.map((ced: AffiliationEmailDomain): string => ced.emailDomain),
    desiredEmailDomainIds.map((ded: AffiliationEmailDomain): string => ded.emailDomain)
  );

  const errs: string[] = [];

  // Remove domains that are no longer there
  const removeErrors: string[] = [];
  for (const id of idsToBeRemoved) {
    const domain = currentEmailDomains.find((domain: AffiliationEmailDomain) => domain.emailDomain === id);
    if (domain) {
      const wasRemoved: AffiliationEmailDomain = await domain.delete(context);
      if (!wasRemoved) {
        removeErrors.push(domain.emailDomain);
      }
    }
  }
  if (removeErrors.length > 0) {
    errs.push(`unable to remove email domains: ${removeErrors.join(', ')}`);
  }

  // Add new email domains
  const addErrors: string[] = [];
  for (const id of idsToBeSaved) {
    const domain = currentEmailDomains.find((domain: AffiliationEmailDomain) => domain.emailDomain === id);
    // Since there's nothing on the EmailDomain record beside the email domain, we
    // don't need to worry about updating. We just add it if it's not already there.
    if (!domain) {
      const desired: AffiliationEmailDomain = desiredEmailDomainIds.find((ded: AffiliationEmailDomain): boolean => {
        return ded.emailDomain === id;
      });

      if (desired) {
        desired.affiliationId = affiliation.uri;
        const wasAdded: AffiliationEmailDomain = await desired.create(context);
        if (!wasAdded) {
          addErrors.push(desired.emailDomain);
        }
      }
    }
  }
  if (addErrors.length > 0) {
    errs.push(`unable to add email domains: ${addErrors.join(', ')}`);
  }

  // If any errors occurred, set the error message on the affiliation
  if (errs.length > 0) {
    affiliation.addError('affiliationEmailDomains', errs.join('; '));
    return false;
  }
  return true;
}

/**
 * Compare the Affiliation's existing links to the ones that are specified.
 * Remove any that are no longer there and add any that are not there.
 *
 * @param context the Apollo context
 * @param reference the reference for logging purposes
 * @param affiliation the Affiliation
 * @param desiredLinks the desired Links
 * @returns true if successful. If not, errors are added to the Affiliation object
 */
export const reconcileAffiliationLinks = async (
  context: MyContext,
  reference: string,
  affiliation: Affiliation,
  desiredLinks: AffiliationLink[],
): Promise<boolean> => {
  // If the Affiliation has an id then it already exists so we need to fetch the
  // current links so we can compare them to the new ones
  const currentLinks: AffiliationLink[] = !isNullOrUndefined(affiliation.id)
    ? await AffiliationLink.findByAffiliationId(reference, context, affiliation.uri)
    : [];

  const { idsToBeRemoved, idsToBeSaved } = Affiliation.reconcileAssociationIds(
    currentLinks.map((cl: AffiliationLink): string => cl.url),
    desiredLinks.map((dl: AffiliationLink): string => dl.url)
  );

  const errs: string[] = [];

  // Remove links that are no longer there
  const removeErrors: string[] = [];
  for (const url of idsToBeRemoved) {
    const link: AffiliationLink = currentLinks.find((cl: AffiliationLink): boolean => cl.url === url);
    if (link) {
      const wasRemoved: AffiliationLink = await link.delete(context);
      if (!wasRemoved) {
        removeErrors.push(link.url);
      }
    } else {
      removeErrors.push(link.url);
    }
  }
  if (removeErrors.length > 0) {
    errs.push(`unable to remove links: ${removeErrors.join(', ')}`);
  }

  // Add new links or update the existing ones
  const addErrors: string[] = [];
  const updateErrors: string[] = [];
  for (const url of idsToBeSaved) {
    // Get the current link
    const link: AffiliationLink = currentLinks.find((cl: AffiliationLink): boolean => cl.url === url);
    const desiredLink: AffiliationLink = desiredLinks.find((dl: AffiliationLink): boolean => {
      return dl.url === url;
    });

    // If the link exists, update it otherwise add a new one
    if (link) {
      const newLink = new AffiliationLink({ ...link, ...desiredLinks });
      const wasUpdated: AffiliationLink = await newLink.update(context);
      if (!wasUpdated || wasUpdated.hasErrors()) {
        updateErrors.push(link.url);
      }
    } else {
      if (desiredLink) {
        desiredLink.affiliationId = affiliation.uri
        const wasAdded: AffiliationLink = await desiredLink.create(context);
        if (!wasAdded || wasAdded.hasErrors()) {
          addErrors.push(desiredLink.url);
        }
      } else {
        updateErrors.push(link.url);
      }
    }
  }
  if (addErrors.length > 0) {
    errs.push(`unable to add links: ${addErrors.join(', ')}`);
  }
  if (updateErrors.length > 0) {
    errs.push(`unable to update links: ${updateErrors.join(', ')}`);
  }

  // If any errors occurred, set the error message on the affiliation
  if (errs.length > 0) {
    affiliation.addError('subHeaderLinks', errs.join('; '));
    return false;
  }
  return true;
}
