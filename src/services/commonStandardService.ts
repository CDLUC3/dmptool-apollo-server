import {DMPHubConfig} from "../config/dmpHubConfig";
import {generalConfig} from "../config/generalConfig";
import {MyContext} from "../context";
import {
  DMPCommonStandard,
  DMPCommonStandardAffiliation,
  DMPCommonStandardContact,
  DMPCommonStandardContributor,
  DMPCommonStandardFunding,
  DMPCommonStandardNarrative,
  DMPCommonStandardRelatedIdentifier,
  DMPFundingStatus,
  DMPIdentifierType,
  DMPPrivacy,
  DMPRelatedIdentifierDescriptor,
  DMPStatus,
  DMPYesNoUnknown,
} from "../types/DMP";
import {ROR_REGEX} from "../models/Affiliation";
import {MemberRole} from "../models/MemberRole";
import {PlanFunding, ProjectFundingStatus} from "../models/Funding";
import {defaultLanguageId} from "../models/Language";
import {Plan, PlanVisibility} from "../models/Plan"
import {Project} from "../models/Project";
import {RelatedWorkSearchResult} from "../models/RelatedWork";
import {User} from "../models/User";
import {VersionedTemplate} from "../models/VersionedTemplate";
import {
  formatORCID,
  isNullOrUndefined,
  ORCID_REGEX,
  valueIsEmpty
} from "../utils/helpers";
import {ResearchDomain} from "../models/ResearchDomain";
import {Answer} from "../models/Answer";
import {PlanMember} from "../models/Member";
import {ExternalMember} from "../types";

// eslint-disable-next-line no-useless-escape
export const DOI_REGEX = /^(https?:\/\/)?(doi\.org\/)?(doi:)?(10\.\d{4,9}\/[-._;()/:\w]+)$/;

// Represents the the RDA Common Metadata standard version of a plan/DMP. When communicating with external
// systems we need to convert project/plan data into this format. This is the format that the DMPHub
// DynamoDB uses.
//
// Some things of note:
//   - All properties prefixed with `dmproadmap_` or `dmphub_` are not parts of the RDA Common Metadata standard
//     They are used to store information that is either not yet supported by that format or are used to
//      facilitate mapping the information back into Project/Plan data.
//   - There are no booleans, use the DMPYesNoUnknown enum to represent boolean values (except `dmphub_featured`)
//   - There are no dates, use strings in the 'YYYY-MM-DD' or 'YYYY-MM-DD hh:mm:ss:msZ' to represent dates/times
//   - The `dmphub_provenance_id` is used to store the ID of the system that created the DMP
//   - The `registered` date is used to store the date that the DMP ID (DOI) was published/registered
//
// We are currently using schema version 1.1
//     See: https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard/tree/master/examples/JSON/JSON-schema/1.1

