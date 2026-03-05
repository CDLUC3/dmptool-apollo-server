import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { Affiliation, AffiliationProvenance, AffiliationType, DEFAULT_DMPTOOL_AFFILIATION_URL } from "../../models/Affiliation";
import { processOtherAffiliationName } from "../affiliationService";
import { getCurrentDate } from "../../utils/helpers";

// Pulling context in here so that the mysql gets mocked
jest.mock('../../context.ts');

let context;
let affiliationStore;

let mockFindById;
let mockFindByName;
let mockInsert;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);

  affiliationStore = [];

  // Fetch an item from the affiliationStore
  mockFindById = jest.fn().mockImplementation((_, __, id) => {
    return affiliationStore.find((entry) => { return entry.id === id });
  });
  (Affiliation.findById as jest.Mock) = mockFindById;

  mockFindByName = jest.fn().mockImplementation((_, __, name) => {
    return affiliationStore.find((entry) => {
      return entry.name.toLowerCase().trim() === name.toLowerCase().trim();
    });
  });
  (Affiliation.findByName as jest.Mock) = mockFindByName;

  // Add an item to the affiliationStore
  mockInsert = jest.fn().mockImplementation((context, table, obj) => {
    const tstamp = getCurrentDate();
    const userId = context.token.id;
    obj.id = casual.integer(1, 9999);
    obj.created = tstamp;
    obj.createdById = userId;
    obj.modifed = tstamp;
    obj.modifiedById = userId;

    affiliationStore.push(obj);
    return obj.id;
  });
  (Affiliation.insert as jest.Mock) = mockInsert;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('processOtherAffiliationName', () => {
  it('returns the id of the existing affiliation if the name already exists', async () => {
    // Mock the finder method
    const id = casual.integer(1, 9999);
    const name = casual.company_name;
    affiliationStore.push(new Affiliation({ id, name }));

    const result = await processOtherAffiliationName(context, ` ${name.toLowerCase()}  `);
    expect(result).toEqual(affiliationStore[0]);
  });

  it('returns the id of the new affiliation', async () => {
    // Mock the finder method
    const name = 'Other Affiliation Test';
    affiliationStore.push(new Affiliation({ id: casual.integer(1, 9999), name: casual.company_name }));

    const result = await processOtherAffiliationName(context, name);
    expect(result.id).toEqual(affiliationStore[1].id);
    expect(result.name).toEqual(affiliationStore[1].name);
    expect(result.provenance).toEqual(AffiliationProvenance.DMPTOOL);
    expect(result.uri.includes(DEFAULT_DMPTOOL_AFFILIATION_URL)).toBe(true);
    expect(result.types).toEqual([AffiliationType.OTHER]);
    expect(result.active).toBe(true);
    expect(result.uneditableProperties).toEqual(['uri', 'provenance', 'searchName']);
  });
});
