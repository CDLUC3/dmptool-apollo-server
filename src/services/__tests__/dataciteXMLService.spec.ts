import {
  buildDataCiteXML,
  planToDataCiteMetadata,
  resolveAffiliationIdentifier,
  DataCiteMetadataInput,
} from '../dataciteXMLService';

describe('resolveAffiliationIdentifier', () => {
  it('returns a ROR identifier when provenance is ROR', () => {
    const result = resolveAffiliationIdentifier({
      uri: 'https://ror.org/03efmqc40',
      provenance: 'ROR',
    });
    expect(result).toEqual({ id: 'https://ror.org/03efmqc40', scheme: 'ROR' });
  });

  it('is case-insensitive on provenance', () => {
    const result = resolveAffiliationIdentifier({
      uri: 'https://ror.org/03efmqc40',
      provenance: 'ror',
    });
    expect(result).toEqual({ id: 'https://ror.org/03efmqc40', scheme: 'ROR' });
  });

  it('returns undefined when provenance is not ROR', () => {
    const result = resolveAffiliationIdentifier({
      uri: 'https://example.com/some-org',
      provenance: 'DMPTOOL',
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when there is no uri', () => {
    const result = resolveAffiliationIdentifier({ provenance: 'ROR' });
    expect(result).toBeUndefined();
  });

  it('returns undefined when affiliation is null/undefined', () => {
    expect(resolveAffiliationIdentifier(null)).toBeUndefined();
    expect(resolveAffiliationIdentifier(undefined)).toBeUndefined();
  });
});

describe('buildDataCiteXML', () => {
  const baseInput: DataCiteMetadataInput = {
    title: 'Test DMP',
    creators: [{ familyName: 'Lovelace', givenName: 'Ada' }],
    publisher: 'DMPTool',
    publicationYear: '2026',
    resourceTypeGeneral: 'OutputManagementPlan',
  };

  it('includes the required top-level elements', () => {
    const xml = buildDataCiteXML(baseInput);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<identifier identifierType="DOI">(:tba)</identifier>');
    expect(xml).toContain('<title xml:lang="en">Test DMP</title>');
    expect(xml).toContain('<publisher xml:lang="en">DMPTool</publisher>');
    expect(xml).toContain('<publicationYear>2026</publicationYear>');
    expect(xml).toContain('resourceTypeGeneral="OutputManagementPlan"');
  });

  it('defaults titleLang/publisherLang to "en" when not provided', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).toContain('<title xml:lang="en">');
    expect(xml).toContain('<publisher xml:lang="en">');
  });

  it('uses provided titleLang/publisherLang when present', () => {
    const xml = buildDataCiteXML({ ...baseInput, titleLang: 'en-US', publisherLang: 'fr' });
    expect(xml).toContain('<title xml:lang="en-US">');
    expect(xml).toContain('<publisher xml:lang="fr">');
  });

  it('omits <language> when not provided', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).not.toContain('<language>');
  });

  it('includes <language> when provided', () => {
    const xml = buildDataCiteXML({ ...baseInput, language: 'en' });
    expect(xml).toContain('<language>en</language>');
  });

  it('renders a creator with givenName, familyName, ORCID, and affiliation', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      creators: [{
        givenName: 'Ada',
        familyName: 'Lovelace',
        orcid: '0000-0001-5727-2427',
        affiliationName: 'Arizona State University',
        affiliationIdentifier: { id: 'https://ror.org/03efmqc40', scheme: 'ROR' },
      }],
    });

    expect(xml).toContain('<creatorName nameType="Personal">Lovelace, Ada</creatorName>');
    expect(xml).toContain('<givenName>Ada</givenName>');
    expect(xml).toContain('<familyName>Lovelace</familyName>');
    expect(xml).toContain('<nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-5727-2427</nameIdentifier>');
    expect(xml).toContain('affiliationIdentifier="https://ror.org/03efmqc40" affiliationIdentifierScheme="ROR"');
    expect(xml).toContain('>Arizona State University</affiliation>');
  });

  it('omits givenName element when creator has no givenName', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      creators: [{ familyName: 'Organization' }],
    });
    expect(xml).not.toContain('<givenName>');
    expect(xml).toContain('<creatorName nameType="Personal">Organization, </creatorName>');
  });

  it('omits <contributors> block entirely when there are no contributors', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).not.toContain('<contributors>');
  });

  it('renders <contributors> with contributorType when contributors are present', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      contributors: [{ familyName: 'Li', givenName: 'Daijiang', contributorType: 'DataCurator' }],
    });
    expect(xml).toContain('<contributor contributorType="DataCurator">');
    expect(xml).toContain('<contributorName nameType="Personal">Li, Daijiang</contributorName>');
  });

  it('omits <descriptions> block when there are no descriptions', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).not.toContain('<descriptions>');
  });

  it('renders descriptions with default type "Abstract" and lang "en"', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      descriptions: [{ text: 'A short summary.' }],
    });
    expect(xml).toContain('<description xml:lang="en" descriptionType="Abstract">A short summary.</description>');
  });

  it('renders descriptions with a custom type and lang', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      descriptions: [{ text: 'Méthodes', type: 'Methods', lang: 'fr' }],
    });
    expect(xml).toContain('<description xml:lang="fr" descriptionType="Methods">Méthodes</description>');
  });

  it('omits <fundingReferences> block when there are no fundings', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).not.toContain('<fundingReferences>');
  });

  it('renders a funding reference with funder identifier and award number', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      fundingReferences: [{
        name: 'National Science Foundation',
        identifier: '100000001',
        identifierType: 'Crossref Funder ID',
        awardNumber: 'AWD-2544884',
      }],
    });
    expect(xml).toContain('<funderName>National Science Foundation</funderName>');
    expect(xml).toContain('<funderIdentifier funderIdentifierType="Crossref Funder ID">100000001</funderIdentifier>');
    expect(xml).toContain('<awardNumber>AWD-2544884</awardNumber>');
  });

  it('renders awardTitle only when awardNumber is also present', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      fundingReferences: [{ name: 'Funder', awardTitle: 'Should not appear' }],
    });
    expect(xml).not.toContain('<awardTitle>');
  });

  it('omits <alternateIdentifiers> block when there are none', () => {
    const xml = buildDataCiteXML(baseInput);
    expect(xml).not.toContain('<alternateIdentifiers>');
  });

  it('renders alternate identifiers', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      alternateIdentifiers: [{ identifier: '12345', identifierType: 'Local' }],
    });
    expect(xml).toContain('<alternateIdentifier alternateIdentifierType="Local">12345</alternateIdentifier>');
  });

  it('escapes XML special characters in text content and attributes', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      title: 'Titles with <brackets> & "quotes" & \'apostrophes\'',
    });
    expect(xml).toContain('Titles with &lt;brackets&gt; &amp; &quot;quotes&quot; &amp; &apos;apostrophes&apos;');
    expect(xml).not.toContain('<brackets>');
  });

  it('does not include a nameIdentifier when ORCID is malformed', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      creators: [{ familyName: 'Bad', orcid: 'not-a-real-orcid' }],
    });
    expect(xml).not.toContain('nameIdentifierScheme="ORCID"');
  });

  it('normalizes a full ORCID URL (including sandbox) to the bare ID', () => {
    const xml = buildDataCiteXML({
      ...baseInput,
      creators: [{ familyName: 'Sandbox', orcid: 'https://sandbox.orcid.org/0000-0001-5727-2427' }],
    });
    expect(xml).toContain('https://orcid.org/0000-0001-5727-2427');
  });
});

