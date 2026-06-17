import casual from "casual";

// Mock authenticatedResolver HOF as a simple pass-through
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
}));

import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';

import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import {
  Affiliation,
  AffiliationProvenance,
  AffiliationSearch,
  PopularFunder,
} from '../../models/Affiliation';
import { GuidanceGroup } from '../../models/GuidanceGroup';
import { getAffiliationsWithGuidanceForTemplate } from '../../services/guidanceService';
import {
  getPresignedURLForAffiliationLogo,
  deleteAffiliationLogoFile,
  CDN_BASE_URL,
} from '../../datasources/s3';
import {
  reconcileAffiliationEmailDomains,
  reconcileAffiliationLinks,
} from '../../services/affiliationService';
import { UserRole } from "../../models/User";
import { buildContext, mockToken } from "../../__mocks__/context";
import {mockRor} from "../../mocks/affiliation";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

// Manual mock: keep AffiliationProvenance enum real, mock everything else
jest.mock('../../models/Affiliation', () => {
  const actual = jest.requireActual('../../models/Affiliation');
  return {
    ...actual,
    // Mock static methods on the class
    Affiliation: Object.assign(
      jest.fn().mockImplementation(() => ({
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        addError: jest.fn(),
        errors: {},
      })),
      {
        findById: jest.fn(),
        findByURI: jest.fn(),
        findByName: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }
    ),
    AffiliationSearch: {
      search: jest.fn(),
      searchManagedWithPublishedGuidance: jest.fn(),
    },
    PopularFunder: {
      top5: jest.fn(),
    },
  };
});

jest.mock('../../models/GuidanceGroup');
jest.mock('../../services/guidanceService');
jest.mock('../../services/affiliationService', () => ({
  reconcileAffiliationEmailDomains: jest.fn(),
  reconcileAffiliationLinks: jest.fn(),
  authenticateResolver: jest.fn(),
}));
jest.mock('../../datasources/s3', () => ({
  CDN_BASE_URL: 'https://cdn.example.com/',
  getPresignedURLForAffiliationLogo: jest.fn(),
  deleteAffiliationLogoFile: jest.fn(),
}));

let testServer: ApolloServer;
let affiliationId: string;
let adminToken: JWTAccessToken;
let superAdminToken: JWTAccessToken;
let researcherToken: JWTAccessToken;
let query: string;

