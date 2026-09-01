import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import { buildMockContextWithToken } from "../../__mocks__/context.js";
import { logger } from "../../logger.js";
import { Affiliation, AffiliationProvenance, AffiliationType, DEFAULT_DMPTOOL_AFFILIATION_URL } from "../../models/Affiliation.js";
import {
  processOtherAffiliationName,
  reconcileAffiliationEmailDomains,
  reconcileAffiliationLinks,
  resolveAffiliation
} from "../affiliationService.js";
import { getCurrentDate } from "../../utils/helpers.js";
import { AffiliationEmailDomain } from "../../models/AffiliationEmailDomain.js";
import { AffiliationLink } from "../../models/AffiliationLink.js";

// ---------------------------------------------------------------------------
// No jest.unstable_mockModule needed in this file at all: unlike the
// resolver specs, there's no resolver.js/schema.js import chain forcing us
// to intercept modules before they're loaded, and every model here is real,
// spied per-test via jest.spyOn. The affiliationService functions themselves
// are the real thing under test — we call them directly, not through a mock.
//
// The original CJS suite's `jest.mock('../../context.js')` was automocking
// the real production context.js purely to avoid its side effects at import
// time; mockAppConfigs()/mockAppLogger() above have been sufficient for that
// in every other spec file converted so far, so it's dropped here too. If
// something in this file throws at import/setup time (rather than a normal
// assertion failure), that's the first thing to revisit.
//
// Cast helpers: jest.spyOn ties itself to the real class's method signature,
// and the affiliationService functions themselves have real typed
// parameters (`affiliation: Affiliation`, `desiredEmailDomainIds:
// AffiliationEmailDomain[]`, etc.), so plain-object fixtures need casting at
// the point they're handed to either — never at their own declaration.
// ---------------------------------------------------------------------------
type AffiliationInstance = InstanceType<typeof Affiliation>;
function asAffiliation(value: any): AffiliationInstance {
  return value as AffiliationInstance;
}

type AffiliationEmailDomainInstance = InstanceType<typeof AffiliationEmailDomain>;
function asAffiliationEmailDomainList(value: any[]): AffiliationEmailDomainInstance[] {
  return value as AffiliationEmailDomainInstance[];
}

type AffiliationLinkInstance = InstanceType<typeof AffiliationLink>;
function asAffiliationLinkList(value: any[]): AffiliationLinkInstance[] {
  return value as AffiliationLinkInstance[];
}

let context: any;
let affiliationStore: any[];

let mockFindById: ReturnType<typeof jest.fn>;
let mockFindByName: ReturnType<typeof jest.fn>;
let mockInsert: ReturnType<typeof jest.fn>;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);

  affiliationStore = [];

  // Fetch an item from the affiliationStore. Kept as a loosely-typed jest.fn()
  // (rather than typing jest.spyOn's mockImplementation against the real
  // Affiliation.findById signature directly) so the implementation callback
  // doesn't have to structurally match the real method's exact args/return
  // type — the `as any` on the wiring line below is the one deliberate
  // escape hatch, isolated to a single spot.
  mockFindById = jest.fn<(...args: any[]) => any>().mockImplementation((_, __, id) => {
    return affiliationStore.find((entry) => entry.id === id);
  });
  jest.spyOn(Affiliation, 'findById').mockImplementation(mockFindById as any);

  mockFindByName = jest.fn<(...args: any[]) => any>().mockImplementation((_, __, name) => {
    return affiliationStore.find((entry) => {
      return entry.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim()
        || entry.displayName?.toLowerCase()?.trim() === name?.toLowerCase()?.trim();
    });
  });
  jest.spyOn(Affiliation, 'findByName').mockImplementation(mockFindByName as any);

  // Add an item to the affiliationStore
  mockInsert = jest.fn<(...args: any[]) => any>().mockImplementation((context, table, obj) => {
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
  jest.spyOn(Affiliation, 'insert').mockImplementation(mockInsert as any);
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

  function buildAffiliation(overrides: Record<string, any> = {}) {
    return {
      id: casual.integer(1, 999),
      uri: 'https://ror.org/12345',
      displayName: casual.company_name,
      addError: jest.fn<(...args: any[]) => void>(),
      ...overrides,
    };
  }

  function buildDomain(overrides: Record<string, any> = {}) {
    return {
      id: casual.integer(1, 999),
      affiliationId: undefined as string | undefined,
      emailDomain: 'example.edu',
      create: jest.fn<(...args: any[]) => Promise<any>>(),
      delete: jest.fn<(...args: any[]) => Promise<any>>(),
      ...overrides,
    };
  }

  it('removes stale domains and adds new domains successfully', async () => {
    const affiliation = buildAffiliation();
    const existing = buildDomain({ id: 11, emailDomain: 'old.edu' });
    const desired = buildDomain({ id: 22, emailDomain: 'new.edu' });

    const findByAffiliationIdSpy = jest
      .spyOn(AffiliationEmailDomain, 'findByAffiliationId')
      .mockResolvedValue(asAffiliationEmailDomainList([existing]));
    const reconcileSpy = jest
      .spyOn(Affiliation, 'reconcileAssociationIds')
      .mockReturnValue({ idsToBeRemoved: ['old.edu'], idsToBeSaved: ['new.edu'] });

    existing.delete.mockResolvedValue(existing);
    desired.create.mockResolvedValue(desired);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationEmailDomainList([desired]),
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).toHaveBeenCalledWith(
      reference,
      context,
      affiliation.uri,
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

    jest.spyOn(AffiliationEmailDomain, 'findByAffiliationId').mockResolvedValue(asAffiliationEmailDomainList([existing]));
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['old.edu'],
      idsToBeSaved: ['new.edu'],
    });

    existing.delete.mockResolvedValue(null);
    desired.create.mockResolvedValue(null);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationEmailDomainList([desired]),
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
      .mockResolvedValue(asAffiliationEmailDomainList([]));
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: [],
      idsToBeSaved: ['new.edu'],
    });
    desired.create.mockResolvedValue(desired);

    const result = await reconcileAffiliationEmailDomains(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationEmailDomainList([desired]),
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).not.toHaveBeenCalled();
    expect(desired.create).toHaveBeenCalledWith(context);
  });
});

