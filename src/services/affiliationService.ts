import { MyContext } from "../context";
import { Affiliation } from "../models/Affiliation";
import {AffiliationEmailDomain} from "../models/AffiliationEmailDomain";
import {isNullOrUndefined} from "../utils/helpers";
import {AffiliationLink} from "../models/AffiliationLink";

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
    const newAffiliation = new Affiliation({ name });

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
    currentEmailDomains.map((ced: AffiliationEmailDomain): number => ced.id),
    desiredEmailDomainIds.map((ded: AffiliationEmailDomain): number => ded.id)
  );

  const errs: string[] = [];

  // Remove domains that are no longer there
  const removeErrors: string[] = [];
  for (const id of idsToBeRemoved) {
    const domain: AffiliationEmailDomain = await AffiliationEmailDomain.findById(reference, context, id);
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
    const domain: AffiliationEmailDomain = await AffiliationEmailDomain.findById(reference, context, id);
    // Since there's nothing on the EmailDomain record beside the email domain, we
    // don't need to worry about updating. We just add it if it's not already there.
    if (!domain) {
      const desired: AffiliationEmailDomain = desiredEmailDomainIds.find((ded: AffiliationEmailDomain): boolean => {
        return ded.id === id;
      });
      if (desired) {
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
    currentLinks.map((cl: AffiliationLink): number => cl.id),
    desiredLinks.map((dl: AffiliationLink): number => dl.id)
  );

  const errs: string[] = [];

  // Remove links that are no longer there
  const removeErrors: string[] = [];
  for (const id of idsToBeRemoved) {
    const link: AffiliationLink = await AffiliationLink.findById(reference, context, id);
    if (link) {
      const wasRemoved: AffiliationLink = await link.delete(context);
      if (!wasRemoved) {
        removeErrors.push(link.url);
      }
    }
  }
  if (removeErrors.length > 0) {
    errs.push(`unable to remove links: ${removeErrors.join(', ')}`);
  }

  // Add new links or update the existing ones
  const addErrors: string[] = [];
  const updateErrors: string[] = [];
  for (const id of idsToBeSaved) {
    const link: AffiliationLink = await AffiliationLink.findById(reference, context, id);
    // If the link exists, update it otherwise add a new one
    if (link) {
      const wasUpdated: AffiliationLink = await link.update(context);
      if (!wasUpdated || wasUpdated.hasErrors()) {
        updateErrors.push(link.url);
      }
    } else {
      const desiredLink: AffiliationLink = desiredLinks.find((dl: AffiliationLink): boolean => {
        return dl.id === id;
      });
      if (desiredLink) {
        const wasAdded: AffiliationLink = await desiredLink.create(context);
        if (!wasAdded) {
          addErrors.push(desiredLink.url);
        }
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
    affiliation.addError('affiliationLinks', errs.join('; '));
    return false;
  }
  return true;
}
