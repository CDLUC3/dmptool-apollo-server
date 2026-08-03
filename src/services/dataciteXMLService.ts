import { ORCID_REGEX } from '../utils/helpers';
export interface DataCitePerson {
  givenName?: string;
  familyName: string;
  orcid?: string;              // bare or full URL — normalized internally
  affiliationName?: string;
  affiliationIdentifier?: DataCiteAffiliationIdentifier;
}

export interface DataCiteContributor extends DataCitePerson {
  contributorType: string;
}

export interface DataCiteFunder {
  name: string;
  identifier?: string;         // ROR URL or Crossref Funder ID
  identifierType?: 'ROR' | 'Crossref Funder ID';
  awardNumber?: string;
  awardTitle?: string;
}

export interface DataCiteAlternateIdentifier {
  identifier: string;
  identifierType: string;      // e.g. "DOI", "URL", "Local"
}

export interface DataCiteDescription {
  text: string;
  type?: string;                 // defaults to "Abstract"
  lang?: string;
}

export interface DataCiteMetadataInput {
  title: string;
  titleLang?: string;
  creators: DataCitePerson[];
  contributors?: DataCiteContributor[];
  publisher: string;
  publisherLang?: string;
  publicationYear: string;
  language?: string;             // e.g. "en"
  resourceTypeGeneral: string;   // e.g. "OutputManagementPlan"
  resourceType?: string;         // free-text specific type, e.g. "Data Management Plan"
  descriptions?: DataCiteDescription[];
  fundingReferences?: DataCiteFunder[];
  alternateIdentifiers?: DataCiteAlternateIdentifier[];
}

export interface DataCiteAffiliationIdentifier {
  id: string;
  scheme: string; // e.g. "ROR"
}

export interface DataCiteSourceAffiliation {
  name: string;
  uri?: string;
  provenance?: string;
}

export interface DataCiteSourceFundingAffiliation extends DataCiteSourceAffiliation {
  fundrefId?: string;
}


