import mysql, { Connection } from 'mysql2/promise';
import { generalConfig } from '../../config/generalConfig';
import { getParameter } from '../parameterStore';
import { MyContext } from '../../context';
import { buildContext } from '../../__mocks__/context';
import { logger } from '../../logger';
import { Author, Award, ContentMatch, DoiMatch, Funder, Institution, ItemMatch } from '../../types';
import type { ResultSetHeader } from 'mysql2/promise';

interface RelatedWork {
  planId: string | null | undefined;
  dmpDoi: string | null | undefined;
  workDoi: string;
  hash: Buffer;
  sourceType: string;
  score: number;
  status: string;
  scoreMax: number;
  doiMatch: DoiMatch;
  contentMatch: ContentMatch;
  authorMatches: ItemMatch[];
  institutionMatches: ItemMatch[];
  funderMatches: ItemMatch[];
  awardMatches: ItemMatch[];
}

interface WorkVersion {
  doi: string;
  hash: Buffer;
  workType: string;
  publicationDate: string | null;
  title: string | null;
  abstractText: string | null;
  authors: Author[];
  institutions: Institution[];
  funders: Funder[];
  awards: Award[];
  publicationVenue: string | null;
  sourceName: string;
  sourceUrl: string;
}

interface Plan {
  versionedTemplateId: number;
  visibility: string;
  status: string;
  dmpId: string;
  languageId: string;
  featured: number;
  createdById: number;
  modifiedById: number;
}

interface Project {
  title: string;
  isTestProject: boolean;
  createdById: number;
  modifiedById: number;
}

