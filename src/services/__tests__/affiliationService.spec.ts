import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { Affiliation, AffiliationProvenance, AffiliationType, DEFAULT_DMPTOOL_AFFILIATION_URL } from "../../models/Affiliation";
import {
  processOtherAffiliationName,
  reconcileAffiliationEmailDomains,
  reconcileAffiliationLinks,
  resolveAffiliation
} from "../affiliationService";
import { getCurrentDate } from "../../utils/helpers";
import { AffiliationEmailDomain } from "../../models/AffiliationEmailDomain";
import { AffiliationLink } from "../../models/AffiliationLink";

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
      return entry.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim()
        || entry.displayName?.toLowerCase()?.trim() === name?.toLowerCase()?.trim();
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
    affiliationStore.push(new Affiliation({ id: casual.integer(1, 9999), displayName: casual.company_name }));

    const result = await processOtherAffiliationName(context, name);
    expect(result.id).toEqual(affiliationStore[1].id);
    expect(result.name).toEqual(affiliationStore[1].displayName);
    expect(result.displayName).toEqual(affiliationStore[1].displayName);
    expect(result.provenance).toEqual(AffiliationProvenance.DMPTOOL);
    expect(result.uri.includes(DEFAULT_DMPTOOL_AFFILIATION_URL)).toBe(true);
    expect(result.types).toEqual([AffiliationType.OTHER]);
    expect(result.active).toBe(true);
  });
});

describe('reconcileAffiliationEmailDomains', () => {
  const reference = 'reconcileAffiliationEmailDomains test';

  function buildAffiliation(overrides = {}): Affiliation {
    return {
      id: casual.integer(1, 999),
      uri: 'https://ror.org/12345',
      displayName: casual.company_name,
      addError: jest.fn(),
      ...overrides,
    } as unknown as Affiliation;
  }

  function buildDomain(overrides = {}): AffiliationEmailDomain {
    return {
      id: casual.integer(1, 999),
      emailDomain: 'example.edu',
      create: jest.fn(),
      delete: jest.fn(),
      ...overrides,
    } as unknown as AffiliationEmailDomain;
  }

  it('removes stale domains and adds new domains successfully', async () => {
    const affiliation = buildAffiliation();
    const existing = buildDomain({ id: 11, emailDomain: 'old.edu' });
    const desired = buildDomain({ id: 22, emailDomain: 'new.edu' });

    const findByAffiliationIdSpy = jest
      .spyOn(AffiliationEmailDomain, 'findByAffiliationId')
      .mockResolvedValue([existing]);
    const reconcileSpy = jest
      .spyOn(Affiliation, 'reconcileAssociationIds')
      .mockReturnValue({ idsToBeRemoved: ['old.edu'], idsToBeSaved: ['new.edu'] });

    (existing.delete as jest.Mock).mockResolvedValue(existing);
    (desired.create as jest.Mock).mockResolvedValue(desired);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      affiliation,
      [desired],
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).toHaveBeenCalledWith(
      reference,
      context,
      affiliation.uri
    );
    expect(reconcileSpy).toHaveBeenCalledWith(['old.edu'], ['new.edu']);
    expect(existing.delete).toHaveBeenCalledWith(context);
    expect(desired.create).toHaveBeenCalledWith(context);
    expect(desired.affiliationId).toBe(affiliation.uri);
    expect(affiliation.addError).not.toHaveBeenCalled();
  });

  it('adds a combined affiliationEmailDomains error when remove/add operations fail', async () => {
    const affiliation = buildAffiliation();
    const existing = buildDomain({ id: 11, emailDomain: 'old.edu' });
    const desired = buildDomain({ id: 22, emailDomain: 'new.edu' });

    jest.spyOn(AffiliationEmailDomain, 'findByAffiliationId').mockResolvedValue([existing]);
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['old.edu'],
      idsToBeSaved: ['new.edu'],
    });

    (existing.delete as jest.Mock).mockResolvedValue(null);
    (desired.create as jest.Mock).mockResolvedValue(null);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      affiliation,
      [desired],
    );

    expect(result).toBe(false);
    expect(affiliation.addError).toHaveBeenCalledWith(
      'affiliationEmailDomains',
      'unable to remove email domains: old.edu; unable to add email domains: new.edu',
    );
  });

  it('does not load current domains when affiliation is new', async () => {
    const affiliation = buildAffiliation({ id: null });
    const desired = buildDomain({ id: 22, emailDomain: 'new.edu' });

    const findByAffiliationIdSpy = jest
      .spyOn(AffiliationEmailDomain, 'findByAffiliationId')
      .mockResolvedValue([]);
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: [],
      idsToBeSaved: ['new.edu'],
    });
    (desired.create as jest.Mock).mockResolvedValue(desired);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      affiliation,
      [desired],
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).not.toHaveBeenCalled();
    expect(desired.create).toHaveBeenCalledWith(context);
  });
});

