import nock from "nock";
import { Authorizer } from "../OrcidAPI";
import { logger } from "../../logger";
import { OrcidConfig } from "../../config/orcidConfig";
import { RESTDataSource } from "@apollo/datasource-rest";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { buildContext, buildMockContextWithToken } from "../../__mocks__/context";
import { OrcidAPI } from "../OrcidAPI";

// Mock RESTDataSource methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGet = jest.spyOn(RESTDataSource.prototype as any, 'get');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.spyOn(RESTDataSource.prototype as any, 'post');

beforeEach(() => {
  // Set up nock to intercept the OAuth2 token request
  nock(OrcidConfig.baseAuthUrl)
    .post(OrcidConfig.authPath)
    .reply(200, { access_token: 'test_token' });
});

afterEach(() => {
  // Clean up all mocks after each test
  nock.cleanAll();
});

describe('Authorizer', () => {
  let authorizer: Authorizer;

  beforeEach(() => {
    mockPost.mockClear();
    authorizer = Authorizer.instance;
  });

  it('should create a singleton instance', () => {
    const instance1 = Authorizer.instance;
    const instance2 = Authorizer.instance;
    expect(instance1).toBe(instance2); // Both should be the same instance
  });

  it('should encode credentials and call authenticate method', async () => {
    const mockResponse = { access_token: 'test_token' };
    mockPost.mockResolvedValue(mockResponse);
    await authorizer.authenticate();

    expect(mockPost).toHaveBeenCalledWith(`/oauth/token`);
    expect(authorizer.oauth2Token).toBe('test_token');
    expect(logger.info).toHaveBeenCalledWith('Authenticating with ORCID API');
  });

  it('should check token expiration', () => {
    const expiredDate = new Date(Date.now() - 600 * 1000); // Set expired date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authorizer as any).expiry = expiredDate;
    expect(authorizer.hasExpired()).toBe(true);
  });

  it('should correctly set request headers in willSendRequest', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request: any = { headers: {}, body: '' };

    authorizer.willSendRequest('/oauth2/token', request);

    expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const body = [
      `grant_type=client_credentials`,
      `scope=${OrcidConfig.readOnlyScope}`,
      `client_id=${OrcidConfig.clientId}`,
      `client_secret=${OrcidConfig.clientSecret}`
    ];
    expect(request.body).toContain(body.join('&'));
  });
});

describe('OrcidAPI', () => {
  let orcidAPI: OrcidAPI;

  beforeEach(() => {
    mockGet.mockClear();
    // Initialize DMPToolAPI
    orcidAPI = new OrcidAPI({ cache: {} as KeyvAdapter });
  });

  describe('willSendRequest', () => {
    it('should re-authenticate if token has expired and set headers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = { headers: {} };

      // Mock token expiration and authentication
      jest.spyOn(Authorizer.instance, 'hasExpired').mockReturnValue(true);
      jest.spyOn(Authorizer.instance, 'authenticate').mockResolvedValue(undefined);
      Authorizer.instance.oauth2Token = 'new_test_token';

      await orcidAPI.willSendRequest('/affiliations', request);

      expect(Authorizer.instance.authenticate).toHaveBeenCalled();
      expect(request.headers['authorization']).toBe('Bearer new_test_token');
      expect(request.headers['content-type']).toBe('application/orcid+json');
      expect(request.headers['accept']).toBe('application/orcid+json');
    });
  });

  describe('getPerson', () => {
    it('should call get with the correct orcid', async () => {
      const context = await buildMockContextWithToken(logger);
      const orcid = "0000-0000-0000-0000";
      const mockPersonResponse = JSON.stringify({
        "orcid-identifier": { path: `${OrcidConfig.baseApiUrl}/${orcid}` },
        person: {
          name: {
            "given-names": { value: "Joe" },
            "family-name": { value: "Tester" },
            visibility: "public",
          },
          emails: {
            email: [
              { email: "tester@example.com", verified: true, primary: true },
              { email: "other@example.com", verified: true, primary: false }
            ]
          }
        }
      });
      const mockEmploymentResponse = JSON.stringify({
        "affiliation-group": [{
          "summaries": [{
            "employment-summary": {
              "display-index": "1",
              organization: {
                name: "Old University",
                "disambiguated-organization": "https://ror.org/98765"
              },
              url: {value: "https://old.example.com"},
            }
          }, {
            "employment-summary": {
              "display-index": "0",
              organization: {
                name: "Test University",
                "disambiguated-organization": {
                  "disambiguated-organization-identifier": "https://ror.org/12345"
                }
              },
              url: {value: "https://test.example.com"},
            }
          }]
        }]
      });
      mockGet.mockResolvedValueOnce(mockPersonResponse);
      mockGet.mockResolvedValueOnce(mockEmploymentResponse);
      jest.spyOn(Authorizer.instance, 'hasExpired').mockReturnValue(false);

      const result = await orcidAPI.getPerson(context, orcid, 'Testing');

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenNthCalledWith(1, `v3.0/${orcid}`);
      expect(mockGet).toHaveBeenNthCalledWith(2, `v3.0/${orcid}/employments`);
      expect(result).toEqual({
        givenName: "Joe",
        surName: "Tester",
        email: "tester@example.com",
        orcid: orcid,
        employment: {
          name: "Test University",
          rorId: "https://ror.org/12345",
          url: "https://test.example.com"
        }
      })
    });

    it('should throw and error when get fails', async () => {
      const context = buildContext(logger);
      const orcid = "0000-0000-0000-0000";
      const mockError = new Error('API error');
      //mockGet.mockRejectedValue(mockError);
      mockGet.mockImplementation(() => {
        throw mockError
      });
      jest.spyOn(Authorizer.instance, 'hasExpired').mockReturnValue(false);

      await expect(orcidAPI.getPerson(context, orcid)).rejects.toThrow('API error');
    });
  });
});