export async function planToDMPCommonStandard(
  context: MyContext,
  reference: string,
  plan: Plan
): Promise<DMPCommonStandard | null> {
  // Get all of the Template and Project data needed to build the DMP Common Standard
  const project = await loadProjectAndTemplateInfo(context, reference, plan.projectId, plan.versionedTemplateId);
  if (!project || !project.title) {
    return null;
  }

  // Get all of the members and the primary contact
  const members = plan.id ? await loadMemberInfo(context, reference, plan.id) : [];
  const contact = await buildContact(context, plan, members, reference);
  if (!contact) {
    return null;
  }

  // TODO: update this to get the research outputs once they have been built out
  const datasets = [];
  // If no research outputs were found, create a default one because the Common Standard requires at least 1
  if (!Array.isArray(datasets) || datasets.length === 0) {
    datasets.push({
      type: 'dataset',
      title: 'Project Dataset',
      personal_data: DMPYesNoUnknown.UNKNOWN,
      sensitive_data: DMPYesNoUnknown.UNKNOWN,
      dataset_id: {
        identifier: `${plan.dmpId}/dataset`,
        type: DMPIdentifierType.OTHER,
      },
    });
  }

  // Get all of the fundings and narrative info
  const fundings = plan.id ? await loadFundingInfo(context, reference, plan.id) : [];
  const narrative = plan.id ? await loadNarrativeTemplateInfo(context, reference, plan.id) : [];
  const works = await RelatedWorkSearchResult.search(reference, context, plan.projectId, undefined, undefined, {status: "ACCEPTED"});
  const defaultRole = await MemberRole.defaultRole(context, reference);

  // Build the DMP with all the required properties (and any that we have defaults for)
  const commonStandard: DMPCommonStandard = {
    // The person responsible for answering questions about the DMP
    contact,
    created: convertMySQLDateTimeToRFC3339(plan.created),
    dataset: datasets,

    // Use the plan's DMP ID or the URL to the plan as the identifier if it has not been registered yet
    dmp_id: {
      identifier: plan.dmpId ?? `https://${generalConfig.domain}/dmps/${plan.id}`,
      type: plan.dmpId ? DMPIdentifierType.DOI : DMPIdentifierType.URL,
    },

    dmphub_provenance_id: DMPHubConfig.dmpHubProvenance,
    dmproadmap_featured: plan.featured ? '1' : '0',
    dmproadmap_privacy: plan.visibility === PlanVisibility.PUBLIC ? DMPPrivacy.PUBLIC : DMPPrivacy.PRIVATE,
    dmproadmap_status: DMPStatus[plan.status],

    ethical_issues_exist: DMPYesNoUnknown.UNKNOWN,
    language: plan.languageId?.length > 3 ? convertFiveCharToThreeChar(plan.languageId) : plan.languageId,
    modified: convertMySQLDateTimeToRFC3339(plan.modified),

    // Include the required part of the project
    project: [{
      title: project?.title ?? plan?.title,
    }],

    title: plan?.title ?? project?.title,
  }

  // Only add these properties if they have values we don't want 'undefined' or 'null' in the JSON
  if (plan.registered) commonStandard.registered = convertMySQLDateTimeToRFC3339(plan.registered);
  if (project?.abstractText) commonStandard.project[0].description = project?.abstractText;
  if (project?.startDate) commonStandard.project[0].start = convertMySQLDateTimeToRFC3339(project.startDate);
  if (project?.endDate) commonStandard.project[0].end = convertMySQLDateTimeToRFC3339(project.endDate);
  if (project?.dmptool_research_domain) commonStandard.project[0].dmptool_research_domain = project.dmptool_research_domain;

  // Add the members if there are any
  if (Array.isArray(members) && members.length > 0) {
    commonStandard.contributor = members.map((member) => {
      // Make sure that we always have roles as an array
      const roles = member.roles && member.roles.includes('[') ? JSON.parse(member.roles) : [defaultRole?.uri];
      const contrib = {
        name: [member.givenName, member.surName].filter((n) => n).join(' ').trim(),
        role: roles,
      } as DMPCommonStandardContributor;

      // Only add the rest if they have values
      if (!valueIsEmpty(member.orcid)) {
        contrib.contributor_id = {
          identifier: member.orcid ?? member.email,
          type: determineIdentifierType(member.orcid),
        };
      }

      if (!valueIsEmpty(member.email)) contrib.mbox = member.email;
      if (!valueIsEmpty(member.name)) contrib.dmproadmap_affiliation = { name: member.name };

      if (!valueIsEmpty(member.name) && !valueIsEmpty(member.uri)) {
        contrib.dmproadmap_affiliation.affiliation_id = {
          identifier: member.uri,
          type: determineIdentifierType(member.uri),
        };
      }

      return contrib;
    });
  }

  // Add the funding information if there is any
  if (Array.isArray(fundings) && fundings.length > 0) {
    commonStandard.project[0].funding = fundings.map((funding) => {
      const fundingData = {
        funding_status: planFundingStatusToDMPFundingStatus(funding.status),
      } as DMPCommonStandardFunding;

      if (!valueIsEmpty(funding.name)) fundingData.name = funding.name;
      if (!valueIsEmpty(funding.funderProjectNumber)) fundingData.dmproadmap_project_number = funding.funderProjectNumber;
      if (!valueIsEmpty(funding.funderOpportunityNumber)) fundingData.dmproadmap_opportunity_number = funding.funderOpportunityNumber;
      if (!valueIsEmpty(funding.uri)) {
        fundingData.funder_id = {
          identifier: funding.uri,
          type: determineIdentifierType(funding.uri),
        };
      }
      if (!valueIsEmpty(funding.grantId)) {
        fundingData.grant_id = {
          identifier: funding.grantId,
          type: determineIdentifierType(funding.grantId),
        };
      }

      return fundingData;
    });
  }

  // Add the related works if there are any
  if (works && works.items && Array.isArray(works.items) && works.items.length > 0) {
    commonStandard.dmproadmap_related_identifiers = works.items.map((work) => {
      const doi = `https://doi.org/${work.workVersion.work.doi}`;
      return {
        identifier: doi,
        type: DMPIdentifierType.DOI,
        descriptor: DMPRelatedIdentifierDescriptor.CITES,
        work_type: work.workVersion.workType.toLowerCase(),
        title: work.workVersion.title,
        publication_date: work.workVersion.publicationDate,
        authors: work.workVersion.authors.map(author => ({
          orcid: author.orcid,
          first_initial: author.firstInitial,
          given_name: author.givenName,
          middle_initials: author.middleInitials,
          middle_names: author.middleNames,
          surname: author.surname,
          full: author.full,
        })),
        publication_venue: work.workVersion.publicationVenue,
      } as DMPCommonStandardRelatedIdentifier;
    });
  }

  // Add the narrative elements if they exist
  if (narrative) {
    commonStandard.dmproadmap_narrative = planNarrativeToDMPCommonStandard(narrative);
  }

  return commonStandard;
}