describe('reconcileAffiliationLinks', () => {
  const reference = 'reconcileAffiliationLinks test';

  function buildAffiliation(overrides: Record<string, any> = {}) {
    return {
      id: casual.integer(1, 999),
      uri: 'https://ror.org/12345',
      addError: jest.fn<(...args: any[]) => void>(),
      ...overrides,
    };
  }

  function buildLink(overrides: Record<string, any> = {}) {
    return {
      id: casual.integer(1, 999),
      url: 'https://example.edu/help',
      create: jest.fn<(...args: any[]) => Promise<any>>(),
      update: jest.fn<(...args: any[]) => Promise<any>>(),
      delete: jest.fn<(...args: any[]) => Promise<any>>(),
      hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
      ...overrides,
    };
  }

  it('removes stale links, updates existing links, and adds new links', async () => {
    const affiliation = buildAffiliation();
    const existing = buildLink({ id: 101, url: 'https://old.edu/1' });
    const toAdd = buildLink({ id: 303, url: 'https://new.edu/3' });

    jest.spyOn(AffiliationLink, 'findByAffiliationId').mockResolvedValue(asAffiliationLinkList([existing]));
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['https://old.edu/1'],
      idsToBeSaved: ['https://new.edu/3'],
    });

    existing.delete.mockResolvedValue(existing);
    toAdd.create.mockResolvedValue(toAdd);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationLinkList([toAdd]),
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

    jest.spyOn(AffiliationLink, 'findByAffiliationId').mockResolvedValue(asAffiliationLinkList([existing]));
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: ['https://old.edu/1'],
      idsToBeSaved: ['https://new.edu/3'],
    });

    existing.delete.mockResolvedValue(null);
    toAdd.create.mockResolvedValue(null);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationLinkList([toAdd]),
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
      .mockResolvedValue(asAffiliationLinkList([]));
    jest.spyOn(Affiliation, 'reconcileAssociationIds').mockReturnValue({
      idsToBeRemoved: [],
      idsToBeSaved: ['https://new.edu/3'],
    });
    toAdd.create.mockResolvedValue(toAdd);

    const result = await reconcileAffiliationLinks(
      context,
      reference,
      asAffiliation(affiliation),
      asAffiliationLinkList([toAdd]),
    );

    expect(result).toBe(true);
    expect(findByAffiliationIdSpy).not.toHaveBeenCalled();
    expect(toAdd.create).toHaveBeenCalledWith(context);
  });
});

describe('resolveAffiliation', () => {
  const reference = 'resolveAffiliation test';
  let mockFindByURI: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    mockFindByURI = jest.fn<(...args: any[]) => any>();
    jest.spyOn(Affiliation, 'findByURI').mockImplementation(mockFindByURI as any);
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
      .mockImplementation(async function (this: any) {
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
      .mockImplementation(async function (this: any) {
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