export async function insertProjectAndPlan(connection: Connection, project: Project, plan: Plan) {
  await connection.beginTransaction();

  try {
    const [projectResult] = await connection.execute<ResultSetHeader>(
      `
    INSERT INTO projects (title, isTestProject, createdById, modifiedById)
    VALUES (?, ?, ?, ?)
    `,
      [project.title, project.isTestProject, project.createdById, project.modifiedById],
    );

    const projectId = projectResult.insertId;

    await connection.query(
      `
    INSERT INTO plans (
      projectId, versionedTemplateId, visibility, status, dmpId, languageId, featured, createdById, modifiedById
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        projectId,
        plan.versionedTemplateId,
        plan.visibility,
        plan.status,
        plan.dmpId,
        plan.languageId,
        plan.featured,
        plan.createdById,
        plan.modifiedById,
      ],
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

export async function insertRelatedWorks(connection: Connection, data: RelatedWork[]) {
  if (data.length === 0) {
    return;
  }
  const sql =
    'INSERT INTO stagingRelatedWorks (planId, dmpDoi, workDoi, hash, sourceType, score, status, scoreMax, doiMatch, contentMatch, authorMatches, institutionMatches, funderMatches, awardMatches) VALUES ?';
  const values = data.map((item) => [
    item.planId,
    item.dmpDoi,
    item.workDoi,
    item.hash,
    item.sourceType,
    item.score,
    item.status,
    item.scoreMax,
    JSON.stringify(item.doiMatch),
    JSON.stringify(item.contentMatch),
    JSON.stringify(item.authorMatches),
    JSON.stringify(item.institutionMatches),
    JSON.stringify(item.funderMatches),
    JSON.stringify(item.awardMatches),
  ]);

  await connection.query(sql, [values]);
}

export async function insertWorkVersions(connection: Connection, data: WorkVersion[]) {
  if (data.length === 0) {
    return;
  }
  const sql =
    'INSERT INTO stagingWorkVersions (doi, hash, workType, publicationDate, title, abstractText, authors, institutions, funders, awards, publicationVenue, sourceName, sourceUrl) VALUES ?';
  const values = data.map((item) => [
    item.doi,
    item.hash,
    item.workType,
    item.publicationDate,
    item.title,
    item.abstractText,
    JSON.stringify(item.authors),
    JSON.stringify(item.institutions),
    JSON.stringify(item.funders),
    JSON.stringify(item.awards),
    item.publicationVenue,
    item.sourceName,
    item.sourceUrl,
  ]);

  await connection.query(sql, [values]);
}

let connection: mysql.Connection | null = null;
let context: MyContext;

// Function to attempt to connect to the database in certain situations
async function tryGetConnection(context: MyContext) {
  try {
    let connection: Connection;

    // If we are running locally (test) or in the AWS development env (dev)
    if (['dev', 'test'].includes(generalConfig.env)) {
      if (generalConfig.env === 'test') {
        // Running locally so use the Docker compose MySQL instance
        connection = await mysql.createConnection({
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'd0ckerSecr3t',
          database: 'dmptool',
          multipleStatements: true,
        });
      } else {
        // Running in the AWS development environment so use the RDS instance
        connection = await mysql.createConnection({
          host: await getParameter(context, '/uc3/dmp/tool/dev/RdsHost'),
          port: Number(await getParameter(context, '/uc3/dmp/tool/dev/RdsPort')),
          user: await getParameter(context, '/uc3/dmp/tool/dev/RdsUsername'),
          password: await getParameter(context, '/uc3/dmp/tool/dev/RdsPassword'),
          database: await getParameter(context, '/uc3/dmp/tool/dev/RdsName'),
          multipleStatements: true,
        });
      }
      return connection;
    } else {
      // We are running in a different environment so skip the tests!
      return null;
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.warn('MySQL is not running, skipping tests.');
      return null;
    }
    throw err; // unexpected error, let it bubble
  }
}

const testPlanDOIs = ['https://doi.org/10.11111/2A3B4C'];
const testWorkDOIs = ['10.1234/fake-doi-001', '10.5678/sample.abc.2025'];

function clearTestRecords() {
  if (connection) {
    const placeholders = testWorkDOIs.map(() => '?').join(', ');
    connection.query(
      `
      DELETE FROM relatedWorks
        WHERE workVersionId IN (
          SELECT workVersions.id
          FROM workVersions
              INNER JOIN works ON workVersions.workId = works.id
          WHERE works.doi IN (${placeholders})
      );
    `,
      testWorkDOIs,
    );

    connection.query(
      `
      DELETE FROM workVersions
        WHERE workId IN (SELECT id FROM works WHERE doi IN (${placeholders}))
    `,
      testWorkDOIs,
    );

    connection.query(
      `
      DELETE FROM works
        WHERE doi IN (${placeholders})
    `,
      testWorkDOIs,
    );

    connection.query(
      `
      DELETE FROM plans
        WHERE dmpId = '${testPlanDOIs[0]}'
    `,
      testWorkDOIs,
    );

    connection.query(
      `
      DELETE FROM projects
        WHERE title = '${testPlanDOIs[0]}'
    `,
      testWorkDOIs,
    );
  }
}

beforeAll(async () => {
  context = buildContext(logger);
  connection = await tryGetConnection(context);
  clearTestRecords();
});

afterAll(async () => {
  clearTestRecords();
  if (connection) await connection.end();
});

describe('Related Works Tables', () => {
  // Tests that the related works tables stored procedures insert, update and
  // delete records correctly.
  test('1. should insert works', async () => {
    // Inserts new related works, work versions and works and checks that
    // they have been inserted correctly
    if (!connection) {
      console.warn('Skipping test: MySQL not available');
      return;
    }

    await insertProjectAndPlan(
      connection,
      {
        title: testPlanDOIs[0],
        isTestProject: true,
        createdById: 1,
        modifiedById: 1,
      },
      {
        versionedTemplateId: 1,
        visibility: 'PRIVATE',
        status: 'DRAFT',
        dmpId: testPlanDOIs[0],
        languageId: 'en-US',
        featured: 0,
        createdById: 1,
        modifiedById: 1,
      },
    );

    const workVersionsData = [
      {
        doi: testWorkDOIs[0],
        hash: Buffer.from('c4ca4238a0b923820dcc509a6f75849b', 'hex'),
        workType: 'DATASET',
        publicationDate: '2025-01-01',
        title: 'Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)',
        abstractText: 'An abstract',
        authors: [
          {
            orcid: '0000-0003-1234-5678',
            firstInitial: 'A',
            givenName: 'Alyssa',
            middleInitials: 'M',
            middleNames: 'Marie',
            surname: 'Langston',
            full: null,
          },
        ],
        institutions: [
          {
            name: 'University of California, Berkeley',
            ror: '01an7q238',
          },
        ],
        funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
        awards: [{ awardId: 'ABC' }],
        publicationVenue: 'Zenodo',
        sourceName: 'DataCite',
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
      {
        doi: testWorkDOIs[1],
        hash: Buffer.from('c81e728d9d4c2f636f067f89cc14862c', 'hex'),
        workType: 'ARTICLE',
        publicationDate: '2025-02-01',
        title: 'Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study',
        abstractText: 'An abstract',
        authors: [
          {
            orcid: '0000-0003-1234-5678',
            firstInitial: 'A',
            givenName: 'Alyssa',
            middleInitials: 'M',
            middleNames: 'Marie',
            surname: 'Langston',
            full: null,
          },
          {
            orcid: null,
            firstInitial: 'D',
            givenName: 'David',
            middleInitials: null,
            middleNames: null,
            surname: 'Choi',
            full: null,
          },
        ],
        institutions: [
          {
            name: 'University of California, Berkeley',
            ror: '01an7q238',
          },
        ],
        funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
        awards: [{ awardId: 'ABC' }],
        publicationVenue: 'Nature',
        sourceName: 'OpenAlex',
        sourceUrl: 'https://openalex.org/works/W0000000001',
      },
    ];
    const relatedWorksData = [
      {
        planId: null,
        dmpDoi: '10.11111/2A3B4C',
        workDoi: testWorkDOIs[0],
        hash: Buffer.from('c4ca4238a0b923820dcc509a6f75849b', 'hex'),
        sourceType: 'SYSTEM_MATCHED',
        score: 1.0,
        status: 'PENDING',
        scoreMax: 1.0,
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: 'ABC',
              awardUrl: 'https://url-of-funder/award-page',
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: 'Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)',
          abstractHighlights: ['An <mark>abstract</mark>'],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['full', 'ror'],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['name', 'ror'],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ['name'],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
      {
        planId: null,
        dmpDoi: '10.11111/2A3B4C',
        workDoi: testWorkDOIs[1],
        hash: Buffer.from('c81e728d9d4c2f636f067f89cc14862c', 'hex'),
        sourceType: 'SYSTEM_MATCHED',
        score: 0.8,
        status: 'PENDING',
        scoreMax: 1.0,
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: 'ABC',
              awardUrl: 'https://url-of-funder/award-page',
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: 'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
          abstractHighlights: ['An <mark>abstract</mark>'],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['full', 'ror'],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['name', 'ror'],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ['name'],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
    ];
    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, workVersionsData);
    await insertRelatedWorks(connection, relatedWorksData);
    const systemMatched = true;
    await connection.query("CALL batch_update_related_works(?)", [systemMatched]);

    // Check relatedWorks table
    const [relatedWorksRows] = await connection.execute('SELECT * FROM relatedWorks');
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: 'SYSTEM_MATCHED',
        score: 1,
        scoreMax: 1.0,
        status: 'PENDING',
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: 'ABC',
              awardUrl: 'https://url-of-funder/award-page',
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: 'Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)',
          abstractHighlights: ['An <mark>abstract</mark>'],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['full', 'ror'],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['name', 'ror'],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ['name'],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: 'SYSTEM_MATCHED',
        score: expect.closeTo(0.8, 5),
        scoreMax: 1.0,
        status: 'PENDING',
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: 'ABC',
              awardUrl: 'https://url-of-funder/award-page',
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: 'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
          abstractHighlights: ['An <mark>abstract</mark>'],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['full', 'ror'],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ['name', 'ror'],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ['name'],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
    ]);

    // Check workVersions table
    const [workVersionsRows] = await connection.execute('SELECT * FROM workVersions');
    expect(workVersionsRows).toHaveLength(2);
    expect(workVersionsRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from('c4ca4238a0b923820dcc509a6f75849b', 'hex'),
        workType: 'DATASET',
        publicationDate: expect.any(Date),
        title: 'Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)',
        abstractText: 'An abstract',
        authors: [
          {
            orcid: '0000-0003-1234-5678',
            firstInitial: 'A',
            givenName: 'Alyssa',
            middleInitials: 'M',
            middleNames: 'Marie',
            surname: 'Langston',
            full: null,
          },
        ],
        institutions: [
          {
            name: 'University of California, Berkeley',
            ror: '01an7q238',
          },
        ],
        funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
        awards: [{ awardId: 'ABC' }],
        publicationVenue: 'Zenodo',
        sourceName: 'DataCite',
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from('c81e728d9d4c2f636f067f89cc14862c', 'hex'),
        workType: 'ARTICLE',
        publicationDate: expect.any(Date),
        title: 'Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study',
        abstractText: 'An abstract',
        authors: [
          {
            orcid: '0000-0003-1234-5678',
            firstInitial: 'A',
            givenName: 'Alyssa',
            middleInitials: 'M',
            middleNames: 'Marie',
            surname: 'Langston',
            full: null,
          },
          {
            orcid: null,
            firstInitial: 'D',
            givenName: 'David',
            middleInitials: null,
            middleNames: null,
            surname: 'Choi',
            full: null,
          },
        ],
        institutions: [
          {
            name: 'University of California, Berkeley',
            ror: '01an7q238',
          },
        ],
        funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
        awards: [{ awardId: 'ABC' }],
        publicationVenue: 'Nature',
        sourceName: 'OpenAlex',
        sourceUrl: 'https://openalex.org/works/W0000000001',
      },
    ]);

    // Assert works table
    const [worksRows] = await connection.execute('SELECT * FROM works');
    expect(worksRows).toHaveLength(2);
    expect(worksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[0],
        created: expect.any(Date),
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[1],
        created: expect.any(Date),
      },
    ]);
  });

  test("2. should update works", async () => {
    // Updates the second related work and links an updated work version to this
    // related work, then checks that the data has been updated correctly.
    if (!connection) {
      console.warn("Skipping test: MySQL not available");
      return;
    }

    const workVersionsData = [
      {
        doi: testWorkDOIs[0],
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        workType: "DATASET",
        publicationDate: "2025-01-01",
        title: "Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)",
        abstractText: "An abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California, Berkeley",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }],
        publicationVenue: "Zenodo",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
      {
        doi: testWorkDOIs[1],
        hash: Buffer.from("eccbc87e4b5ce2fe28308fd9f2a7baf3", "hex"), // Hash changed
        workType: "DATASET", // Type changed
        publicationDate: "2025-02-02", // Date changed
        title: "Title: Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study", // Title changed
        abstractText: "An abstract abstract", // Abstract changed
        authors: [
          // Authors changed
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
          {
            orcid: null,
            firstInitial: "D",
            givenName: "Daniel",
            middleInitials: null,
            middleNames: null,
            surname: "Choi",
            full: null,
          },
        ],
        institutions: [
          // Institutions changed
          {
            name: "University of California",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation, USA", ror: "021nxhr62" }], // Funders changed
        awards: [{ awardId: "ABC" }, { awardId: "123" }], // Award IDs changed
        publicationVenue: "Nature Publications", // Publication venue changed
        sourceName: "DataCite", // Source Changed
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[1]}`, // Source URL changed
      },
    ];
    const relatedWorksData = [
      {
        planId: null,
        dmpDoi: "10.11111/2A3B4C",
        workDoi: testWorkDOIs[0],
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        sourceType: "SYSTEM_MATCHED",
        score: 1.0,
        status: "PENDING",
        scoreMax: 1.0,
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: "Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
      {
        planId: null,
        dmpDoi: "10.11111/2A3B4C",
        workDoi: testWorkDOIs[1],
        hash: Buffer.from("eccbc87e4b5ce2fe28308fd9f2a7baf3", "hex"), // Hash changed
        sourceType: "SYSTEM_MATCHED",
        score: 0.9, // Score changed
        status: "PENDING",
        scoreMax: 1.0,
        doiMatch: {
          // doiMatch changed
          found: true,
          score: 2.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          // contentMatch changed
          score: 20.0,
          titleHighlight: "Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          // authorMatches changed
          {
            index: 1,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          // institutionMatches changed
          {
            index: 1,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          // funderMatches changed
          {
            index: 1,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          // awardMatches changed
          {
            index: 1,
            score: 10.0,
          },
        ],
      },
    ];
    await connection.query("CALL create_related_works_staging_tables");
    await insertWorkVersions(connection, workVersionsData);
    await insertRelatedWorks(connection, relatedWorksData);
    const systemMatched = true;
    await connection.query("CALL batch_update_related_works(?)", [systemMatched]);

    // Check relatedWorks table
    const [relatedWorksRows] = await connection.execute("SELECT * FROM relatedWorks");
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: "SYSTEM_MATCHED",
        score: 1,
        scoreMax: 1.0,
        status: "PENDING",
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: "Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: "SYSTEM_MATCHED",
        score: expect.closeTo(0.9, 5),
        scoreMax: 1.0,
        status: "PENDING",
        doiMatch: {
          found: true,
          score: 2.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 20.0,
          titleHighlight: "Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 1,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 1,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 1,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 1,
            score: 10.0,
          },
        ],
      },
    ]);

    // Check workVersions table
    const [workVersionsRows] = await connection.execute("SELECT * FROM workVersions");
    expect(workVersionsRows).toHaveLength(2);
    expect(workVersionsRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        workType: "DATASET",
        publicationDate: expect.any(Date),
        title: "Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)",
        abstractText: "An abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California, Berkeley",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }],
        publicationVenue: "Zenodo",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from("eccbc87e4b5ce2fe28308fd9f2a7baf3", "hex"),
        workType: "DATASET",
        publicationDate: expect.any(Date),
        title: "Title: Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study",
        abstractText: "An abstract abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
          {
            orcid: null,
            firstInitial: "D",
            givenName: "Daniel",
            middleInitials: null,
            middleNames: null,
            surname: "Choi",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation, USA", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }, { awardId: "123" }],
        publicationVenue: "Nature Publications",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[1]}`,
      },
    ]);

    // Assert works table
    const [worksRows] = await connection.execute("SELECT * FROM works");
    expect(worksRows).toHaveLength(2);
    expect(worksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[0],
        created: expect.any(Date),
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[1],
        created: expect.any(Date),
      },
    ]);
  });

  test("3. should keep accepted and rejected works", async () => {
    // Updates the status of the two related works to accepted and rejected
    // and then runs procedures with empty data, which tests that accepted and
    // rejected related works, work version and works are not deleted.
    if (!connection) {
      console.warn("Skipping test: MySQL not available");
      return;
    }

    // Accept work
    await connection.query(`
      UPDATE relatedWorks
      SET status = 'ACCEPTED'
      WHERE workVersionId = (
        SELECT workVersions.id
        FROM workVersions
          INNER JOIN works ON works.id = workVersions.workId
        WHERE works.doi = '${testWorkDOIs[0]}'
      );
    `);

    // Reject work
    await connection.query(`
      UPDATE relatedWorks
      SET status = 'REJECTED'
      WHERE workVersionId = (
        SELECT workVersions.id
        FROM workVersions
          INNER JOIN works ON works.id = workVersions.workId
        WHERE works.doi = '${testWorkDOIs[1]}'
      );
    `);

    // Load empty data, which would delete any unlinked pending results
    // but should keep accepted and rejected works
    await connection.query("CALL create_related_works_staging_tables");
    await insertWorkVersions(connection, []);
    await insertRelatedWorks(connection, []);
    const systemMatched = true;
    await connection.query("CALL batch_update_related_works(?)", [systemMatched]);

    // Check relatedWorks table
    const [relatedWorksRows] = await connection.execute("SELECT * FROM relatedWorks");
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: "SYSTEM_MATCHED",
        score: 1,
        scoreMax: 1.0,
        status: "ACCEPTED",
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: "Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: "SYSTEM_MATCHED",
        score: expect.closeTo(0.9, 5),
        scoreMax: 1.0,
        status: "REJECTED",
        doiMatch: {
          found: true,
          score: 2.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 20.0,
          titleHighlight: "Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 1,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 1,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 1,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 1,
            score: 10.0,
          },
        ],
      },
    ]);

    // Check workVersions table
    const [workVersionsRows] = await connection.execute("SELECT * FROM workVersions");
    expect(workVersionsRows).toHaveLength(2);
    expect(workVersionsRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        workType: "DATASET",
        publicationDate: expect.any(Date),
        title: "Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)",
        abstractText: "An abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California, Berkeley",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }],
        publicationVenue: "Zenodo",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from("eccbc87e4b5ce2fe28308fd9f2a7baf3", "hex"),
        workType: "DATASET",
        publicationDate: expect.any(Date),
        title: "Title: Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study",
        abstractText: "An abstract abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
          {
            orcid: null,
            firstInitial: "D",
            givenName: "Daniel",
            middleInitials: null,
            middleNames: null,
            surname: "Choi",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation, USA", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }, { awardId: "123" }],
        publicationVenue: "Nature Publications",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[1]}`,
      },
    ]);

    // Assert works table
    const [worksRows] = await connection.execute("SELECT * FROM works");
    expect(worksRows).toHaveLength(2);
    expect(worksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[0],
        created: expect.any(Date),
      },
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[1],
        created: expect.any(Date),
      },
    ]);
  });

  test("4. should delete unlinked pending related works", async () => {
    // Checks that unlinked pending related works and their work versions and works
    // are deleted. Sets all works to pending, then makes an update where only
    // one related work is in staging table, all other pending related works, work
    // versions and works should be deleted.
    if (!connection) {
      console.warn("Skipping test: MySQL not available");
      return;
    }

    // Set work to pending
    await connection.query(
      `UPDATE relatedWorks
       SET status = 'PENDING'`,
    );

    // Only keep one work
    const workVersionsData = [
      {
        doi: testWorkDOIs[0],
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        workType: "DATASET",
        publicationDate: "2025-01-01",
        title: "Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)",
        abstractText: "An abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California, Berkeley",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }],
        publicationVenue: "Zenodo",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
    ];
    const relatedWorksData = [
      {
        planId: null,
        dmpDoi: "10.11111/2A3B4C",
        workDoi: testWorkDOIs[0],
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        sourceType: "SYSTEM_MATCHED",
        score: 1.0,
        status: "PENDING",
        scoreMax: 1.0,
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: "Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
    ];
    await connection.query("CALL create_related_works_staging_tables");
    await insertWorkVersions(connection, workVersionsData);
    await insertRelatedWorks(connection, relatedWorksData);
    const systemMatched = true;
    await connection.query("CALL batch_update_related_works(?)", [systemMatched]);

    // Check relatedWorks table
    const [relatedWorksRows] = await connection.execute("SELECT * FROM relatedWorks");
    expect(relatedWorksRows).toHaveLength(1);
    expect(relatedWorksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        planId: expect.any(Number), // 👈 auto-increment id
        workVersionId: expect.any(Number), // 👈 auto-increment id
        sourceType: "SYSTEM_MATCHED",
        score: 1,
        scoreMax: 1.0,
        status: "PENDING",
        doiMatch: {
          found: true,
          score: 1.0,
          sources: [
            {
              awardId: "ABC",
              awardUrl: "https://url-of-funder/award-page",
            },
          ],
        },
        contentMatch: {
          score: 18.0,
          titleHighlight: "Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)",
          abstractHighlights: ["An <mark>abstract</mark>"],
        },
        authorMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["full", "ror"],
          },
        ],
        institutionMatches: [
          {
            index: 0,
            score: 2.0,
            fields: ["name", "ror"],
          },
        ],
        funderMatches: [
          {
            index: 0,
            score: 1.0,
            fields: ["name"],
          },
        ],
        awardMatches: [
          {
            index: 0,
            score: 10.0,
          },
        ],
      },
    ]);

    // Check workVersions table
    const [workVersionsRows] = await connection.execute("SELECT * FROM workVersions");
    expect(workVersionsRows).toHaveLength(1);
    expect(workVersionsRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        workId: expect.any(Number), // 👈 auto-increment id
        hash: Buffer.from("c4ca4238a0b923820dcc509a6f75849b", "hex"),
        workType: "DATASET",
        publicationDate: expect.any(Date),
        title: "Juvenile Eel Recruitment and Reef Nursery Conditions (JERRNC)",
        abstractText: "An abstract",
        authors: [
          {
            orcid: "0000-0003-1234-5678",
            firstInitial: "A",
            givenName: "Alyssa",
            middleInitials: "M",
            middleNames: "Marie",
            surname: "Langston",
            full: null,
          },
        ],
        institutions: [
          {
            name: "University of California, Berkeley",
            ror: "01an7q238",
          },
        ],
        funders: [{ name: "National Science Foundation", ror: "021nxhr62" }],
        awards: [{ awardId: "ABC" }],
        publicationVenue: "Zenodo",
        sourceName: "DataCite",
        sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
      },
    ]);

    // Assert works table
    const [worksRows] = await connection.execute("SELECT * FROM works");
    expect(worksRows).toHaveLength(1);
    expect(worksRows).toMatchObject([
      {
        id: expect.any(Number), // 👈 auto-increment id
        doi: testWorkDOIs[0],
        created: expect.any(Date),
      },
    ]);
  });
});
