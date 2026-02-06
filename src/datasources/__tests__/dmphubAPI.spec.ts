import { DMPHubAPI, Authorizer } from '../dmphubAPI';
import { RESTDataSource } from '@apollo/datasource-rest';
import { JWTAccessToken } from '../../services/tokenService';
import { buildContext, buildMockContextWithToken } from '../../__mocks__/context';
import { DMPHubConfig } from '../../config/dmpHubConfig';
import casual from 'casual';
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let mockError;

beforeEach(() => {
  jest.clearAllMocks();

  mockError = jest.fn();
  (logger.error as jest.Mock) = mockError;
});

// Mock RESTDataSource methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGet = jest.spyOn(RESTDataSource.prototype as any, 'get');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.spyOn(RESTDataSource.prototype as any, 'post');

describe('Authorizer', () => {
  let authorizer: Authorizer;

  beforeEach(() => {
    mockPost.mockClear();
    Authorizer.releaseInstance();
  });

  it('should create a singleton instance', () => {
    const instance1 = Authorizer.instance;
    const instance2 = Authorizer.instance;
    expect(instance1).toBe(instance2); // Both should be the same instance
  });

  it('should encode credentials and call authenticate method', async () => {
    const mockResponse = { access_token: 'test_token' };
    mockPost.mockResolvedValue(mockResponse);

    authorizer = Authorizer.instance;
    await authorizer.authenticate();

    expect(mockPost).toHaveBeenCalledWith(`/oauth2/token`);
    expect(authorizer.oauth2Token).toBe('test_token');
    expect(logger.info).toHaveBeenCalledWith('Authenticating with DMPHub');
  });

  it('should check token expiration', () => {
    const expiredDate = new Date(Date.now() - 600 * 1000); // Set expired date
    authorizer = Authorizer.instance;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authorizer as any).expiry = expiredDate;
    expect(authorizer.hasExpired()).toBe(true);
  });

  it('should correctly set request headers in willSendRequest', () => {
    authorizer = Authorizer.instance;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request: any = { headers: {}, body: '' };
    authorizer.willSendRequest('/oauth2/token', request);

    const creds = Buffer.from(
      `${DMPHubConfig.dmpHubClientId}:${DMPHubConfig.dmpHubClientSecret}`
    ).toString('base64');

    expect(request.headers['authorization']).toBe(`Basic ${creds}`);
    expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(request.body).toContain('grant_type=client_credentials');
    expect(request.body).toContain('.read');
    expect(request.body).toContain('.write');
  });
});

describe('DMPToolAPI', () => {
  let dmphubAPI: DMPHubAPI;

  beforeEach(() => {
    mockGet.mockClear();

    // Initialize DMPToolAPI
    dmphubAPI = new DMPHubAPI({
      cache: {} as KeyvAdapter,
      token: {} as JWTAccessToken,
    });
  });

  describe('willSendRequest', () => {
    it('should re-authenticate if token has expired and set headers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = { headers: {} };

      // Mock token expiration and authentication
      Authorizer.instance.oauth2Token = 'new_test_token';
      dmphubAPI.willSendRequest('/affiliations', request);
      expect(request.headers['authorization']).toBe('Bearer new_test_token');
    });
  });

  describe('getAwards', () => {
    it('should getAwards', async () => {
      const context = await buildMockContextWithToken(logger);
      const mockItems = [{
        project: {
          title: casual.title,
          description: casual.description,
          start: casual.date('YYYY-M-DD'),
          end: casual.date('YYYY-M-DD'),
          funding: [
            {
              dmproadmap_project_number: "CTF-2023-01-006",
              dmproadmap_award_amount: casual.double(1000, 1000000).toFixed(2),
              grant_id: {
                identifier: "https://doi.org/10.00000/grant-id",
                type: "url"
              }
            }
          ]
        },
        contact: {
          name: `${casual.last_name}, ${casual.first_name}`,
          dmproadmap_affiliation: {
            "name": casual.name,
            "affiliation_id": {
              "identifier": "https://ror.org/000000000",
              "type": "ror"
            }
          },
          contact_id: {
            type: "orcid",
            identifier: "http://orcid.org/0000-0000-0000-0000"
          },
          role: [
            "http://credit.niso.org/contributor-roles/investigation"
          ]
        },
        contributor: [
          {
            name: `${casual.last_name}, ${casual.first_name}`,
            dmproadmap_affiliation: {
              name: casual.name,
              affiliation_id: {
                identifier: "https://ror.org/000000000",
                type: "ror"
              }
            },
            contributor_id: {
              type: "orcid",
              identifier: "http://orcid.org/0000-0000-0000-0000"
            },
            role: [
              "http://credit.niso.org/contributor-roles/investigation"
            ]
          }
        ]
      }];
      const mockResponse = {
        status: 200,
        items: mockItems
      };

      const apiTarget = "awards/crossref/000000000000";
      const awardId = "123";
      const awardName = "Physics";
      const awardYear = "2024";
      const piNames = ["John Doe", "Jane Doe"];
      const expectedPath = "awards/crossref/000000000000?project=123&pi_names=John+Doe%2CJane+Doe&keywords=Physics&years=2024";
      mockGet.mockResolvedValue(mockResponse);
      const result = await dmphubAPI.getAwards(context, apiTarget, awardId, awardName, awardYear, piNames);

      expect(mockGet).toHaveBeenCalledWith(expectedPath);
      expect(result).toEqual(mockItems);
      expect(context.logger.debug).toHaveBeenCalledWith(
        { items: mockItems },
        `dmphubAPI.getAwards results from DMPHub getAwards: ${DMPHubConfig.dmpHubURL}/${expectedPath}`
      );
    });

    it('should throw and error when get fails', async () => {
      const context = buildContext(logger);
      const apiTarget = 'awards/nih';
      const mockError = new Error('API down');
      mockGet.mockImplementation(() => { throw mockError });

      await expect(dmphubAPI.getAwards(context, apiTarget)).rejects.toThrow('API down');
    });
  });
});