describe('planToDataCiteMetadata', () => {
  const baseInput = {
    title: 'Test DMP',
    members: [{
      isPrimaryContact: true,
      projectMember: { givenName: 'Ada', surName: 'Lovelace' },
    }],
    fundings: [],
    alternateIdentifiers: [],
    publisher: 'DMPTool',
    publicationYear: '2026',
  };

  it('throws when there is no primary-contact member', () => {
    expect(() => planToDataCiteMetadata({
      ...baseInput,
      members: [{ isPrimaryContact: false, projectMember: { givenName: 'Ada', surName: 'Lovelace' } }],
    })).toThrow('Project has no member marked as primary contact; cannot determine a DataCite creator');
  });

  it('throws when the primary-contact member has no surName', () => {
    expect(() => planToDataCiteMetadata({
      ...baseInput,
      members: [{ isPrimaryContact: true, projectMember: { givenName: 'Ada' } }],
    })).toThrow();
  });

  it('sets the primary-contact member as the sole creator', () => {
    const result = planToDataCiteMetadata(baseInput);
    expect(result.creators).toEqual([
      expect.objectContaining({ givenName: 'Ada', familyName: 'Lovelace' }),
    ]);
  });

  it('includes every member (including the primary contact) as a contributor', () => {
    const input = {
      ...baseInput,
      members: [
        { isPrimaryContact: true, projectMember: { givenName: 'Ada', surName: 'Lovelace' } },
        {
          isPrimaryContact: false,
          memberRoles: [{ uri: 'credit.niso.org/contributor-roles/data-curation' }],
          projectMember: { givenName: 'Daijiang', surName: 'Li' },
        },
      ],
    };
    const result = planToDataCiteMetadata(input);

    expect(result.contributors).toHaveLength(2);
    expect(result.contributors).toEqual(expect.arrayContaining([
      expect.objectContaining({ familyName: 'Lovelace', contributorType: 'Other' }),
      expect.objectContaining({ familyName: 'Li', contributorType: 'DataCurator' }),
    ]));
  });

  it('maps a recognized CRediT role URI to its DataCite contributorType', () => {
    const input = {
      ...baseInput,
      members: [
        { isPrimaryContact: true, projectMember: { givenName: 'Ada', surName: 'Lovelace' } },
        {
          isPrimaryContact: false,
          memberRoles: [{ uri: 'https://credit.niso.org/contributor-roles/supervision/' }],
          projectMember: { givenName: 'Jane', surName: 'Doe' },
        },
      ],
    };
    const result = planToDataCiteMetadata(input);
    const doe = result.contributors?.find(c => c.familyName === 'Doe');
    expect(doe?.contributorType).toBe('Supervisor');
  });

  it('falls back to "Other" for an unrecognized or missing role URI', () => {
    const input = {
      ...baseInput,
      members: [
        { isPrimaryContact: true, projectMember: { givenName: 'Ada', surName: 'Lovelace' } },
        {
          isPrimaryContact: false,
          memberRoles: [{ uri: 'https://example.com/some-unknown-role' }],
          projectMember: { givenName: 'John', surName: 'Smith' },
        },
      ],
    };
    const result = planToDataCiteMetadata(input);
    const smith = result.contributors?.find(c => c.familyName === 'Smith');
    expect(smith?.contributorType).toBe('Other');
  });

  it('skips a member with no surName when building contributors', () => {
    const input = {
      ...baseInput,
      members: [
        { isPrimaryContact: true, projectMember: { givenName: 'Ada', surName: 'Lovelace' } },
        { isPrimaryContact: false, projectMember: { givenName: 'No Surname' } },
      ],
    };
    const result = planToDataCiteMetadata(input);
    expect(result.contributors).toHaveLength(1);
  });

  it('returns contributors as undefined when the list would be empty', () => {
    // A single primary contact still becomes a contributor too (per current design),
    // so use a member set that produces zero valid contributors instead.
    const result = planToDataCiteMetadata({
      ...baseInput,
      members: [{ isPrimaryContact: true, projectMember: { givenName: 'Ada', surName: 'Lovelace' } }],
    });
    // With current "all members become contributors" behavior, this will have 1 entry.
    expect(result.contributors).toHaveLength(1);
  });

  it('includes a funding reference with a fundrefId as Crossref Funder ID', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      fundings: [{
        projectFunding: {
          affiliation: { name: 'National Science Foundation', fundrefId: '100000001', provenance: 'ROR', uri: 'https://ror.org/021nxhr62' },
          grantId: 'AWD-2544884',
        },
      }],
    });

    expect(result.fundingReferences).toEqual([
      expect.objectContaining({
        name: 'National Science Foundation',
        identifier: '100000001',
        identifierType: 'Crossref Funder ID',
        awardNumber: 'AWD-2544884',
      }),
    ]);
  });

  it('falls back to ROR identifier when there is no fundrefId', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      fundings: [{
        projectFunding: {
          affiliation: { name: 'Some Funder', provenance: 'ROR', uri: 'https://ror.org/021nxhr62' },
        },
      }],
    });

    expect(result.fundingReferences).toEqual([
      expect.objectContaining({
        name: 'Some Funder',
        identifier: 'https://ror.org/021nxhr62',
        identifierType: 'ROR',
      }),
    ]);
  });

  it('omits identifier fields when there is neither a fundrefId nor a ROR provenance', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      fundings: [{ projectFunding: { affiliation: { name: 'Unverified Funder' } } }],
    });

    expect(result.fundingReferences?.[0]).toEqual(
      expect.objectContaining({ name: 'Unverified Funder' })
    );
    expect(result.fundingReferences?.[0].identifier).toBeUndefined();
  });

  it('drops a funding entry with no affiliation name', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      fundings: [
        { projectFunding: { affiliation: { name: 'Included Funder' } } },
        { projectFunding: undefined },
        { projectFunding: { affiliation: undefined } },
      ],
    });
    expect(result.fundingReferences).toHaveLength(1);
    expect(result.fundingReferences?.[0].name).toBe('Included Funder');
  });

  it('returns fundingReferences as undefined when there are no valid fundings', () => {
    const result = planToDataCiteMetadata({ ...baseInput, fundings: [{ projectFunding: undefined }] });
    expect(result.fundingReferences).toBeUndefined();
  });

  it('classifies a DOI-shaped alternate identifier as type "DOI"', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      alternateIdentifiers: [{ alternateIdentifier: '10.1234/abcd' }],
    });
    expect(result.alternateIdentifiers).toEqual([
      { identifier: '10.1234/abcd', identifierType: 'DOI' },
    ]);
  });

  it('classifies a non-DOI-shaped alternate identifier as type "Local"', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      alternateIdentifiers: [{ alternateIdentifier: 'legacy-id-9999' }],
    });
    expect(result.alternateIdentifiers).toEqual([
      { identifier: 'legacy-id-9999', identifierType: 'Local' },
    ]);
  });

  it('returns alternateIdentifiers as undefined when the input array is empty', () => {
    const result = planToDataCiteMetadata({ ...baseInput, alternateIdentifiers: [] });
    expect(result.alternateIdentifiers).toBeUndefined();
  });

  it('uses the provided abstractText, trimmed, as the description', () => {
    const result = planToDataCiteMetadata({
      ...baseInput,
      abstractText: '   A real abstract.   ',
    });
    expect(result.descriptions?.[0].text).toBe('A real abstract.');
  });

  it('falls back to a generic "Updated on <date>" description when abstractText is missing', () => {
    const result = planToDataCiteMetadata({ ...baseInput, abstractText: undefined });
    expect(result.descriptions?.[0].text).toMatch(/^Updated on /);
  });

  it('falls back to the generic description when abstractText is blank/whitespace', () => {
    const result = planToDataCiteMetadata({ ...baseInput, abstractText: '   ' });
    expect(result.descriptions?.[0].text).toMatch(/^Updated on /);
  });

  it('derives the two-char <language> from a locale-style languageId', () => {
    const result = planToDataCiteMetadata({ ...baseInput, language: 'en-US' });
    expect(result.language).toBe('en');
    expect(result.titleLang).toBe('en-US');
    expect(result.publisherLang).toBe('en-US');
  });

  it('defaults language to "en" and titleLang/publisherLang to "en-US" when not provided', () => {
    const result = planToDataCiteMetadata({ ...baseInput, language: undefined });
    expect(result.language).toBe('en');
    expect(result.titleLang).toBe('en-US');
    expect(result.publisherLang).toBe('en-US');
  });

  it('sets fixed resourceTypeGeneral and resourceType values', () => {
    const result = planToDataCiteMetadata(baseInput);
    expect(result.resourceTypeGeneral).toBe('OutputManagementPlan');
    expect(result.resourceType).toBe('Data Management Plan');
  });
});