import { ApolloServer } from "@apollo/server";
import casual from "casual";
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../datasources/cache.js', () => ({
  Cache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../services/openSearchService.js', () => ({
  openSearchFindWorkByIdentifier: jest.fn(),
  openSearchFindRe3Data: jest.fn(),
  openSearchFindRe3DataByURIs: jest.fn(),
  openSearchFindRe3DataSubjects: jest.fn(),
  openSearchFindRe3DataRepositoryTypes: jest.fn(),
}));


import type { MyContext } from "../../context.js";

// Dynamic import AFTER mocking the configs and logger
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const {
  buildContext,
  mockResearcherToken,
  mockAdminToken,
  mockSuperAdminToken,
} = await import("../../__mocks__/context.js");
const { getCurrentDate } = await import("../../utils/helpers.js");
const { License, DEFAULT_DMPTOOL_LICENSE_URL } = await import('../../models/License.js');


let testServer: ApolloServer;
let token: MyContext['token'];
let context: MyContext;

// Proxy call to the Apollo server test server
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeQuery(query: string, variables: any): Promise<any> {
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

beforeEach(async () => {
  jest.resetAllMocks();

  // Initialize the Apollo server
  testServer = new ApolloServer({
    typeDefs, resolvers
  });

  context = buildContext(logger, token, null);

  token = await mockResearcherToken();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('License Resolvers', () => {
  let mockLicenses: InstanceType<typeof License>[];

  beforeEach(() => {
    jest.clearAllMocks();

    mockLicenses = [
      {
        id: casual.integer(1, 99),
        uri: `${DEFAULT_DMPTOOL_LICENSE_URL}/test`,
        name: `Last`,
        description: casual.description,
        recommended: false,
        created: getCurrentDate(),
        modified: getCurrentDate(),
        errors: {},
        addError: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as unknown as InstanceType<typeof License>,
      {
        id: casual.integer(100, 999),
        uri: `${DEFAULT_DMPTOOL_LICENSE_URL}/test-recommended`,
        name: 'First',
        description: casual.description,
        recommended: true,
        created: getCurrentDate(),
        modified: getCurrentDate(),
        errors: {},
        addError: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as unknown as InstanceType<typeof License>,
    ];
  });

  describe('Query', () => {
    describe('licenses', () => {
      const query = `
        query {
          licenses {
            id
            uri
            name
            description
            recommended
            created
            modified
          }
        }`;

      it('should return all licenses successfully', async () => {
        const querySpy = jest.spyOn(License, 'all').mockResolvedValue(mockLicenses);

        const result = await executeQuery(query, undefined);
        expect(querySpy).toHaveBeenCalledWith('licenses resolver', context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.licenses).toBeTruthy();
        expect(result.body.singleResult.data.licenses.length).toEqual(2);
      });

      it('should throw InternalServerError on failure', async () => {
        const error = new Error('Database error');
        // spy and throw an error
        const querySpy = jest.spyOn(License, 'all').mockRejectedValue(error);

        const result = await executeQuery(query, undefined);
        expect(querySpy).toHaveBeenCalledWith('licenses resolver', context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.licenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('recommendedLicenses', () => {
      const query = `
        query RecommendedLicenses($recommended: Boolean!) {
          recommendedLicenses(recommended: $recommended) {
            name
            id
            uri
          }
        }`;

      it('should return all recommended licenses successfully', async () => {
        const querySpy = jest.spyOn(License, 'recommended').mockResolvedValue([mockLicenses[1]]);

        const result = await executeQuery(query, { recommended: true });
        expect(querySpy).toHaveBeenCalledWith('recommendedLicenses resolver', context, true);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.recommendedLicenses).toBeTruthy();
        expect(result.body.singleResult.data.recommendedLicenses.length).toEqual(1);
      });

      it('should throw InternalServerError on failure', async () => {
        const error = new Error('Database error');
        // spy and throw an error
        const querySpy = jest.spyOn(License, 'recommended').mockRejectedValue(error);

        const result = await executeQuery(query, { recommended: true });
        expect(querySpy).toHaveBeenCalledWith('recommendedLicenses resolver', context, true);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.recommendedLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('license', () => {
      const query = `
        query License($uri: String!) {
          license(uri: $uri) {
            name
            id
            uri
          }
        }`;

      it('should return the specified license', async () => {
        const querySpy = jest.spyOn(License, 'findByURI').mockResolvedValue(mockLicenses[1]);

        const uri = mockLicenses[1].uri;
        const result = await executeQuery(query, { uri: uri });
        expect(querySpy).toHaveBeenCalledWith('license resolver', context, uri);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.license).toBeTruthy();
      });

      it('should throw InternalServerError on failure', async () => {
        const error = new Error('Database error');
        // spy and throw an error
        const querySpy = jest.spyOn(License, 'findByURI').mockRejectedValue(error);

        const uri = mockLicenses[1].uri;
        const result = await executeQuery(query, { uri: uri });
        expect(querySpy).toHaveBeenCalledWith('license resolver', context, uri);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.license).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });
  });

  describe('Mutation', () => {
    let querySpy: ReturnType<typeof jest.spyOn>;
    let mockInput;

    describe('addLicense', () => {
      const query = `
        mutation AddLicense($name: String!, $uri: String!, $description: String!, $recommended: Boolean!) {
          addLicense(name: $name, uri: $uri, description: $description, recommended: $recommended) {
            id
            uri
            name
            description
            recommended
            errors {
              uri
              name
            }
          }
        }`;

      beforeEach(() => {
        querySpy = jest.spyOn(License.prototype, 'create').mockResolvedValue(mockLicenses[0]);

        mockInput = {
          uri: mockLicenses[0].uri,
          name: mockLicenses[0].name,
          description: mockLicenses[0].description,
          recommended: mockLicenses[0].recommended
        }
      })

      it('should return a 403 for a Researcher', async () => {
        context.token = await mockResearcherToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.addLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should add a new license for an Admin', async () => {
        context.token = await mockAdminToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);


        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.addLicense).toBeTruthy();
      });

      it('should add a new license for a SuperAdmin', async () => {
        context.token = await mockSuperAdminToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.addLicense).toBeTruthy();
      });

      it('should return a 500 when an error occurs', async () => {
        const error = new Error('Database error');
        // spy and throw an error
        querySpy = jest.spyOn(License.prototype, 'create').mockRejectedValue(error);

        context.token = await mockAdminToken();

        const result = await executeQuery(query, mockInput);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.addLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('updateLicense', () => {
      const query = `
        mutation UpdateLicense($uri: String!, $name: String!, $description: String!, $recommended: Boolean!) {
          updateLicense(uri: $uri, name: $name, description: $description, recommended: $recommended) {
            id
            uri
            name
            description
            recommended
            errors {
              uri
              name
            }
          }
        }`;

      beforeEach(() => {
        querySpy = jest.spyOn(License.prototype, 'update').mockResolvedValue(mockLicenses[0]);

        mockInput = {
          uri: `${DEFAULT_DMPTOOL_LICENSE_URL}test/123`,
          name: mockLicenses[0].name,
          description: mockLicenses[0].description,
          recommended: mockLicenses[0].recommended
        }
      })

      it('should return a 403 for a Researcher', async () => {
        context.token = await mockResearcherToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.updateLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 403 if the License belongs to an external repository', async () => {
        context.token = await mockResearcherToken();

        mockInput.uri = 'someone-elses-license';

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.updateLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 404 if the License doesn\'t exist', async () => {
        context.token = await mockAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(null);

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.updateLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
      });

      it('should update the license for an Admin', async () => {
        context.token = await mockAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(mockInput);

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.updateLicense).toBeTruthy();
      });

      it('should update the license for a SuperAdmin', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(mockInput);

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.updateLicense).toBeTruthy();
      });

      it('should return a 500 when an error occurs', async () => {
        const error = new Error('Database error');
        jest.spyOn(License, 'findByURI').mockResolvedValue(mockInput);

        // spy and throw an error
        querySpy = jest.spyOn(License.prototype, 'update').mockRejectedValue(error);
        context.token = await mockAdminToken();

        const result = await executeQuery(query, mockInput);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.updateLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('removeLicense', () => {
      const query = `
        mutation RemoveLicense($uri: String!) {
          removeLicense(uri: $uri) {
            id
          }
        }`;

      beforeEach(() => {
        querySpy = jest.spyOn(License.prototype, 'delete').mockResolvedValue(mockLicenses[0]);

        mockInput = {
          uri: `${DEFAULT_DMPTOOL_LICENSE_URL}test/123`
        }
      })

      it('should return a 403 for a Researcher', async () => {
        context.token = await mockResearcherToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.removeLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 403 if the License belongs to an external repository', async () => {
        context.token = await mockResearcherToken();

        mockInput.uri = 'someone-elses-license';

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.removeLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 404 if the License doesn\'t exist', async () => {
        context.token = await mockAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(null);

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.removeLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
      });

      it('should remove the license for an Admin', async () => {
        context.token = await mockAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(new License(mockLicenses[0]));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.removeLicense).toBeTruthy();
      });

      it('should remove the license for a SuperAdmin', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findByURI').mockResolvedValue(new License(mockLicenses[0]));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.removeLicense).toBeTruthy();
      });

      it('should return a 500 when an error occurs', async () => {
        const error = new Error('Database error');
        jest.spyOn(License, 'findByURI').mockResolvedValue(mockInput);

        // spy and throw an error
        querySpy = jest.spyOn(License.prototype, 'delete').mockRejectedValue(error);
        context.token = await mockAdminToken();

        const result = await executeQuery(query, mockInput);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.removeLicense).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('mergeLicenses', () => {
      const query = `
        mutation MergeLicenses($licenseToKeepId: Int!, $licenseToRemoveId: Int!) {
          mergeLicenses(licenseToKeepId: $licenseToKeepId, licenseToRemoveId: $licenseToRemoveId) {
            id
          }
        }`;

      let deleteSpy: ReturnType<typeof jest.spyOn>;
      beforeEach(() => {
        querySpy = jest.spyOn(License.prototype, 'update').mockResolvedValue(mockLicenses[1]);
        deleteSpy = jest.spyOn(License.prototype, 'delete').mockResolvedValue(null)

        mockInput = {
          licenseToKeepId: mockLicenses[0].id,
          licenseToRemoveId: mockLicenses[1].id
        }
      })

      it('should return a 403 for a Researcher', async () => {
        context.token = await mockResearcherToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 403 for an Admin', async () => {
        context.token = await mockAdminToken();

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('should return a 403 if the License to be removed belongs to an external repository', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findById')
          .mockResolvedValueOnce(new License(mockLicenses[0]))
          .mockResolvedValueOnce(new License({ uri: 'external-license' }));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();
        expect(deleteSpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
      });

      it('doesn\'t update the license to keep if it belongs to an external repository', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findById')
          .mockResolvedValueOnce(new License({ uri: 'external-license' }))
          .mockResolvedValueOnce(new License(mockLicenses[0]));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined()
        expect(result.body.singleResult.data.mergeLicenses).toBeTruthy();
      });

      it('should return a 404 if the License to remove doesn\'t exist', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findById')
          .mockResolvedValueOnce(new License(mockLicenses[0]))
          .mockResolvedValueOnce(null);

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();
        expect(deleteSpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
      });

      it('should return a 404 if the License to keep doesn\'t exist', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findById')
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(new License(mockLicenses[0]));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).not.toHaveBeenCalled();
        expect(deleteSpy).not.toHaveBeenCalled();

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
      });

      it('should merge the licenses for a SuperAdmin', async () => {
        context.token = await mockSuperAdminToken();
        jest.spyOn(License, 'findById')
          .mockResolvedValue(new License(mockLicenses[0]))
          .mockResolvedValue(new License(mockLicenses[1]));

        const result = await executeQuery(query, mockInput);
        expect(querySpy).toHaveBeenCalledWith(context);
        expect(deleteSpy).toHaveBeenCalledWith(context);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.mergeLicenses).toBeTruthy();
      });

      it('should return a 500 when an error occurs', async () => {
        const error = new Error('Database error');
        // spy and throw an error
        jest.spyOn(License, 'findById').mockRejectedValue(error);
        context.token = await mockSuperAdminToken();

        const result = await executeQuery(query, mockInput);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.data.mergeLicenses).toBeNull();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });
  });
});
