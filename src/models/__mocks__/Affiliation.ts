import casual from "casual";
import { isNullOrUndefined } from "../../utils/helpers.js";
import { getRandomEnumValue } from "../../__tests__/helpers.js";
import { MyContext } from "../../context.js";
import {
  Affiliation,
  AffiliationProvenance,
  AffiliationType,
  DEFAULT_ROR_AFFILIATION_URL
} from "../Affiliation";

// Store for all mock/test Affiliations that were persisted to the DB
const addedAffiliationIds: number[] = [];

export interface MockAffiliationOptions {
  name?: string;
  uri?: string;
  funder?: boolean;
  types?: AffiliationType[];
  provenance?: AffiliationProvenance;
  homepage?: string;
  acronyms?: string[];
  aliases?: string[];
  fundrefId?: string;
  active?: boolean;
}

// Generate a mock/test Affiliation
export const mockAffiliation = (
  options: MockAffiliationOptions
): Affiliation => {
  const name = casual.company_name;
  const homepage = casual.url;
  const domain = homepage.replace(/http(s)?:\/\//, '')
    .replace('/', '')
    .toLowerCase();
  const acronyms = casual.array_of_words(2);
  const aliases = casual.array_of_words(2);
  const searchName = [
    name,
    domain,
    acronyms.join(' | '),
    aliases.join(' | ')
  ].filter((s) => s.length > 0);

  // Use the options provided or default a value
  return new Affiliation({
    name: options.name ?? name,
    uri: options.uri ?? `${DEFAULT_ROR_AFFILIATION_URL}/${casual.uuid}`,
    funder: options.funder ?? casual.boolean,
    types: options.types ?? [getRandomEnumValue(AffiliationType)],
    displayName: `${name} (${domain})`,
    searchName,
    provenance: options.provenance ?? AffiliationProvenance.ROR,
    homepage: options.homepage ?? homepage,
    acronyms: options.acronyms ?? acronyms,
    aliases: options.aliases ?? aliases,
    fundrefId: options.fundrefId ?? casual.uuid,
    active: options.active ?? casual.boolean,
  });
}

// Save a mock/test Affiliation in the DB for integration tests
export const persistAffiliation = async (
  context: MyContext,
  affiliation: Affiliation
): Promise<Affiliation | null> => {
  try {
    const created = await affiliation.create(context);
    if (!isNullOrUndefined(created)) {
      // Keep track of the id so we can clean up afterward
      addedAffiliationIds.push(created.id);
      return created;
    }
    console.error(`Unable to persist affiliation: ${affiliation.uri}`);
  } catch (e) {
    console.error(`Error persisting affiliation ${affiliation.uri}: ${e.message}`);
  }
  return null;
}

// Clean up all mock/test Affiliations
export const cleanUpAddedAffiliations = async (
  context: MyContext,
): Promise<void> => {
  const reference = 'cleanUpAddedAffiliations';
  for (const id of addedAffiliationIds) {
    try {
      const affiliation = await Affiliation.findById(reference, context, id);
      if (!isNullOrUndefined(affiliation)) {
        await affiliation.delete(context);
      }
    } catch (e) {
      console.error(`Error cleaning up affiliation id ${id}: ${e.message}`);
    }
  }
}

// Fetch a random persisted Affiliation
export const randomAffiliation = async (
  context: MyContext
): Promise<Affiliation | null> => {
  const sql = 'SELECT * FROM affiliations WHERE active = 1 ORDER BY RAND() LIMIT 1';
  try {
    const results = Affiliation.query(context, sql, [], 'randomAffiliation');
    if (Array.isArray(results) && results.length > 0) {
      return new Affiliation([0]);
    }
  } catch (e) {
    console.error(`Error getting random affiliation: ${e.message}`);
  }
  return null;
}
