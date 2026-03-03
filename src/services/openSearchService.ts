import { MyContext } from '../context';
import { OpenSearchWork, WorkType } from '../types';
import { awsConfig } from '../config/awsConfig';
import { prepareObjectForLogs } from '../logger';
import { createOpenSearchClient, OpenSearchConfig } from "../datasources/openSearch";
import { GraphQLError } from "graphql";


interface OpenSearchWorkRecord {
  doi: string;
  title?: string;
  abstract_text?: string;
  hash: string;
  work_type: string;
  publication_date?: string;
  updated_date?: string;
  publication_venue?: string;
  institutions: { name?: string; ror?: string }[];
  authors: {
    orcid?: string;
    first_initial?: string;
    given_name?: string;
    middle_initials?: string;
    middle_names?: string;
    surname?: string;
    full?: string;
  }[];
  funders: { name?: string; ror?: string }[];
  awards: { award_id?: string }[];
  source: { name: string; url?: string };
}

export function convertWorkToCamelCase(work: OpenSearchWorkRecord): OpenSearchWork {
  return {
    doi: work.doi,
    title: work.title,
    abstractText: work.abstract_text,
    hash: work.hash,
    workType: work.work_type as WorkType,
    publicationDate: work.publication_date,
    updatedDate: work.updated_date,
    publicationVenue: work.publication_venue,
    institutions:
      work.institutions?.map((inst) => ({
        name: inst.name,
        ror: inst.ror,
      })) || [],
    authors:
      work.authors?.map((auth) => ({
        orcid: auth.orcid,
        firstInitial: auth.first_initial,
        givenName: auth.given_name,
        middleInitials: auth.middle_initials,
        middleNames: auth.middle_names,
        surname: auth.surname,
        full: auth.full,
      })) || [],
    funders:
      work.funders?.map((funder) => ({
        name: funder.name,
        ror: funder.ror,
      })) || [],
    awards:
      work.awards?.map((award) => ({
        awardId: award.award_id,
      })) || [],
    source: {
      name: work.source.name,
      url: work.source.url,
    },
  };
}

export const openSearchFindWorkByIdentifier = async (reference: string, context: MyContext, doi: string | null | undefined, maxResults: number): Promise<OpenSearchWork[]> => {
  // If doi is empty, whitespace, null or undefined return no results
  if (!doi?.trim()) {
    return [];
  }

  // Fetch data from OpenSearch
  let response;
  try {
    const client = createOpenSearchClient(awsConfig.opensearch as OpenSearchConfig);
    response = await client.search({
      index: 'works-index',
      body: {
        size: maxResults,
        query: {
          ids: {
            values: [doi],
          },
        },
      },
    });
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Error fetching works with DOI ${doi} from OpenSearch domain in ${reference}`);

    throw new GraphQLError("Service temporarily unavailable", {
      extensions: {
        code: "SERVICE_UNAVAILABLE",
        service: "opensearch",
        details: "We are having trouble connecting to the search service, if the error persists please report the error."
      }
    });
  }

  // Convert response from snake case to camel case
  try {
    // Could be cleaner to use the 'camelcase-keys' package, however, it is only
    // provided as an esm module
    //
    // import camelcaseKeys from 'camelcase-keys';
    // return camelcaseKeys(hit._source, {
    //  deep: true,
    // }) as OpenSearchWork;

    return response.body.hits.hits.map((hit) => {
      return convertWorkToCamelCase(hit._source as OpenSearchWorkRecord);
    });
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch response into OpenSearchWorkRecord in ${reference}`);

    throw new GraphQLError("Unexpected response format from search service.", {
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
        service: "opensearch",
        details: "Unexpected response format from search service."
      }
    });
  }
};