describe('reconcileAffiliationLinks', () => {
  const reference = 'reconcileAffiliationLinks test';

  function buildAffiliation(overrides = {}): Affiliation {
    return {
      id: casual.integer(1, 999),
      uri: 'https://ror.org/12345',
      addError: jest.fn(),
      ...overrides,
    } as unknown as Affiliation;
  }

  function buildLink(overrides = {}): AffiliationLink {
    return {
      id: casual.integer(1, 999),
      url: 'https://example.edu/help',
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      hasErrors: jest.fn().mockReturnValue(false),
      ...overrides,
    } as unknown as AffiliationLink;
  }

  it('removes stale links, updates existing links, and adds new links', async () => {
    const affiliation = buildAffiliation();
    const existing = buildLink({ id: 101, url: 'https://old.edu/1' });
    const toAdd = buildLink({ id: 303, url: 'https://new.edu/3' });

    jest.spyOn(AffiliationLink, 'findByAffiliationId').mockResolvedValue([existing]);
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['https://old.edu/1'],
      idsToBeSaved: ['https://new.edu/3'],
    });

    (existing.delete as jest.Mock).mockResolvedValue(existing);
    (toAdd.create as jest.Mock).mockResolvedValue(toAdd);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      affiliation,
      [toAdd],
    );

    expect(result).toBe(true);
    expect(existing.delete).toHaveBeenCalledWith(context);
    expect(toAdd.create).toHaveBeenCalledWith(context);
    expect(affiliation.addError).not.toHaveBeenCalled();
  });

  it('adds a combined affiliationLinks error when remove/add/update operations fail', async () => {
    const affiliation = buildAffiliation();
    const existing = buildLink({ id: 101, url: 'https://old.edu/1' });
    const toAdd = buildLink({ id: 303, url: 'https://new.edu/3' });

    jest.spyOn(AffiliationLink, 'findByAffiliationId').mockResolvedValue([existing]);
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['https://old.edu/1'],
      idsToBeSaved: ['https://new.edu/3'],
    });

    (existing.delete as jest.Mock).mockResolvedValue(null);
    (toAdd.create as jest.Mock).mockResolvedValue(null);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      affiliation,
      [toAdd],
    );

    expect(result).toBe(false);
    expect(affiliation.addError).toHaveBeenCalledWith(
      'subHeaderLinks',
      'unable to remove links: https://old.edu/1; unable to add links: https://new.edu/3',
    );
  });

  it('does not load current links when affiliation is new', async () => {
    const affiliation = buildAffiliation({ id: undefined });
    const toAdd = buildLink({ id: 303, url: 'https://new.edu/3' });

    const findByAffiliationIdSpy = jest
      .spyOn(AffiliationLink, 'findByAffiliationId')
      .mockResolvedValue([]);
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: [],
      idsToBeSaved: ['https://new.edu/3'],
    });
    (toAdd.create as jest.Mock).mockResolvedValue(toAdd);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      affiliation,
      [toAdd],
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).not.toHaveBeenCalled();
    expect(toAdd.create).toHaveBeenCalledWith(context);
  });
});