// Escapes for embedding inside XML text content or attribute values
function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Normalizes a member role URI for comparison (strips scheme + trailing
// slash, lowercases) since stored URIs may use http or https and may or
// may not have a trailing slash.
function normalizeRoleUri(uri: string): string {
  return uri.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

// Maps a CRediT taxonomy URI to a DataCite contributorType
// controlled-vocabulary value. Keyed against the actual memberRoles table.
// References: https://credit.niso.org/ and https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/
const CREDIT_TO_DATACITE_CONTRIBUTOR_TYPE: Record<string, string> = {
  // Sourced from the reference Lambda implementation
  'credit.niso.org/contributor-roles/data-curation': 'DataCurator',
  'credit.niso.org/contributor-roles/formal-analysis': 'Researcher',
  'credit.niso.org/contributor-roles/software': 'Researcher',
  'credit.niso.org/contributor-roles/validation': 'Researcher',
  'credit.niso.org/contributor-roles/investigation': 'ProjectLeader',
  'credit.niso.org/contributor-roles/methodology': 'DataManager',
  'credit.niso.org/contributor-roles/project-administration': 'ProjectManager',
  'credit.niso.org/contributor-roles/supervision': 'Supervisor',
  'credit.niso.org/contributor-roles/writing-review-editing': 'Editor',

  // Reasoned from DataCite's contributorType definitions 
  'credit.niso.org/contributor-roles/resources': 'Sponsor',
  'credit.niso.org/contributor-roles/funding-acquisition': 'ProjectLeader',
  'credit.niso.org/contributor-roles/conceptualization': 'Researcher',
  'credit.niso.org/contributor-roles/visualization': 'Researcher',
  'credit.niso.org/contributor-roles/writing-original-draft': 'Other',

  // DMPTool's own fallback role, not part of the CRediT taxonomy
  'dmptool.org/contributor_roles/other': 'Other',
};
const DEFAULT_CONTRIBUTOR_TYPE = 'Other';

function creditUriToContributorType(uri?: string): string {
  if (!uri) return DEFAULT_CONTRIBUTOR_TYPE;
  return CREDIT_TO_DATACITE_CONTRIBUTOR_TYPE[normalizeRoleUri(uri)] ?? DEFAULT_CONTRIBUTOR_TYPE;
}

// DataCite's <language> element expects an ISO 639-1-style code (e.g. "en"),
// not a full locale — unlike xml:lang attributes, which accept locale tags
// like "en-US" directly. Plan.languageId is stored as a locale (e.g. "en-US"),
// so this strips it down for use in <language>.
function twoCharLanguage(languageId?: string): string {
  if (!languageId) return 'en';
  return languageId.split('-')[0].toLowerCase() || 'en';
}

// Normalize an ORCID value (which may already be a full URL, on either
// production or sandbox orcid.org, or www./pub. variants) to a bare ID.
// Returns undefined if the value isn't a well-formed ORCID.
function normalizeOrcid(orcid?: string | null): string | undefined {
  if (!orcid) return undefined;
  const match = orcid.trim().match(ORCID_REGEX);
  return match ? match[5] : undefined;
}

// Resolves an Affiliation's identifier + scheme for embedding in
// <affiliation affiliationIdentifier="..." affiliationIdentifierScheme="...">.
// Only ROR-provenance affiliations carry a recognized scheme; anything else
// (e.g. a DMPTool-only or unverified affiliation) is emitted as plain text.
export function resolveAffiliationIdentifier(affiliation?: {
  uri?: string;
  provenance?: string;
} | null): DataCiteAffiliationIdentifier | undefined {
  if (!affiliation?.uri) return undefined;
  if (affiliation.provenance?.toUpperCase() === 'ROR') {
    return { id: affiliation.uri, scheme: 'ROR' };
  }
  return undefined;
}


function buildCreatorXML(c: DataCitePerson): string {
  const displayName = `${escapeXML(c.familyName)}, ${escapeXML(c.givenName ?? '')}`;
  const orcid = normalizeOrcid(c.orcid);
  const nameIdentifier = orcid
    ? `\n      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/${escapeXML(orcid)}</nameIdentifier>`
    : '';
  const affiliation = c.affiliationName
    ? `\n      <affiliation${c.affiliationIdentifier ? ` affiliationIdentifier="${escapeXML(c.affiliationIdentifier.id)}" affiliationIdentifierScheme="${escapeXML(c.affiliationIdentifier.scheme)}"` : ''}>${escapeXML(c.affiliationName)}</affiliation>`
    : '';

  return `
    <creator>
      <creatorName nameType="Personal">${displayName}</creatorName>${c.givenName ? `
      <givenName>${escapeXML(c.givenName)}</givenName>` : ''}
      <familyName>${escapeXML(c.familyName)}</familyName>${nameIdentifier}${affiliation}
    </creator>`;
}

function buildContributorXML(c: DataCiteContributor): string {
  const displayName = `${escapeXML(c.familyName)}, ${escapeXML(c.givenName ?? '')}`;
  const orcid = normalizeOrcid(c.orcid);
  const nameIdentifier = orcid
    ? `\n      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/${escapeXML(orcid)}</nameIdentifier>`
    : '';
  const affiliation = c.affiliationName
    ? `\n      <affiliation${c.affiliationIdentifier ? ` affiliationIdentifier="${escapeXML(c.affiliationIdentifier.id)}" affiliationIdentifierScheme="${escapeXML(c.affiliationIdentifier.scheme)}"` : ''}>${escapeXML(c.affiliationName)}</affiliation>`
    : '';

  return `
    <contributor contributorType="${escapeXML(c.contributorType)}">
      <contributorName nameType="Personal">${displayName}</contributorName>${c.givenName ? `
      <givenName>${escapeXML(c.givenName)}</givenName>` : ''}
      <familyName>${escapeXML(c.familyName)}</familyName>${nameIdentifier}${affiliation}
    </contributor>`;
}

function buildFundingXML(f: DataCiteFunder): string {
  const funderId = f.identifier
    ? `\n      <funderIdentifier funderIdentifierType="${escapeXML(f.identifierType ?? 'ROR')}">${escapeXML(f.identifier)}</funderIdentifier>`
    : '';
  const award = f.awardNumber
    ? `\n      <awardNumber>${escapeXML(f.awardNumber)}</awardNumber>${f.awardTitle ? `\n      <awardTitle>${escapeXML(f.awardTitle)}</awardTitle>` : ''}`
    : '';

  return `
    <fundingReference>
      <funderName>${escapeXML(f.name)}</funderName>${funderId}${award}
    </fundingReference>`;
}

function buildAlternateIdentifierXML(a: DataCiteAlternateIdentifier): string {
  return `
    <alternateIdentifier alternateIdentifierType="${escapeXML(a.identifierType)}">${escapeXML(a.identifier)}</alternateIdentifier>`;
}

// Builds a DataCite Kernel-4 XML record for submission to EZID as the
// value of the "datacite" ANVL element. EZID overwrites <identifier>'s
// content at registration time, but the element must be present.
// Reference for metadata Schema: https://ezid-stg.cdlib.org/doc/apidoc.html#metadata-profiles
export function buildDataCiteXML(m: DataCiteMetadataInput): string {
  const creators = m.creators.map(buildCreatorXML).join('');
  const contributors = (m.contributors ?? []).map(buildContributorXML).join('');

  const descriptions = (m.descriptions ?? []).map(d => `
    <description xml:lang="${escapeXML(d.lang ?? 'en')}" descriptionType="${escapeXML(d.type ?? 'Abstract')}">${escapeXML(d.text)}</description>`).join('');

  const fundingReferences = (m.fundingReferences ?? []).map(buildFundingXML).join('');
  const alternateIdentifiers = (m.alternateIdentifiers ?? []).map(buildAlternateIdentifierXML).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd">
  <identifier identifierType="DOI">(:tba)</identifier>
  <creators>${creators}
  </creators>
  <titles>
    <title xml:lang="${escapeXML(m.titleLang ?? 'en')}">${escapeXML(m.title)}</title>
  </titles>
  <publisher xml:lang="${escapeXML(m.publisherLang ?? 'en')}">${escapeXML(m.publisher)}</publisher>
  <publicationYear>${escapeXML(m.publicationYear)}</publicationYear>${m.language ? `
  <language>${escapeXML(m.language)}</language>` : ''}
  <resourceType resourceTypeGeneral="${escapeXML(m.resourceTypeGeneral)}">${escapeXML(m.resourceType ?? '')}</resourceType>${descriptions ? `
  <descriptions>${descriptions}
  </descriptions>` : ''}${contributors ? `
  <contributors>${contributors}
  </contributors>` : ''}${fundingReferences ? `
  <fundingReferences>${fundingReferences}
  </fundingReferences>` : ''}${alternateIdentifiers ? `
  <alternateIdentifiers>${alternateIdentifiers}
  </alternateIdentifiers>` : ''}
</resource>`;
}

// Maps a Project's members/fundings/alternateIdentifiers into DataCite
// metadata input. The project's primary-contact member becomes the DataCite
// creator; all members become contributors, ...
export function planToDataCiteMetadata(input: {
  title: string;
  abstractText?: string;
  language?: string;
  members: {
    isPrimaryContact?: boolean;
    memberRoles?: { uri: string }[];
    projectMember?: {
      givenName?: string;
      surName?: string;
      orcid?: string;
      affiliation?: { name: string; uri?: string; provenance?: string };
    };
  }[];
  fundings: {
    projectFunding?: {
      affiliation?: { name: string; uri?: string; provenance?: string; fundrefId?: string };
      grantId?: string;
    };
  }[];
  alternateIdentifiers: { alternateIdentifier: string }[];
  publisher: string;
  publicationYear: string;
}): DataCiteMetadataInput {
  const twoCharLang = twoCharLanguage(input.language);

  const toPerson = (pm?: {
    givenName?: string; surName?: string; orcid?: string;
    affiliation?: { name: string; uri?: string; provenance?: string };
  }): DataCitePerson | undefined => {
    if (!pm?.surName) return undefined;
    return {
      givenName: pm.givenName || undefined,
      familyName: pm.surName,
      orcid: pm.orcid || undefined,
      affiliationName: pm.affiliation?.name,
      affiliationIdentifier: resolveAffiliationIdentifier(pm.affiliation),
    };
  };

  // Setting creator as the member who is primary contact
  const creators = input.members
    .filter(m => m.isPrimaryContact)
    .map(m => toPerson(m.projectMember))
    .filter((p): p is DataCitePerson => !!p);

  // Project members are contributors, with their CRediT role mapped to DataCite's contributorType.
  const contributors = input.members
    .map(m => {
      const person = toPerson(m.projectMember);
      if (!person) return undefined;
      const roleUri = m.memberRoles?.[0]?.uri;
      return { ...person, contributorType: creditUriToContributorType(roleUri) };
    })
    .filter((c): c is DataCiteContributor => !!c);

  // Plan funders
  const fundingReferences: DataCiteFunder[] = input.fundings
    .map(f => f.projectFunding)
    .filter((pf): pf is NonNullable<typeof pf> => !!pf?.affiliation?.name)
    .map(pf => {
      if (!pf.affiliation) {
        // Unreachable due to the filter above, but keeps TS happy without `!`
        throw new Error('Unexpected missing affiliation after filter');
      }
      const affiliation = pf.affiliation;
      const identifier = affiliation.fundrefId
        ? { identifier: affiliation.fundrefId, identifierType: 'Crossref Funder ID' as const }
        : affiliation.provenance?.toUpperCase() === 'ROR' && affiliation.uri
          ? { identifier: affiliation.uri, identifierType: 'ROR' as const }
          : {};
      return {
        name: affiliation.name,
        ...identifier,
        awardNumber: pf.grantId || undefined,
      };
    });

  // AlternateIdentifier holds another ID for *this* DMP,
  // so it maps to DataCite's <alternateIdentifiers>, not <relatedIdentifiers>. 
  const alternateIdentifiers: DataCiteAlternateIdentifier[] = input.alternateIdentifiers.map(a => ({
    identifier: a.alternateIdentifier,
    identifierType: /^10\.\d{4,9}\//.test(a.alternateIdentifier) ? 'DOI' : 'Local',
  }));

  // Use the project's real abstract when available; otherwise fall back to
  // a generic placeholder, matching production's behavior for plans with
  // no abstract text.
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const descriptionText = input.abstractText?.trim() || `Updated on ${formattedDate}`;
  const descriptions: DataCiteDescription[] = [{
    text: descriptionText,
    type: 'Abstract',
    lang: twoCharLang,
  }];

  if (creators.length === 0) {
    throw new Error('Project has no member marked as primary contact; cannot determine a DataCite creator');
  }

  return {
    title: input.title,
    creators,
    contributors: contributors.length ? contributors : undefined,
    publisher: input.publisher,
    publicationYear: input.publicationYear,
    language: twoCharLang,
    titleLang: input.language || 'en-US',
    publisherLang: input.language || 'en-US',
    resourceTypeGeneral: 'OutputManagementPlan',
    resourceType: 'Data Management Plan',
    fundingReferences: fundingReferences.length ? fundingReferences : undefined,
    alternateIdentifiers: alternateIdentifiers.length ? alternateIdentifiers : undefined,
    descriptions: descriptions.length ? descriptions : undefined,
  };
}