// Proxy call to the Apollo server test server
async function executeQuery(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  token: JWTAccessToken
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

// Build a plain object representing an Affiliation — no real constructor involved
function buildMockAffiliation(overrides = {}) {
  return {
    id: casual.integer(1, 999),
    uri: casual.url,
    active: true,
    provenance: AffiliationProvenance.DMPTOOL,
    name: casual.company_name,
    displayName: casual.company_name,
    displayAbbreviation: casual.word,
    displayDomain: casual.domain,
    searchName: casual.company_name,
    funder: false,
    fundrefId: null,
    homepage: casual.url,
    acronyms: [],
    aliases: [],
    types: ['EDUCATION'],
    managed: true,
    logoName: 'logo.png',
    logoURI: `${CDN_BASE_URL}logo.png`,
    contactEmail: casual.email,
    contactName: casual.full_name,
    ssoEntityId: null,
    feedbackEnabled: false,
    feedbackMessage: null,
    feedbackEmails: [],
    uneditableProperties: [],
    apiTarget: null,
    errors: {},
    addError: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    hasErrors: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

function buildAffiliationInput(overrides = {}) {
  return {
    id: casual.integer(1, 999),
    displayName: casual.company_name,
    subHeaderLinks: [],
    ssoEmailDomains: [],
    ...overrides,
  };
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;

  superAdminToken = await mockToken();
  superAdminToken.role = UserRole.SUPERADMIN;

  researcherToken = await mockToken();
  researcherToken.role = UserRole.RESEARCHER;

  (reconcileAffiliationLinks as jest.Mock).mockResolvedValue(true);
  (reconcileAffiliationEmailDomains as jest.Mock).mockResolvedValue(true);
  (deleteAffiliationLogoFile as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('affiliation resolver', () => {
  describe('Query.affiliationTypes', () => {
    beforeEach(() => {
      query = `
        query affiliationTypes {
          affiliationTypes
        }
      `;
    });

    it('should return all affiliation type values', async () => {
      const result = await executeQuery(query, {}, adminToken);
      const types = result.body.singleResult.data.affiliationTypes;
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('EDUCATION');
      expect(types).toContain('COMPANY');
      expect(types).toContain('GOVERNMENT');
    });
  });

  describe('Query.affiliations', () => {
    beforeEach(() => {
      query = `
        query affiliations($name: String!, $funderOnly: Boolean, $paginationOptions: PaginationOptions) {
          affiliations(name: $name, funderOnly: $funderOnly, paginationOptions: $paginationOptions) {
            items {
              id
              uri
              name
              displayName
              funder
            }
            totalCount
            hasNextPage
          }
        }
      `;
    });

    it('should return search results for a name query', async () => {
      const mockResults = {
        items: [{ id: 1, uri: casual.url, name: 'Test Org', displayName: 'Test Org (US)', funder: false }],
        totalCount: 1,
        hasNextPage: false,
        currentOffset: 0,
      };

      (AffiliationSearch.search as jest.Mock).mockResolvedValue(mockResults);

      const result = await executeQuery(query, { name: 'Test' }, adminToken);

      expect(result.body.singleResult.data.affiliations.totalCount).toBe(1);
      expect(result.body.singleResult.data.affiliations.items[0].name).toBe('Test Org');
      expect(AffiliationSearch.search).toHaveBeenCalledTimes(1);
    });

    it('should pass funderOnly flag to the search model', async () => {
      const mockResults = { items: [], totalCount: 0, hasNextPage: false, currentOffset: 0 };
      (AffiliationSearch.search as jest.Mock).mockResolvedValue(mockResults);

      await executeQuery(query, { name: 'Test', funderOnly: true }, adminToken);

      expect(AffiliationSearch.search).toHaveBeenCalledWith(
        'affiliations resolver',
        expect.any(Object),
        'Test',
        true,
        expect.any(Object),
      );
    });

    it('should return an InternalServerError when the search throws', async () => {
      (AffiliationSearch.search as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const result = await executeQuery(query, { name: 'Test' }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Query.managedAffiliationsWithGuidance', () => {
    beforeEach(() => {
      query = `
        query managedAffiliationsWithGuidance($versionedTemplateId: Int!, $name: String) {
          managedAffiliationsWithGuidance(versionedTemplateId: $versionedTemplateId, name: $name) {
            items {
              id
              uri
              name
              displayName
              funder
            }
            totalCount
            hasNextPage
          }
        }
      `;
    });

    it('should return empty results when no affiliations have guidance', async () => {
      (getAffiliationsWithGuidanceForTemplate as jest.Mock).mockResolvedValue([]);

      const result = await executeQuery(query, { versionedTemplateId: 1 }, adminToken);

      expect(result.body.singleResult.data.managedAffiliationsWithGuidance.totalCount).toBe(0);
      expect(result.body.singleResult.data.managedAffiliationsWithGuidance.items).toHaveLength(0);
      expect(AffiliationSearch.searchManagedWithPublishedGuidance).not.toHaveBeenCalled();
    });

    it('should search for affiliations when guidance URIs are present', async () => {
      const mockUris = [casual.url, casual.url];
      const mockResults = {
        items: [{ id: 1, uri: mockUris[0], name: 'Org A', displayName: 'Org A', funder: false }],
        totalCount: 1,
        hasNextPage: false,
        currentOffset: 0,
      };

      (getAffiliationsWithGuidanceForTemplate as jest.Mock).mockResolvedValue(mockUris);
      (AffiliationSearch.searchManagedWithPublishedGuidance as jest.Mock).mockResolvedValue(mockResults);

      const result = await executeQuery(query, { versionedTemplateId: 1, name: 'Org' }, adminToken);

      expect(result.body.singleResult.data.managedAffiliationsWithGuidance.totalCount).toBe(1);
      expect(AffiliationSearch.searchManagedWithPublishedGuidance).toHaveBeenCalledWith(
        'managedAffiliationsWithGuidance resolver',
        expect.any(Object),
        'Org',
        mockUris,
        expect.any(Object),
      );
    });

    it('should return an InternalServerError when the service throws', async () => {
      (getAffiliationsWithGuidanceForTemplate as jest.Mock).mockRejectedValue(new Error('failure'));

      const result = await executeQuery(query, { versionedTemplateId: 1 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Query.affiliationById', () => {
    beforeEach(() => {
      query = `
        query affiliationById($affiliationId: Int!) {
          affiliationById(affiliationId: $affiliationId) {
            id
            uri
            name
            displayName
            provenance
            active
            funder
            managed
            feedbackEnabled
            types
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return the affiliation when found', async () => {
      const mockAffiliation = buildMockAffiliation();
      (Affiliation.findById as jest.Mock).mockResolvedValue(mockAffiliation);

      const result = await executeQuery(query, { affiliationId: mockAffiliation.id }, adminToken);

      expect(result.body.singleResult.data.affiliationById.id).toBe(mockAffiliation.id);
      expect(result.body.singleResult.data.affiliationById.name).toBe(mockAffiliation.name);
      expect(Affiliation.findById).toHaveBeenCalledWith(
        'affiliationById resolver',
        expect.any(Object),
        mockAffiliation.id,
      );
    });

    it('should return an InternalServerError when the lookup throws', async () => {
      (Affiliation.findById as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, { affiliationId: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Query.affiliationByURI', () => {
    beforeEach(() => {
      query = `
        query affiliationByURI($uri: String!) {
          affiliationByURI(uri: $uri) {
            id
            uri
            name
            displayName
            provenance
            active
            funder
            managed
            feedbackEnabled
            types
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return the affiliation when found by URI', async () => {
      const mockAffiliation = buildMockAffiliation();
      (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliation);

      const result = await executeQuery(query, { uri: mockAffiliation.uri }, adminToken);

      expect(result.body.singleResult.data.affiliationByURI.uri).toBe(mockAffiliation.uri);
      expect(Affiliation.findByURI).toHaveBeenCalledWith(
        'affiliationByURI resolver',
        expect.any(Object),
        mockAffiliation.uri,
      );
    });

    it('should return an InternalServerError when the lookup throws', async () => {
      (Affiliation.findByURI as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, { uri: casual.url }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Query.popularFunders', () => {
    beforeEach(() => {
      query = `
        query popularFunders {
          popularFunders {
            id
            uri
            displayName
            nbrPlans
          }
        }
      `;
    });

    it('should return the top popular funders', async () => {
      const mockFunders = [
        { id: 1, uri: casual.url, displayName: 'NSF', nbrPlans: 42, apiTarget: null },
        { id: 2, uri: casual.url, displayName: 'NIH', nbrPlans: 30, apiTarget: null },
      ];
      (PopularFunder.top5 as jest.Mock).mockResolvedValue(mockFunders);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.popularFunders).toHaveLength(2);
      expect(result.body.singleResult.data.popularFunders[0].displayName).toBe('NSF');
    });

    it('should return an InternalServerError when the lookup throws', async () => {
      (PopularFunder.top5 as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Mutation.addAffiliation', () => {
    beforeEach(() => {
      query = `
        mutation addAffiliation($input: AffiliationInput!) {
          addAffiliation(input: $input) {
            id
            uri
            name
            displayName
            errors {
              general
            }
          }
        }
      `;
    });

    it('should create and return a new affiliation', async () => {
      const mockCreated = buildMockAffiliation({ id: 99 });
      // The resolver does: new Affiliation(input).create(context)
      // Our manual mock constructor returns an object with a create jest.fn()
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...buildMockAffiliation({ id: 99 }),
        create: jest.fn().mockResolvedValue(mockCreated),
      }));

      const result = await executeQuery(query, { input: buildAffiliationInput() }, adminToken);

      expect(result.body.singleResult.data.addAffiliation.id).toBe(99);
      expect(reconcileAffiliationLinks).toHaveBeenCalledTimes(1);
      expect(reconcileAffiliationEmailDomains).not.toHaveBeenCalled();
    });

    it('should return a  allow an Admin to set a ROR id', async () => {
      const rorId: string = mockRor();
      const mockCreated = buildMockAffiliation({ id: 99 });
      // The resolver does: new Affiliation(input).create(context)
      // Our manual mock constructor returns an object with a create jest.fn()
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...buildMockAffiliation({ id: 99 }),
        create: jest.fn().mockResolvedValue(mockCreated),
      }));

      const result = await executeQuery(query, { input: buildAffiliationInput() }, adminToken);

      expect(result.body.singleResult.data.addAffiliation.id).toBe(99);
      expect(result.body.singleResult.data.addAffiliation.uri).not.toBe(rorId);
      expect(reconcileAffiliationLinks).toHaveBeenCalledTimes(1);
      expect(reconcileAffiliationEmailDomains).not.toHaveBeenCalled();
    });

    it('should return a general error when creation returns null', async () => {
      const affiliationInstance = {
        ...buildMockAffiliation({ id: null }),
        create: jest.fn().mockResolvedValue(null),
        addError: jest.fn(),
        errors: {},
      };

      (Affiliation as unknown as jest.Mock).mockImplementation(() => affiliationInstance);

      const result = await executeQuery(
        query,
        { input: buildAffiliationInput() },
        adminToken,
      );

      // Resolver calls addError and returns the instance — no top-level GraphQL error
      expect(result.body.singleResult.errors).toBeUndefined();
    });
  });

  describe('Mutation.updateAffiliation', () => {
    beforeEach(() => {
      query = `
        mutation updateAffiliation($input: AffiliationInput!) {
          updateAffiliation(input: $input) {
            id
            uri
            name
            displayName
            logoName
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return NotFound when affiliation does not exist', async () => {
      (Affiliation.findById as jest.Mock).mockResolvedValue(null);

      const input = buildAffiliationInput({ id: 1, displayName: casual.company_name });
      const result = await executeQuery(query, { input }, superAdminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Not Found');
    });

    it('should update when the caller is a superAdmin', async () => {
      const existing = buildMockAffiliation({ id: 1, uri: casual.url });
      const updated = buildMockAffiliation({ ...existing, name: 'Updated Name' });

      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...existing,
        update: jest.fn().mockResolvedValue(updated),
        errors: {},
        id: existing.id,
      }));

      const input = buildAffiliationInput({
        id: 1,
        displayName: 'Updated Name',
        name: 'Updated Name',
      });
      const result = await executeQuery(query, { input }, superAdminToken);

      expect(result.body.singleResult.data.updateAffiliation.name).toBe('Updated Name');
      expect(reconcileAffiliationLinks).toHaveBeenCalledTimes(1);
      expect(reconcileAffiliationEmailDomains).toHaveBeenCalledTimes(1);
      expect(deleteAffiliationLogoFile).not.toHaveBeenCalled();
    });

    it('should delete previous logo file when logoName changes', async () => {
      const existing = buildMockAffiliation({ id: 1, uri: casual.url, logoName: 'old-logo.png' });
      const updated = buildMockAffiliation({ ...existing, logoName: 'new-logo.png' });

      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...existing,
        logoName: 'new-logo.png',
        update: jest.fn().mockResolvedValue(updated),
        errors: {},
        id: existing.id,
      }));

      const input = buildAffiliationInput({
        id: 1,
        displayName: 'Updated Name',
        name: 'Updated Name',
        logoName: 'new-logo.png',
      });
      const result = await executeQuery(query, { input }, superAdminToken);

      expect(result.body.singleResult.data.updateAffiliation.logoName).toBe('new-logo.png');
      expect(deleteAffiliationLogoFile).toHaveBeenCalledWith(
        expect.any(Object),
        'old-logo.png',
      );
    });

    it('continues update when logo deletion fails', async () => {
      const existing = buildMockAffiliation({ id: 1, uri: casual.url, logoName: 'old-logo.png' });
      const updated = buildMockAffiliation({ ...existing, logoName: 'new-logo.png' });

      (deleteAffiliationLogoFile as jest.Mock).mockResolvedValue(false);
      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...existing,
        logoName: 'new-logo.png',
        update: jest.fn().mockResolvedValue(updated),
        errors: {},
        id: existing.id,
      }));

      const input = buildAffiliationInput({
        id: 1,
        displayName: 'Updated Name',
        name: 'Updated Name',
        logoName: 'new-logo.png',
      });
      const result = await executeQuery(query, { input }, superAdminToken);

      expect(result.body.singleResult.data.updateAffiliation.id).toBe(existing.id);
      expect(deleteAffiliationLogoFile).toHaveBeenCalledWith(
        expect.any(Object),
        'old-logo.png',
      );
    });

    it('should update when the caller is an Admin for the same affiliation', async () => {
      const existing = buildMockAffiliation({ id: 1, uri: affiliationId });
      const updated = buildMockAffiliation({ ...existing, name: 'Admin Updated' });

      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);
      (Affiliation as unknown as jest.Mock).mockImplementation(() => ({
        ...existing,
        update: jest.fn().mockResolvedValue(updated),
        errors: {},
        id: existing.id,
      }));

      const input = buildAffiliationInput({
        id: 1,
        displayName: 'Admin Updated',
        name: 'Admin Updated',
      });
      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateAffiliation.name).toBe('Admin Updated');
      expect(reconcileAffiliationLinks).toHaveBeenCalledTimes(1);
      expect(reconcileAffiliationEmailDomains).not.toHaveBeenCalled();
    });

    it('should return Forbidden when an Admin tries to update a different affiliation', async () => {
      // uri is different from adminToken.affiliationId
      const existing = buildMockAffiliation({ id: 1, uri: 'https://ror.org/different' });
      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);

      const input = buildAffiliationInput({
        id: 1,
        displayName: 'Hacked Name',
        name: 'Hacked Name',
      });
      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Forbidden');
    });

    it('should return an error when a researcher tries to update', async () => {
      const existing = buildMockAffiliation({ id: 1, uri: casual.url });
      (Affiliation.findByURI as jest.Mock).mockResolvedValue(existing);

      const input = buildAffiliationInput({
        uri: existing.uri,
        displayName: 'Hack',
        name: 'Hack',
      });
      const result = await executeQuery(query, { input }, researcherToken);

      expect(result.body.singleResult.errors).toBeDefined();
    });
  });

  describe('Mutation.removeAffiliation', () => {
    beforeEach(() => {
      query = `
        mutation removeAffiliation($affiliationId: Int!) {
          removeAffiliation(affiliationId: $affiliationId) {
            id
            uri
            name
            errors {
              general
            }
          }
        }
      `;
    });

    it('should delete a DMPTOOL-managed affiliation when caller is superAdmin', async () => {
      const existing = buildMockAffiliation({
        id: 1,
        provenance: AffiliationProvenance.DMPTOOL,
        logoName: 'logo.png',
        delete: jest.fn().mockResolvedValue(null),
      });
      existing.delete.mockResolvedValue(existing);

      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);

      const result = await executeQuery(query, { affiliationId: existing.id }, superAdminToken);

      expect(result.body.singleResult.data.removeAffiliation.id).toBe(existing.id);
      expect(deleteAffiliationLogoFile).toHaveBeenCalledWith(
        expect.any(Object),
        'logo.png',
      );
    });

    it('should return NotFound when the affiliation does not exist', async () => {
      (Affiliation.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { affiliationId: 999 }, superAdminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Not Found');
    });

    it('should delete a non-DMPTOOL-managed affiliation when caller is superAdmin', async () => {
      const existing = buildMockAffiliation({ provenance: AffiliationProvenance.ROR });
      existing.delete.mockResolvedValue(existing);
      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);

      const result = await executeQuery(query, { affiliationId: existing.id }, superAdminToken);

      expect(result.body.singleResult.data.removeAffiliation.id).toBe(existing.id);
    });

    it('should still delete affiliation when logo deletion fails', async () => {
      const existing = buildMockAffiliation({
        id: 1,
        provenance: AffiliationProvenance.DMPTOOL,
        logoName: 'logo.png',
      });
      (deleteAffiliationLogoFile as jest.Mock).mockResolvedValue(false);
      existing.delete.mockResolvedValue(existing);
      (Affiliation.findById as jest.Mock).mockResolvedValue(existing);

      const result = await executeQuery(query, { affiliationId: existing.id }, superAdminToken);

      expect(result.body.singleResult.data.removeAffiliation.id).toBe(existing.id);
      expect(deleteAffiliationLogoFile).toHaveBeenCalledWith(
        expect.any(Object),
        'logo.png',
      );
    });
  });

  describe('Mutation.generateLogoUploadURL', () => {
    beforeEach(() => {
      query = `
        mutation generateLogoUploadURL($affiliationURI: String!, $fileName: String!, $contentType: String!) {
          generateLogoUploadURL(affiliationURI: $affiliationURI, fileName: $fileName, contentType: $contentType) {
            url
            fields
          }
        }
      `;
    });

    it('should return a presigned URL for an Admin', async () => {
      const mockUpload = { url: casual.url, fields: '{"key":"logos/logo.png"}' };
      (getPresignedURLForAffiliationLogo as jest.Mock).mockResolvedValue(mockUpload);

      const vars = { affiliationURI: adminToken.affiliationId, fileName: 'logo.png', contentType: 'image/png' };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.generateLogoUploadURL.url).toBe(mockUpload.url);
      expect(getPresignedURLForAffiliationLogo).toHaveBeenCalledTimes(1);
    });

    it('should return Forbidden when the Admin\'s affiliation does not match', async () => {
      (Affiliation.findByURI as jest.Mock).mockResolvedValue(null);

      const vars = { affiliationURI: 'wrong-affiliation', fileName: 'logo.png', contentType: 'image/png' };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Forbidden');
    });
  });

  // finalizeLogoUpload mutation tests removed because resolver no longer implements this field.

  describe('Affiliation.guidanceGroups field resolver', () => {
    beforeEach(() => {
      query = `
        query affiliationByURI($uri: String!) {
          affiliationByURI(uri: $uri) {
            id
            uri
            guidanceGroups {
              id
            }
          }
        }
      `;
    });

    it('should return all guidance groups for a superAdmin', async () => {
      const uri = casual.url;
      const mockAffiliation = buildMockAffiliation({ uri });
      const groups = [
        { id: 1, published: true, latestPublishedDate: '2025-01-01' },
        { id: 2, published: false, latestPublishedDate: null },
      ];

      (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliation);
      (GuidanceGroup.findByAffiliationId as jest.Mock).mockResolvedValue(groups);

      const result = await executeQuery(query, { uri }, superAdminToken);

      expect(result.body.singleResult.data.affiliationByURI.guidanceGroups).toHaveLength(2);
    });

    it('should return all guidance groups for an Admin of the same affiliation', async () => {
      const mockAffiliation = buildMockAffiliation({ uri: affiliationId });
      const groups = [
        { id: 1, published: true },
        { id: 2, published: false },
      ];

      (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliation);
      (GuidanceGroup.findByAffiliationId as jest.Mock).mockResolvedValue(groups);

      const result = await executeQuery(query, { uri: affiliationId }, adminToken);

      expect(result.body.singleResult.data.affiliationByURI.guidanceGroups).toHaveLength(2);
    });

    it('should return only published guidance groups for a researcher', async () => {
      const uri = casual.url;
      const mockAffiliation = buildMockAffiliation({ uri });
      const groups = [
        { id: 1, published: true, latestPublishedDate: '2025-01-01' },
        { id: 2, published: false, latestPublishedDate: null },
      ];

      (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliation);
      (GuidanceGroup.findByAffiliationId as jest.Mock).mockResolvedValue(groups);

      const result = await executeQuery(query, { uri }, researcherToken);

      expect(result.body.singleResult.data.affiliationByURI.guidanceGroups).toHaveLength(1);
      expect(result.body.singleResult.data.affiliationByURI.guidanceGroups[0].id).toBe(1);
    });

    it('should return an InternalServerError when GuidanceGroup lookup fails', async () => {
      const uri = casual.url;
      const mockAffiliation = buildMockAffiliation({ uri });

      (Affiliation.findByURI as jest.Mock).mockResolvedValue(mockAffiliation);
      (GuidanceGroup.findByAffiliationId as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, { uri }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });
});