describe('resolveAffiliation', () => {
  const reference = 'resolveAffiliation test';
  let mockFindByURI: jest.Mock;

  beforeEach(() => {
    mockFindByURI = jest.fn();
    (Affiliation.findByURI as jest.Mock) = mockFindByURI;
  });

  it('returns an error when affiliationId is "other" but no affiliationName is provided', async () => {
    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: 'other', affiliationName: '' },
      context.token.id,
    );

    expect(result.affiliationId).toBeNull();
    expect(result.error).toEqual('An affiliation name is required when "Other" is selected');
    expect(mockFindByURI).not.toHaveBeenCalled();
  });

  it('resolves the "other" sentinel via processOtherAffiliationName when a name is provided', async () => {
    const name = casual.company_name;

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: 'other', affiliationName: name },
      context.token.id,
    );

    expect(result.error).toBeUndefined();
    expect(affiliationStore).toHaveLength(1);
    expect(affiliationStore[0].displayName).toEqual(name);
    expect(result.affiliationId).toEqual(affiliationStore[0].uri);
    expect(mockFindByURI).not.toHaveBeenCalled();
  });

  it('returns the provided affiliationId unchanged when it already exists', async () => {
    const uri = casual.url;
    const existing = new Affiliation({ id: casual.integer(1, 9999), uri, name: casual.company_name });
    mockFindByURI.mockResolvedValue(existing);

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: uri, affiliationName: casual.company_name },
      context.token.id,
    );

    expect(result.error).toBeUndefined();
    expect(result.affiliationId).toEqual(uri);
    expect(mockFindByURI).toHaveBeenCalledWith(reference, context, uri);
  });

  it('creates a new affiliation when affiliationId is provided but does not exist yet', async () => {
    const uri = casual.url;
    const name = casual.company_name;
    mockFindByURI.mockResolvedValue(undefined);

    const createSpy = jest
      .spyOn(Affiliation.prototype, 'create')
      .mockImplementation(async function (this: Affiliation) {
        return Object.assign(this, { hasErrors: () => false });
      });

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: uri, affiliationName: name },
      context.token.id,
    );

    expect(createSpy).toHaveBeenCalledWith(context);
    expect(result.error).toBeUndefined();
    expect(result.affiliationId).toEqual(uri);

    createSpy.mockRestore();
  });

  it('returns an error when creating the new affiliation returns errors', async () => {
    const uri = casual.url;
    const name = casual.company_name;
    mockFindByURI.mockResolvedValue(undefined);

    const createSpy = jest
      .spyOn(Affiliation.prototype, 'create')
      .mockImplementation(async function (this: Affiliation) {
        return Object.assign(this, { hasErrors: () => true });
      });

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: uri, affiliationName: name },
      context.token.id,
    );

    expect(result.affiliationId).toBeNull();
    expect(result.error).toEqual('Unable to create required affiliation');

    createSpy.mockRestore();
  });

  it('returns an error when creating the new affiliation returns null', async () => {
    const uri = casual.url;
    const name = casual.company_name;
    mockFindByURI.mockResolvedValue(undefined);

    const createSpy = jest.spyOn(Affiliation.prototype, 'create').mockResolvedValue(null);

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: uri, affiliationName: name },
      context.token.id,
    );

    expect(result.affiliationId).toBeNull();
    expect(result.error).toEqual('Unable to create required affiliation');

    createSpy.mockRestore();
  });

  it('returns the affiliationId unchanged when it does not exist and no affiliationName is provided', async () => {
    const uri = casual.url;
    mockFindByURI.mockResolvedValue(undefined);

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: uri, affiliationName: '' },
      context.token.id,
    );

    expect(result.error).toBeUndefined();
    expect(result.affiliationId).toEqual(uri);
  });

  it('resolves via processOtherAffiliationName when only affiliationName is provided', async () => {
    const name = casual.company_name;

    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: '', affiliationName: name },
      context.token.id,
    );

    expect(result.error).toBeUndefined();
    expect(affiliationStore).toHaveLength(1);
    expect(result.affiliationId).toEqual(affiliationStore[0].uri);
    expect(mockFindByURI).not.toHaveBeenCalled();
  });

  it('returns a null affiliationId when neither affiliationId nor affiliationName are provided', async () => {
    const result = await resolveAffiliation(
      reference,
      context,
      { affiliationId: '', affiliationName: '' },
      context.token.id,
    );

    expect(result.error).toBeUndefined();
    expect(result.affiliationId).toBeNull();
    expect(mockFindByURI).not.toHaveBeenCalled();
  });
});