// Converts the narrative from the Plan format to the DMP Common Standard format
const planNarrativeToDMPCommonStandard = (narrative): DMPCommonStandardNarrative => {
  return {
    template_id: narrative?.templateId,
    template_title: narrative?.templateTitle,
    template_version: narrative?.templateVersion,

    sections: Array.isArray(narrative?.sections) ? narrative.sections.map((section) => ({
      section_id: section?.sectionId,
      section_title: section?.sectionTitle,
      section_description: section?.sectionDescription,
      section_order: section?.sectionOrder,

      questions: Array.isArray(section?.questions) ? section.questions.map((question) => ({
        question_id: question?.questionId,
        question_text: question?.questionText,
        question_order: question?.questionOrder,

        answer_id: question?.answerId,
        answer_json: question?.answerJSON,
      })) : [],
    })) : [],
  };
}

// Function to convert a MySQL DB date/time to RFC3339 format
export function convertMySQLDateTimeToRFC3339(dateTime: string | Date): string {
  if (dateTime) {
    if (typeof dateTime !== 'string') return (dateTime as Date).toISOString();

    const newDate = (dateTime as string)?.trim()?.replace(' ', 'T')
    return newDate.includes('T') ? newDate + 'Z' : newDate + 'T00:00:00Z';
  }
  return null;
}

// Contact to Common Standard
const buildContact = async (
  context: MyContext,
  plan: Plan,
  members: LoadMemberResult[],
  reference = 'commonStandardService.buildContact'
): Promise<DMPCommonStandardContact> => {
  // Extract the primary contact from the members
  let contact = members.find((c) => c?.isPrimaryContact);
  // If no primary contact is available, use the plan owner
  const ownerId = plan.createdById ? plan.createdById : context.token?.id;
  contact = !isNullOrUndefined(contact) ? contact : await loadContactFromPlanOwner(context, reference, ownerId);

  // Build the contact entry for the DMP
  const contactEntry: DMPCommonStandardContact = {
    contact_id: {
      identifier: contact?.orcid ?? contact?.email,
      type: determineIdentifierType(contact?.orcid),
    },
    mbox: contact?.email,
    name: [contact?.givenName, contact?.surName].filter((n) => n).join(' ').trim(),
  }
  // Add the affiliation to the Contact if it exists
  if (!valueIsEmpty(contact?.name)) {
    const contactAffiliation: DMPCommonStandardAffiliation = {
      name: contact.name
    };
    // Add the URI if it exists
    if (!valueIsEmpty(contact.uri)) {
      contactAffiliation.affiliation_id = {
        identifier: contact.uri,
        type: determineIdentifierType(contact.uri),
      };
    }
    contactEntry.dmproadmap_affiliation = contactAffiliation;
  }
  return contactEntry;
}

// Helper functions to translate data from one format to another
// -----------------------------------------------------------------------------------------------
// Determine what identifier type to use based on the URI
export function determineIdentifierType(uri: string): DMPIdentifierType {
  if (valueIsEmpty(uri)) {
    return DMPIdentifierType.OTHER;
  }
  if (uri.match(ORCID_REGEX)) {
    return DMPIdentifierType.ORCID;
  } else if (uri.match(DOI_REGEX)) {
    return DMPIdentifierType.DOI;
  } else if (uri.match(ROR_REGEX)) {
    return DMPIdentifierType.ROR;
  } else if (uri.startsWith('http')) {
    return DMPIdentifierType.URL;
  } else {
    return DMPIdentifierType.OTHER;
  }
}

// Helper function to convert a 3 character language code to a 5 character code
export function convertFiveCharToThreeChar(language: string): string {
  switch (language) {
    case 'pt-BR':
      return 'ptb';
    default:
      return 'eng';
  }
}

// Helper function to convert a 5 character language code to a 3 character code
export function convertThreeCharToFiveChar(language: string): string {
  switch (language) {
    case 'ptb':
      return 'pt-BR';
    default:
      return defaultLanguageId;
  }
}

