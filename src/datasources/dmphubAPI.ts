import { Buffer } from "buffer";
import {
  AugmentedRequest,
  RESTDataSource
} from "@apollo/datasource-rest";
import { logger, prepareObjectForLogs } from '../logger';
import { DMPHubConfig } from '../config/dmpHubConfig';
import { JWTAccessToken } from '../services/tokenService';
import { MyContext } from "../context";
import { DMPCommonStandardContact, DMPCommonStandardContributor, DMPCommonStandardProject } from "../types/DMP";
import { isNullOrUndefined } from "../utils/helpers";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";

// Singleton class that retrieves an Auth token from the API
export class Authorizer extends RESTDataSource {
  static #instance: Authorizer;

  override baseURL = DMPHubConfig.dmpHubAuthURL;

  public env: string;
  public oauth2Token: string;

  private creds: string;
  private expiry: Date;
  private initialized = false;

  constructor() {
    super();

    this.env = this.baseURL.includes('uc3prd') ? 'prd' : (this.baseURL.includes('uc3stg') ? 'stg' : 'dev');
    // Base64 encode the credentials for the auth request
    const hdr = `${DMPHubConfig.dmpHubClientId}:${DMPHubConfig.dmpHubClientSecret}`;
    this.creds = Buffer.from(hdr, 'binary').toString('base64');
  }

  // Release the instance of the Authorizer singleton
  public static releaseInstance() {
    Authorizer.#instance = undefined;
  }

  // Singleton function to ensure we aren't reauthenticating every time
  public static get instance(): Authorizer {
    if (!Authorizer.#instance) {
      Authorizer.#instance = new Authorizer();
    }

    return Authorizer.#instance;
  }

  // Initialize the Authorizer singleton
  async init() {
    if (!this.initialized) {
      await this.authenticate();
      this.initialized = true;
    }
  }

  // Call the authenticate method and set this class' expiry timestamp
  async authenticate() {
    const response = await this.post(`/oauth2/token`);
    this.oauth2Token = response.access_token;
    logger.info(`Authenticating with DMPHub`);

    const currentDate = new Date();
    this.expiry = new Date(currentDate.getTime() + 600 * 1000);
  }

  // Check if the current token has expired
  hasExpired() {
    return new Date() >= this.expiry;
  }

  // Attach all of the necessary HTTP headers and the body prior to calling the token endpoint
  override willSendRequest(_path: string, request: AugmentedRequest) {
    request.headers['authorization'] =`Basic ${this.creds}`;
    request.headers['content-type'] = 'application/x-www-form-urlencoded';
    request.body =
      `grant_type=client_credentials&scope=` +
      `${this.baseURL}/${this.env}.read` +
      `${this.baseURL}/${this.env}.write`;
  }
}

// DataSource that interacts with the DMPHub API. This file is similar to the DdmphubAPI.ts. It has
// been separated out because these endpoints will eventually be replaced with queries to
// OpenSearch once that has been deployed.
export class DMPHubAPI extends RESTDataSource {
  override baseURL = DMPHubConfig.dmpHubURL;

  private authorizer: Authorizer;

  constructor(options: { cache: KeyvAdapter, token: JWTAccessToken }) {
    super(options);

    this.authorizer = Authorizer.instance;
  }

  // Add the Authorization token to the headers prior to the request
  override willSendRequest(_path: string, request: AugmentedRequest) {
    request.headers['authorization'] = `Bearer ${this.authorizer.oauth2Token}`;
  };

  // Remove the protocol from the DMSP ID and encode it but preserve the `/` characters
  removeProtocol(id) {
    return id.toString().replace(/^(https?:\/\/|https?%3A%2F%2F)/i, '').replace(/%2F/g, '/');
  }

  /**
   * Retrieves award information from the specified funder API.
   *
   * @param context - The Apollo Server Context object passed in to the Resolver on each request.
   * @param apiTarget - The funder API endpoint to query. Valid values include:
   *                    - 'awards/nih' for NIH awards,
   *                    - 'awards/nsf' for NSF awards,
   *                    - 'awards/crossref/{funderDOI}' for Crossref Metadata (requires a funder DOI, e.g. '10.00000/000000000000').
   * @param awardId - (Optional) The award ID (e.g., "P30 GM123456"). If null, it will not be sent to the API.
   * @param awardName - (Optional) The name of the award (e.g., "My Project"). If null, it will not be sent to the API.
   * @param awardYear - (Optional) The year of the award (e.g., "1961"). If null, it will not be sent to the API.
   * @param piNames - (Optional) Names of the principal investigators (e.g. "Carl Sagan"). If null, they will not be included in the API request.
   * @param reference - A reference string used for logging.
   */
  async getAwards(
    context: MyContext,
    apiTarget: string,
    awardId: string | null = null,
    awardName: string | null = null,
    awardYear: string | null = null,
    piNames: string[] | null = null,
    reference = 'dmphubAPI.getAwards'
  ): Promise<DMPHubAward[]> {
    try {
      await this.authorizer.init();

      // Build query parameters
      const params = new URLSearchParams();
      if(!isNullOrUndefined(awardId)) {
        params.set("project", awardId);
      }
      if(!isNullOrUndefined(piNames) && piNames.length) {
        params.set("pi_names", piNames.join(","));
      }
      if(!isNullOrUndefined(awardName) && awardName.length) {
        params.set("keywords", awardName);
      }
      if(!isNullOrUndefined(awardYear)) {
        params.set("years", awardYear);
      }

      // Create path
      let path = apiTarget;
      const queryString = params.toString();
      if(queryString){
        path += `?${queryString}`;
      }

      const fullUrl = `${this.baseURL}/${path}`;
      context.logger.debug(`${reference} calling DMPHub getAwards: ${fullUrl}`);
      const response = await this.get(path);
      if (response?.status === 200 && Array.isArray(response?.items)) {
        context.logger.debug(prepareObjectForLogs({ items: response.items }), `${reference} results from DMPHub getAwards: ${fullUrl}`);
        return response.items as DMPHubAward[];
      }

      context.logger.error(
        prepareObjectForLogs({ code: response?.status, errs: response?.errors }),
        `${reference} Error retrieving Awards from DMPHub API`
      );
      return null;
    } catch(err) {
      context.logger.error(prepareObjectForLogs(err), `${reference} error calling DMPHub API getAwards`);
      throw(err);
    }
  }
}

// Types returned by DMPHubAPI awards endpoint
// -----------------------------------------------------------------------------------------------
export interface DMPHubAward {
  project: DMPCommonStandardProject
  contact: DMPCommonStandardContact
  contributor: [DMPCommonStandardContributor]
}
