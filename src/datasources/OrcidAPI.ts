import { AugmentedRequest, RESTDataSource } from "@apollo/datasource-rest";
import { logger, prepareObjectForLogs } from '../logger';
import { MyContext } from "../context";
import { isNullOrUndefined } from "../utils/helpers";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { OrcidConfig } from "../config/orcidConfig";

// Singleton class that retrieves an Auth token from the API
export class Authorizer extends RESTDataSource {
  override baseURL = OrcidConfig.baseAuthUrl;

  public oauth2Token?: string; // Made optional/nullable
  public scope: string;

  private creds: string;
  private expiry?: Date;

  constructor(scope?: string) {
    super();

    this.creds = `client_id=${OrcidConfig.clientId}&client_secret=${OrcidConfig.clientSecret}`;
    this.scope = scope ?? OrcidConfig.readOnlyScope;
  }

  // Call the authenticate method and set this class' expiry timestamp
  async authenticate() {
    logger.info(`Authenticating with ORCID API`);
    const response = await this.post(OrcidConfig.authPath);
    this.oauth2Token = response.access_token;

    const currentDate = new Date();
    // 10 minutes expiry
    this.expiry = new Date(currentDate.getTime() + 600 * 1000);
  }

  // Check if the current token has expired
  hasExpired() {
    if (!this.expiry) return true;
    return new Date() >= this.expiry;
  }

  // Attach all of the necessary HTTP headers and the body prior to calling the token endpoint
  override willSendRequest(_path: string, request: AugmentedRequest) {
    request.headers['content-type'] = 'application/x-www-form-urlencoded';
    request.body = `grant_type=client_credentials&scope=${this.scope}&${this.creds}`;
  }
}

// DataSource that interacts with the ORCID API.
export class OrcidAPI extends RESTDataSource {
  override baseURL = OrcidConfig.baseApiUrl;

  private authorizer: Authorizer;

  constructor(options: { cache: KeyvAdapter, authorizer?: Authorizer }) {
    super(options);

    this.authorizer = options.authorizer ?? new Authorizer();
  }

  // Add the Authorization token to the headers prior to the request
  override async willSendRequest(_path: string, request: AugmentedRequest) {
    // Check the current token's expiry. If it has expired re-authenticate
    if (!this.authorizer.oauth2Token || this.authorizer.hasExpired()) {
      await this.authorizer.authenticate();
    }

    request.headers['authorization'] = `Bearer ${this.authorizer.oauth2Token}`;
    request.headers['accept'] = 'application/orcid+json';
    request.headers['content-type'] = 'application/orcid+json';
  };

  // Fetch a single DMP from the DMPHub API
  async getPerson(
    context: MyContext,
    orcid: string,
    reference = 'OrcidAPI.getPerson'
  ): Promise<OrcidPerson | null> {
    try {
    // Remove leading slash from path if present
    const path = `${OrcidConfig.apiPath}${orcid}`.replace(/^\//, '');

      context.logger.debug(`${reference} calling OrcidAPI: ${this.baseURL}${path}`);
      const response = await this.get(path);
      const jsonResponse = JSON.parse(response);

      const returnedOrcid = jsonResponse['orcid-identifier']?.path;
      const person = jsonResponse?.person;

      if (!isNullOrUndefined(returnedOrcid) && !isNullOrUndefined(person)
          && (returnedOrcid === orcid || returnedOrcid.endsWith(`/${orcid}`))) {
        const name: OrcidSchemaPerson = person?.name;
        const email: OrcidSchemaEmail = person?.emails?.email?.find((e: OrcidSchemaEmail) => {
          return e.primary === true && e.verified === true
        });

        return {
          orcid,
          givenName: name['given-names']?.value,
          surName: name['family-name']?.value,
          email: email?.email,
          employment: await this.getEmployment(context, orcid, reference)
        }
      }

      context.logger.error(
        prepareObjectForLogs({ orcid, response: jsonResponse, errs: response?.errors }),
        'Error retrieving Person from OrcidAPI'
      );
      return null;
    } catch(err) {
      // Handle 404 responses gracefully - person not found in ORCID
      if (err?.extensions?.response?.status === 404) {
        context.logger.debug(`ORCID ${orcid} not found in ORCID API (404)`);
        return null;
      }

      context.logger.error(prepareObjectForLogs({ orcid, err }), 'Error calling OrcidAPI getPerson');
      throw(err);
    }
  }

  // Fetch employment information for a given ORCID iD
  async getEmployment(
    context: MyContext,
    orcid: string,
    reference = 'OrcidAPI.getPerson'
  ): Promise<OrcidEmployment | null> {
    try {
      // Remove leading slash from path if present
      const path = `${OrcidConfig.apiPath}${orcid}/employments`.replace(/^\//, '');

      context.logger.debug(`${reference} calling OrcidAPI: ${this.baseURL}${path}`);
      const response = await this.get(path);
      const jsonResponse = JSON.parse(response);

      const employments = jsonResponse['affiliation-group']?.map(e => e.summaries);
      if (Array.isArray(employments) && employments.length > 0) {
        const current: OrcidSchemaEmployment = employments?.flat()?.find((e: OrcidSchemaEmployment) => {
          const summary = e['employment-summary'];
          return summary?.['display-index'] === "0"
        })?.['employment-summary'];

        if (!isNullOrUndefined(current)) {
          const currentROR = current.organization?.['disambiguated-organization'];

          return {
            name: current?.organization?.name,
            url: current?.url?.value ?? '',
            rorId: isNullOrUndefined(currentROR) ? null : currentROR['disambiguated-organization-identifier']
          }
        }
      }
      return null;
    } catch (err) {
      context.logger.error(prepareObjectForLogs({
        orcid,
        err
      }), 'Error calling OrcidAPI getPerson');
      throw (err);
    }
  }
}


// Types returned by DMPHubAPI awards endpoint
// -----------------------------------------------------------------------------------------------
export interface OrcidPerson {
  orcid: string,
  givenName?: string,
  surName?: string,
  email?: string,
  employment?: OrcidEmployment | null
}

export interface OrcidEmployment {
  name: string,
  url?: string,
  rorId?: string
}

interface OrcidSchemaPerson {
  'created-date': { value: number },
  'last-modified-date': { value: number },
  'given-names'?: { value?: string },
  'family-name'?: { value?: string },
  'credit-name'?: { value?: string },
  source?: { value?: string },
  visibility: string,
  path: string
}

interface OrcidSchemaEmail {
  email: string,
  verified: boolean,
  primary: boolean
}

interface OrcidSchemaEmployment {
  'created-date': { value: number },
  'last-modified-date': { value: number },
  'department-name'?: string,
  'role-title'?: string,
  'start-date'?: { value: number },
  'end-date'?: { value: number },
  organization?: { name: string },
  url?: { value: string },
  'external-ids'?: { value: number }[],
  'display-index': string,
  visibility: string,
  path: string
}
