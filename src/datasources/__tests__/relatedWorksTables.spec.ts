import fs from 'fs';
import path from 'path';
import mysql, { Connection } from 'mysql2/promise';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { Author, Award, ContentMatch, DoiMatch, Funder, Institution, ItemMatch } from '../../types';
import type { ResultSetHeader } from 'mysql2/promise';

interface RelatedWork {
  planId: number;
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

async function executeProceduresSql(conn: Connection, sql: string): Promise<void> {
  const cleaned = sql.replace(/DELIMITER\s+\$\$\s*/g, '').replace(/DELIMITER\s+;\s*/g, '');
  const statements = cleaned
    .split('$$')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await conn.query(stmt);
  }
}

async function insertProjectAndPlan(connection: Connection, project: Project, plan: Plan): Promise<number> {
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

    const [planResult] = await connection.execute<ResultSetHeader>(
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
    return planResult.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function insertRelatedWorks(connection: Connection, data: RelatedWork[]) {
  if (data.length === 0) {
    return;
  }
  const sql =
    'INSERT INTO stagingRelatedWorks (planId, workDoi, hash, sourceType, score, status, scoreMax, doiMatch, contentMatch, authorMatches, institutionMatches, funderMatches, awardMatches) VALUES ?';
  const values = data.map((item) => [
    item.planId,
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

async function insertWorkVersions(connection: Connection, data: WorkVersion[]) {
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

const MIGRATIONS_DIR = path.join(__dirname, '../../../data-migrations');

let container: StartedMySqlContainer;
let connection: Connection;
let planAId: number;

const testPlanDOIs: string[] = ['https://doi.org/10.11111/2A3B4C'];
const testWorkDOIs: string[] = ['10.1234/fake-doi-001', '10.5678/sample.abc.2025'];

beforeAll(async () => {
  container = await new MySqlContainer('mysql:8.0').withDatabase('dmptool').withRootPassword('test').start();

  connection = await mysql.createConnection({
    host: container.getHost(),
    port: container.getMappedPort(3306),
    user: 'root',
    password: 'test',
    database: 'dmptool',
    multipleStatements: true,
  });

  // Apply all migrations in chronological order (filenames sort lexicographically by date)
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    if (sql.includes('DELIMITER')) {
      await executeProceduresSql(connection, sql);
    } else {
      await connection.query(sql);
    }
  }

  // Seed minimal reference data for FK constraints
  await connection.query(`
    INSERT INTO users (id, password, role, givenName, surName)
    VALUES (1, 'dummy', 'RESEARCHER', 'Test', 'User');
  `);
  await connection.query(`
    INSERT INTO affiliations (uri, name, displayName, createdById, modifiedById)
    VALUES ('https://ror.org/test', 'Test University', 'Test University', 1, 1);
  `);
  await connection.query(`
    INSERT INTO templates (id, name, ownerId, latestPublishVisibility, createdById, modifiedById)
    VALUES (1, 'Test Template', 'https://ror.org/test', 'PRIVATE', 1, 1);
  `);
  await connection.query(`
    INSERT INTO versionedTemplates (id, templateId, version, versionedById, name, ownerId, visibility, createdById, modifiedById)
    VALUES (1, 1, '1.0', 1, 'Test Template v1', 'https://ror.org/test', 'PRIVATE', 1, 1);
  `);
}, 120000);

afterAll(async () => {
  if (connection) await connection.end();
  if (container) await container.stop();
});

const makeDoiMatch = (score = 1.0): DoiMatch => ({
  found: true,
  score,
  sources: [{ awardId: 'ABC', awardUrl: 'https://url-of-funder/award-page' }],
});

const makeContentMatch = (score: number, titleHighlight: string): ContentMatch => ({
  score,
  titleHighlight,
  abstractHighlights: ['An <mark>abstract</mark>'],
});

const makeItemMatch = (index: number, score: number, fields: string[]): ItemMatch => ({
  index,
  score,
  fields,
});

const workVersion1: WorkVersion = {
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
  institutions: [{ name: 'University of California, Berkeley', ror: '01an7q238' }],
  funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
  awards: [{ awardId: 'ABC' }],
  publicationVenue: 'Zenodo',
  sourceName: 'DataCite',
  sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[0]}`,
};

const workVersion2: WorkVersion = {
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
  institutions: [{ name: 'University of California, Berkeley', ror: '01an7q238' }],
  funders: [{ name: 'National Science Foundation', ror: '021nxhr62' }],
  awards: [{ awardId: 'ABC' }],
  publicationVenue: 'Nature',
  sourceName: 'OpenAlex',
  sourceUrl: 'https://openalex.org/works/W0000000001',
};

function makeRelatedWork(overrides: Partial<RelatedWork> & { planId: number; workDoi: string; hash: Buffer }): RelatedWork {
  return {
    sourceType: 'SYSTEM_MATCHED',
    score: 1.0,
    status: 'PENDING',
    scoreMax: 1.0,
    doiMatch: makeDoiMatch(),
    contentMatch: makeContentMatch(18.0, 'Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)'),
    authorMatches: [makeItemMatch(0, 2.0, ['full', 'ror'])],
    institutionMatches: [makeItemMatch(0, 2.0, ['name', 'ror'])],
    funderMatches: [makeItemMatch(0, 1.0, ['name'])],
    awardMatches: [{ index: 0, score: 10.0 } as ItemMatch],
    ...overrides,
  };
}

describe('Related Works Tables', () => {
  test('1. should insert works', async () => {
    planAId = await insertProjectAndPlan(
      connection,
      { title: testPlanDOIs[0], isTestProject: true, createdById: 1, modifiedById: 1 },
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

    const relatedWorksData: RelatedWork[] = [
      makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[0], hash: workVersion1.hash }),
      makeRelatedWork({
        planId: planAId,
        workDoi: testWorkDOIs[1],
        hash: workVersion2.hash,
        score: 0.8,
        contentMatch: makeContentMatch(
          18.0,
          'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
        ),
      }),
    ];

    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1, workVersion2]);
    await insertRelatedWorks(connection, relatedWorksData);
    await connection.query('CALL batch_update_related_works(?)', [true]);
    await connection.query('CALL cleanup_orphan_works');

    const [relatedWorksRows] = await connection.execute('SELECT * FROM relatedWorks');
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([
      {
        id: expect.any(Number),
        planId: expect.any(Number),
        workVersionId: expect.any(Number),
        sourceType: 'SYSTEM_MATCHED',
        score: 1,
        scoreMax: 1.0,
        status: 'PENDING',
        doiMatch: makeDoiMatch(),
        contentMatch: makeContentMatch(
          18.0,
          'Juvenile <mark>Eel</mark> Recruitment and Reef Nursery Conditions (JERRNC)',
        ),
        authorMatches: [makeItemMatch(0, 2.0, ['full', 'ror'])],
        institutionMatches: [makeItemMatch(0, 2.0, ['name', 'ror'])],
        funderMatches: [makeItemMatch(0, 1.0, ['name'])],
        awardMatches: [{ index: 0, score: 10.0 }],
      },
      {
        id: expect.any(Number),
        planId: expect.any(Number),
        workVersionId: expect.any(Number),
        sourceType: 'SYSTEM_MATCHED',
        score: expect.closeTo(0.8, 5),
        scoreMax: 1.0,
        status: 'PENDING',
        doiMatch: makeDoiMatch(),
        contentMatch: makeContentMatch(
          18.0,
          'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
        ),
        authorMatches: [makeItemMatch(0, 2.0, ['full', 'ror'])],
        institutionMatches: [makeItemMatch(0, 2.0, ['name', 'ror'])],
        funderMatches: [makeItemMatch(0, 1.0, ['name'])],
        awardMatches: [{ index: 0, score: 10.0 }],
      },
    ]);

    const [workVersionsRows] = await connection.execute('SELECT * FROM workVersions');
    expect(workVersionsRows).toHaveLength(2);
    expect(workVersionsRows).toMatchObject([
      {
        id: expect.any(Number),
        workId: expect.any(Number),
        hash: workVersion1.hash,
        workType: 'DATASET',
        publicationDate: expect.any(Date),
        title: workVersion1.title,
        abstractText: workVersion1.abstractText,
        authors: workVersion1.authors,
        institutions: workVersion1.institutions,
        funders: workVersion1.funders,
        awards: workVersion1.awards,
        publicationVenue: workVersion1.publicationVenue,
        sourceName: workVersion1.sourceName,
        sourceUrl: workVersion1.sourceUrl,
      },
      {
        id: expect.any(Number),
        workId: expect.any(Number),
        hash: workVersion2.hash,
        workType: 'ARTICLE',
        publicationDate: expect.any(Date),
        title: workVersion2.title,
        abstractText: workVersion2.abstractText,
        authors: workVersion2.authors,
        institutions: workVersion2.institutions,
        funders: workVersion2.funders,
        awards: workVersion2.awards,
        publicationVenue: workVersion2.publicationVenue,
        sourceName: workVersion2.sourceName,
        sourceUrl: workVersion2.sourceUrl,
      },
    ]);

    const [worksRows] = await connection.execute('SELECT * FROM works');
    expect(worksRows).toHaveLength(2);
    expect(worksRows).toMatchObject([
      { id: expect.any(Number), doi: testWorkDOIs[0], created: expect.any(Date) },
      { id: expect.any(Number), doi: testWorkDOIs[1], created: expect.any(Date) },
    ]);
  });

  test('2. should update works', async () => {
    const updatedWorkVersion2: WorkVersion = {
      ...workVersion2,
      hash: Buffer.from('eccbc87e4b5ce2fe28308fd9f2a7baf3', 'hex'),
      workType: 'DATASET',
      publicationDate: '2025-02-02',
      title: 'Title: Climate Resilience of Eel-Reef Mutualisms: A Longitudinal Study',
      abstractText: 'An abstract abstract',
      authors: [...workVersion2.authors.slice(0, 1), { ...workVersion2.authors[1] ?? {}, givenName: 'Daniel' }],
      institutions: [{ name: 'University of California', ror: '01an7q238' }],
      funders: [{ name: 'National Science Foundation, USA', ror: '021nxhr62' }],
      awards: [{ awardId: 'ABC' }, { awardId: '123' }],
      publicationVenue: 'Nature Publications',
      sourceName: 'DataCite',
      sourceUrl: `https://commons.datacite.org/doi.org/${testWorkDOIs[1]}`,
    };

    const relatedWorksData: RelatedWork[] = [
      makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[0], hash: workVersion1.hash }),
      makeRelatedWork({
        planId: planAId,
        workDoi: testWorkDOIs[1],
        hash: updatedWorkVersion2.hash,
        score: 0.9,
        doiMatch: makeDoiMatch(2.0),
        contentMatch: makeContentMatch(
          20.0,
          'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
        ),
        authorMatches: [makeItemMatch(1, 2.0, ['full', 'ror'])],
        institutionMatches: [makeItemMatch(1, 2.0, ['name', 'ror'])],
        funderMatches: [makeItemMatch(1, 1.0, ['name'])],
        awardMatches: [{ index: 1, score: 10.0 } as ItemMatch],
      }),
    ];

    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1, updatedWorkVersion2]);
    await insertRelatedWorks(connection, relatedWorksData);
    await connection.query('CALL batch_update_related_works(?)', [true]);
    await connection.query('CALL cleanup_orphan_works');

    const [relatedWorksRows] = await connection.execute('SELECT * FROM relatedWorks');
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([
      {
        sourceType: 'SYSTEM_MATCHED',
        score: 1,
        scoreMax: 1.0,
        status: 'PENDING',
      },
      {
        sourceType: 'SYSTEM_MATCHED',
        score: expect.closeTo(0.9, 5),
        scoreMax: 1.0,
        status: 'PENDING',
        doiMatch: makeDoiMatch(2.0),
        contentMatch: makeContentMatch(
          20.0,
          'Climate Resilience of <mark>Eel-Reef</mark> Mutualisms: A Longitudinal Study',
        ),
        authorMatches: [makeItemMatch(1, 2.0, ['full', 'ror'])],
        institutionMatches: [makeItemMatch(1, 2.0, ['name', 'ror'])],
        funderMatches: [makeItemMatch(1, 1.0, ['name'])],
        awardMatches: [{ index: 1, score: 10.0 }],
      },
    ]);

    const [workVersionsRows] = await connection.execute('SELECT * FROM workVersions');
    expect(workVersionsRows).toHaveLength(2);
    expect(workVersionsRows).toMatchObject([
      { hash: workVersion1.hash, workType: 'DATASET', title: workVersion1.title },
      {
        hash: updatedWorkVersion2.hash,
        workType: 'DATASET',
        title: updatedWorkVersion2.title,
        abstractText: updatedWorkVersion2.abstractText,
        authors: updatedWorkVersion2.authors,
        institutions: updatedWorkVersion2.institutions,
        funders: updatedWorkVersion2.funders,
        awards: updatedWorkVersion2.awards,
        publicationVenue: updatedWorkVersion2.publicationVenue,
        sourceName: updatedWorkVersion2.sourceName,
        sourceUrl: updatedWorkVersion2.sourceUrl,
      },
    ]);

    const [worksRows] = await connection.execute('SELECT * FROM works');
    expect(worksRows).toHaveLength(2);
    expect(worksRows).toMatchObject([
      { doi: testWorkDOIs[0], created: expect.any(Date) },
      { doi: testWorkDOIs[1], created: expect.any(Date) },
    ]);
  });

  test('3. should keep accepted and rejected works', async () => {
    // Accept first work, reject second
    await connection.query(`
      UPDATE relatedWorks
      SET status = 'ACCEPTED'
      WHERE workVersionId = (
        SELECT wv.id FROM workVersions wv
          INNER JOIN works w ON w.id = wv.workId
        WHERE w.doi = '${testWorkDOIs[0]}'
        LIMIT 1
      );
    `);
    await connection.query(`
      UPDATE relatedWorks
      SET status = 'REJECTED'
      WHERE workVersionId = (
        SELECT wv.id FROM workVersions wv
          INNER JOIN works w ON w.id = wv.workId
        WHERE w.doi = '${testWorkDOIs[1]}'
        LIMIT 1
      );
    `);

    // Load empty staging data — should not delete accepted/rejected works
    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, []);
    await insertRelatedWorks(connection, []);
    await connection.query('CALL batch_update_related_works(?)', [true]);
    await connection.query('CALL cleanup_orphan_works');

    const [relatedWorksRows] = await connection.execute('SELECT * FROM relatedWorks');
    expect(relatedWorksRows).toHaveLength(2);
    expect(relatedWorksRows).toMatchObject([{ status: 'ACCEPTED' }, { status: 'REJECTED' }]);

    const [workVersionsRows] = await connection.execute('SELECT * FROM workVersions');
    expect(workVersionsRows).toHaveLength(2);

    const [worksRows] = await connection.execute('SELECT * FROM works');
    expect(worksRows).toHaveLength(2);
  });

  test('4. should delete unlinked pending related works', async () => {
    // Set all works back to pending
    await connection.query(`UPDATE relatedWorks SET status = 'PENDING'`);

    // Only keep one work in staging
    const relatedWorksData: RelatedWork[] = [makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[0], hash: workVersion1.hash })];

    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1]);
    await insertRelatedWorks(connection, relatedWorksData);
    await connection.query('CALL batch_update_related_works(?)', [true]);
    await connection.query('CALL cleanup_orphan_works');

    const [relatedWorksRows] = await connection.execute('SELECT * FROM relatedWorks');
    expect(relatedWorksRows).toHaveLength(1);
    expect(relatedWorksRows).toMatchObject([{ sourceType: 'SYSTEM_MATCHED', score: 1, status: 'PENDING' }]);

    const [workVersionsRows] = await connection.execute('SELECT * FROM workVersions');
    expect(workVersionsRows).toHaveLength(1);
    expect(workVersionsRows).toMatchObject([
      { hash: workVersion1.hash, workType: 'DATASET', title: workVersion1.title },
    ]);

    const [worksRows] = await connection.execute('SELECT * FROM works');
    expect(worksRows).toHaveLength(1);
    expect(worksRows).toMatchObject([{ doi: testWorkDOIs[0] }]);
  });

  test('5. should not delete other plans pending works when batching per-DMP', async () => {
    // Setup: Create Plan B with its own work
    const planBDoi = 'https://doi.org/10.22222/PLAN_B';
    const workDoi3 = '10.9999/third-work-doi';

    const planBId = await insertProjectAndPlan(
      connection,
      { title: planBDoi, isTestProject: true, createdById: 1, modifiedById: 1 },
      {
        versionedTemplateId: 1,
        visibility: 'PRIVATE',
        status: 'DRAFT',
        dmpId: planBDoi,
        languageId: 'en-US',
        featured: 0,
        createdById: 1,
        modifiedById: 1,
      },
    );

    const workVersion3: WorkVersion = {
      ...workVersion1,
      doi: workDoi3,
      hash: Buffer.from('a87ff679a2f3e71d9181a67b7542122c', 'hex'),
      title: 'Third Work for Plan B',
    };

    // Add a second work for Plan A and a work for Plan B (include both Plan A works in staging)
    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1, workVersion2, workVersion3]);
    await insertRelatedWorks(connection, [
      makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[0], hash: workVersion1.hash }),
      makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[1], hash: workVersion2.hash }),
      makeRelatedWork({ planId: planBId, workDoi: workDoi3, hash: workVersion3.hash }),
    ]);
    await connection.query('CALL batch_update_related_works(?)', [true]);
    await connection.query('CALL cleanup_orphan_works');

    // Verify: Plan A has 2 works (one from test 4, one just added), Plan B has 1
    const [beforeRows] = await connection.execute<ResultSetHeader[]>(
      'SELECT r.*, p.dmpId FROM relatedWorks r JOIN plans p ON r.planId = p.id ORDER BY p.dmpId, r.id',
    );
    const planABefore = beforeRows.filter((r: ResultSetHeader) => r['dmpId'] === testPlanDOIs[0]);
    const planBBefore = beforeRows.filter((r: ResultSetHeader) => r['dmpId'] === planBDoi);
    expect(planABefore).toHaveLength(2);
    expect(planBBefore).toHaveLength(1);

    // Now batch for Plan A only with just 1 of its 2 works
    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1]);
    await insertRelatedWorks(connection, [makeRelatedWork({ planId: planAId, workDoi: testWorkDOIs[0], hash: workVersion1.hash })]);
    await connection.query('CALL batch_update_related_works(?)', [true]);

    // Plan A: stale pending work deleted, only the staged one remains
    // Plan B: untouched — its PENDING work must still be there
    const [afterRows] = await connection.execute<ResultSetHeader[]>(
      'SELECT r.*, p.dmpId FROM relatedWorks r JOIN plans p ON r.planId = p.id ORDER BY p.dmpId, r.id',
    );
    const planAAfter = afterRows.filter((r: ResultSetHeader) => r['dmpId'] === testPlanDOIs[0]);
    const planBAfter = afterRows.filter((r: ResultSetHeader) => r['dmpId'] === planBDoi);

    expect(planAAfter).toHaveLength(1);
    expect(planBAfter).toHaveLength(1);
  });

  test('6. systemMatched=false should only update status, not delete or update metadata', async () => {
    // State from test 5: Plan A has 1 PENDING work (testWorkDOIs[0]), Plan B has 1 PENDING work (workDoi3)
    const planBDoi = 'https://doi.org/10.22222/PLAN_B';

    // Capture current scores before the update
    const [beforeRows] = await connection.execute<ResultSetHeader[]>(
      'SELECT r.score, r.scoreMax, r.sourceType, p.dmpId FROM relatedWorks r JOIN plans p ON r.planId = p.id',
    );
    const planABefore = beforeRows.find((r: ResultSetHeader) => r['dmpId'] === testPlanDOIs[0]);

    // Stage Plan A's work with status=ACCEPTED and different score/sourceType
    await connection.query('CALL create_related_works_staging_tables');
    await insertWorkVersions(connection, [workVersion1]);
    await insertRelatedWorks(connection, [
      makeRelatedWork({
        planId: planAId,
        workDoi: testWorkDOIs[0],
        hash: workVersion1.hash,
        status: 'ACCEPTED',
        sourceType: 'USER_ADDED',
        score: 999,
      }),
    ]);
    await connection.query('CALL batch_update_related_works(?)', [false]);

    const [afterRows] = await connection.execute<ResultSetHeader[]>(
      'SELECT r.score, r.sourceType, r.status, p.dmpId FROM relatedWorks r JOIN plans p ON r.planId = p.id ORDER BY p.dmpId',
    );
    const planAAfter:ResultSetHeader = afterRows.find((r: ResultSetHeader) => r['dmpId'] === testPlanDOIs[0]);
    const planBAfter:ResultSetHeader = afterRows.find((r: ResultSetHeader) => r['dmpId'] === planBDoi);

    // Status should be updated
    expect(planAAfter['status']).toBe('ACCEPTED');

    // Score and sourceType should NOT be updated (systemMatched=false only touches status)
    expect(planAAfter['score']).toBe(planABefore['score']);
    expect(planAAfter['sourceType']).toBe(planABefore['sourceType']);

    // Plan B's PENDING work should NOT be deleted (no PENDING deletion in systemMatched=false path)
    expect(planBAfter).toBeDefined();
    expect(planBAfter['status']).toBe('PENDING');
  });
});