// Helper function to convert a ProjectFundingStatus to a DMPFundingStatus
function planFundingStatusToDMPFundingStatus(status: string): DMPFundingStatus {
  switch (status) {
    case ProjectFundingStatus.DENIED:
      return DMPFundingStatus.REJECTED;
    case ProjectFundingStatus.GRANTED:
      return DMPFundingStatus.GRANTED;
    default:
      return DMPFundingStatus.PLANNED;
  }
}

// Interfaces to describe the type of results we are pulling from the DB
// -----------------------------------------------------------------------------------------------
interface LoadProjectResult {
  title: string;
  abstractText: string;
  startDate: string;
  endDate: string;
  name: string;
  dmptool_research_domain: string;
}

interface LoadFundingResult {
  uri: string;
  name: string;
  status: ProjectFundingStatus;
  grantId: string;
  funderProjectNumber: string;
  funderOpportunityNumber: string;
}

interface LoadMemberResult {
  uri: string;
  name: string;
  email: string;
  givenName: string;
  surName: string;
  orcid: string;
  isPrimaryContact: boolean;
  roles: string;
}

interface LoadNarrativeResult {
  templateId: number;
  templateTitle: string;
  templateVersion: string;
  sections: LoadNarrativeSectionResult[];
}

interface LoadNarrativeSectionResult {
  sectionId: number;
  sectionTitle: string;
  sectionDescription: string;
  sectionOrder: number;
  questions: LoadNarrativeQuestionResult[];
}

interface LoadNarrativeQuestionResult {
  questionId: number;
  questionText: string;
  questionOrder: number;
  answerId: number;
  answerJSON: string;
}

// Functions to fetch all of the data necessary to build the DMP
// -----------------------------------------------------------------------------------------------
// Fetch the project and template info needed to construct the DMP Common Standard
const loadProjectAndTemplateInfo = async (
  context: MyContext,
  reference: string,
  projectId: number,
  versionedTemplateId: number
): Promise<LoadProjectResult> => {
  const project = await Project.findById(reference, context, projectId);
  const template = await VersionedTemplate.findById(reference, context, versionedTemplateId);
  const researchDomain = await ResearchDomain.findById(reference, context, project.researchDomainId);

  return {
    title: project.title,
    abstractText: project.abstractText,
    startDate: project.startDate,
    endDate: project.endDate,
    name: template.name,
    dmptool_research_domain: researchDomain?.uri,
  }
}

// Fetch the funding info needed to construct the DMP Common Standard
export const loadFundingInfo = async (
  context: MyContext,
  reference: string,
  planId: number
): Promise<LoadFundingResult[]> => {
  const sql = 'SELECT a.uri, a.name, prf.status, prf.grantId, prf.funderProjectNumber, prf.funderOpportunityNumber ' +
                    'FROM planFundings pf ' +
                      'LEFT JOIN projectFundings prf ON pf.projectFundingId = prf.id ' +
                        'LEFT JOIN affiliations a ON prf.affiliationId = a.uri WHERE pf.planId = ?';
  let fundings = await PlanFunding.query(context, sql, [planId.toString()], reference);
  fundings = fundings.filter((row) => !isNullOrUndefined(row));
  return Array.isArray(fundings) ? fundings : [];
}

// Fetch the member info needed to construct the DMP Common Standard
export const loadMemberInfo = async (
  context: MyContext,
  reference: string,
  planId: number
): Promise<LoadMemberResult[]> => {
  const sql = 'SELECT a.uri, a.name, pctr.email, pctr.givenName, pctr.surName, pctr.orcid, ' +
                        'pc.isPrimaryContact, GROUP_CONCAT(r.uri) as roles ' +
                      'FROM planMembers pc ' +
                        'LEFT JOIN planMemberRoles pcr ON pc.id = pcr.planMemberId ' +
                          'LEFT JOIN memberRoles r ON pcr.memberRoleId = r.id ' +
                        'LEFT JOIN projectMembers pctr ON pc.projectMemberId = pctr.id ' +
                          'LEFT JOIN affiliations a ON pctr.affiliationId = a.uri ' +
                        'WHERE pc.planId = ? ' +
                        'GROUP BY a.uri, a.name, pctr.email, pctr.givenName, pctr.surName, pctr.orcid, pc.isPrimaryContact;';
  let members = await PlanMember.query(context, sql, [planId.toString()], reference);
  members = members.filter((row) => !isNullOrUndefined(row));
  return Array.isArray(members) ? members : [];
}

// Fetch the plan owner information need to construct the Contact if the primary contact is not available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadContactFromPlanOwner(
  context: MyContext,
  reference: string,
  ownerId: number
): Promise<LoadMemberResult> {
  const sql = 'SELECT u.givenName, u.surName, u.orcid, a.uri, a.name, ' +
                        '(SELECT ue.email FROM userEmails ue WHERE ue.userId = u.id ' +
                          'AND ue.isPrimary = 1 LIMIT 1) as email ' +
                      'FROM users u ' +
                        'LEFT JOIN affiliations a ON u.affiliationId = a.id ' +
                      'WHERE u.id = ?';
  let results = await User.query(context, sql, [ownerId.toString()], reference);
  results = results.filter((row) => !isNullOrUndefined(row));
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

// Fetch the narrative info needed to construct the DMP Common Standard
export const loadNarrativeTemplateInfo = async (
  context: MyContext,
  reference: string,
  planId: number
): Promise<LoadNarrativeResult> => {
  // Fetch the template, sections, questions and answers all at once
  const sql = 'SELECT t.id templateId, t.name templateTitle, t.version templateVersion, ' +
                        's.id sectionId, s.name sectionTitle, s.introduction sectionDescription, s.displayOrder sectionOrder, ' +
                        'q.id questionId, q.questionText questionText, q.displayOrder questionOrder, ' +
                        'a.id answerId, a.json answerJSON ' +
                      'FROM plans p ' +
                        'INNER JOIN versionedTemplates t ON p.versionedTemplateId = t.id ' +
                          'LEFT JOIN versionedSections s ON s.versionedTemplateId = t.id ' +
                            'LEFT JOIN versionedQuestions q ON q.versionedSectionId = s.id ' +
                              'LEFT JOIN answers a ON a.versionedQuestionId = q.id AND p.id = a.planId ' +
                        'WHERE p.id = ? '
                        'ORDER BY s.displayOrder, q.displayOrder;';
  let results = await Answer.query(context, sql, [planId.toString()], reference);
  results = results.filter((row) => !isNullOrUndefined(row));

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  // The template info is the same on every record so just use the first one
  const narrative = {
    templateId: results[0].templateId,
    templateTitle: results[0].templateTitle,
    templateVersion: results[0].templateVersion,
    sections: [],
  };

  // Loop through all of the records and extract the section and question info
  narrative.sections = results.reduce((acc, row) => {
    let section = acc.find((s) => s.sectionId === row.sectionId);
    if (!section) {
      // Its a new section so add it to the list
      acc.push({
        sectionId: row.sectionId,
        sectionTitle: row.sectionTitle,
        sectionDescription: row.sectionDescription,
        sectionOrder: row.sectionOrder,
        questions: [],
      });
      section = acc[acc.length - 1];
    }

    const question = section.questions.find((q) => q.questionId === row.questionId);
    if (!question) {
      // Its a new question and answer so add it to the list
      section.questions.push({
        questionId: row.questionId,
        questionText: row.questionText,
        questionOrder: row.questionOrder,
        answerId: row.answerId,
        answerJSON: row.answerJSON,
      });
    }
    return acc;
  }, []);
  // Sort the questions by display order
  narrative.sections.forEach((section) => {
    section.questions.sort((a, b) => a.questionOrder - b.questionOrder);
  });
  // Sort the sections by display order
  narrative.sections.sort((a, b) => a.sectionOrder - b.sectionOrder);

  return narrative;
}

// Parses a member into a standard format
export function parseMember(
  input: DMPCommonStandardContact | DMPCommonStandardContributor | null,
): ExternalMember | null {
  if (isNullOrUndefined(input)) {
    return null;
  }

  const nameParts = input.name.split(",").map((t) => t.trim());
  const surName = nameParts[0];
  const givenName = nameParts[nameParts.length - 1];
  const email = input.mbox;
  let orcid = null;

  // ORCID ID
  if ("contact_id" in input && input.contact_id.type == "orcid") {
    orcid = formatORCID(input.contact_id.identifier);
  } else if ("contributor_id" in input && input.contributor_id.type == "orcid") {
    orcid = formatORCID(input.contributor_id.identifier);
  }

  // ROR ID
  let rorId = null;
  if (input.dmproadmap_affiliation?.affiliation_id?.type == "ror") {
    rorId = input.dmproadmap_affiliation.affiliation_id.identifier;
  }

  return {
    affiliationId: rorId,
    givenName: givenName,
    surName: surName,
    orcid: orcid,
    email: email,
  };
}
