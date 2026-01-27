import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { getMockDMPId, getRandomEnumValue } from "../../__tests__/helpers";
import {
  DEFAULT_TEMPORARY_DMP_ID_PREFIX,
  Plan,
  PlanSearchResult,
  PlanSectionProgress,
  PlanProgress,
  PlanStatus,
  PlanVisibility
} from "../Plan";
import { defaultLanguageId } from "../Language";
import { generalConfig } from "../../config/generalConfig";
import { getCurrentDate } from "../../utils/helpers";
import * as PlanVersionModule from "../PlanVersion";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('PlanSearchResult', () => {
  let searchResult;

  const searchResultData = {
    id: casual.integer(1, 99),
    versionedTemplateId: casual.integer(1, 99),
    title: casual.sentence,
    dmpId: casual.uuid,
    registeredBy: casual.full_name,
    registered: casual.date('YYYY-MM-DD'),
    funding: casual.company_name,
    members: [casual.full_name, casual.full_name],
    createdBy: casual.full_name,
    created: casual.date('YYYY-MM-DD'),
    modifiedBy: casual.full_name,
    modified: casual.date('YYYY-MM-DD'),
  }
  beforeEach(() => {
    searchResult = new PlanSearchResult(searchResultData);
  });

  it('should initialize options as expected', () => {
    expect(searchResult.id).toEqual(searchResultData.id);
    expect(searchResult.title).toEqual(searchResultData.title);
    expect(searchResult.dmpId).toEqual(searchResultData.dmpId);
    expect(searchResult.registered).toEqual(searchResultData.registered);
    expect(searchResult.registeredBy).toEqual(searchResultData.registeredBy);
    expect(searchResult.funding).toEqual(searchResultData.funding);
    expect(searchResult.createdBy).toEqual(searchResultData.createdBy);
    expect(searchResult.created).toEqual(searchResultData.created);
    expect(searchResult.modifiedBy).toEqual(searchResultData.modifiedBy);
    expect(searchResult.modified).toEqual(searchResultData.modified);
    expect(searchResult.featured).toBe(false);
    expect(searchResult.members).toEqual(searchResultData.members);
    expect(searchResult.status).toEqual(PlanStatus.DRAFT);
    expect(searchResult.visibility).toEqual(PlanVisibility.PRIVATE);
  });
});

describe('PlanSearchResult.findByProjectId', () => {
  const originalQuery = Plan.query;

  let localQuery;
  let planSearchResult;

  beforeEach(() => {
    localQuery = jest.fn();
    (Plan.query as jest.Mock) = localQuery;

    planSearchResult = new PlanSearchResult({
      id: casual.integer(1, 99),
      title: casual.sentence,
      dmpId: casual.uuid,
      registeredBy: casual.full_name,
      registered: casual.date('YYYY-MM-DD'),
      funding: casual.company_name,
      createdBy: casual.full_name,
      created: casual.date('YYYY-MM-DD'),
      modifiedBy: casual.full_name,
      modified: casual.date('YYYY-MM-DD'),
      featured: casual.boolean,
      members: [casual.full_name, casual.full_name],
      status: getRandomEnumValue(PlanStatus),
      visibility: getRandomEnumValue(PlanVisibility),
    });
  });

  afterEach(() => {
    Plan.query = originalQuery;
  });

  it('should call the correct SQL query', async () => {
    localQuery.mockResolvedValueOnce([planSearchResult]);
    const projectId = casual.integer(1, 99);
    const sql = 'SELECT p.id, ' +
                'CONCAT(cu.givenName, CONCAT(\' \', cu.surName)) createdBy, p.created, ' +
                'CONCAT(cm.givenName, CONCAT(\' \', cm.surName)) modifiedBy, p.modified, ' +
                'p.versionedTemplateId, p.title, p.status, p.visibility, p.dmpId, ' +
                'CONCAT(cr.givenName, CONCAT(\' \', cr.surName)) registeredBy, p.registered, p.featured, ' +
                'GROUP_CONCAT(DISTINCT CONCAT(prc.givenName, CONCAT(\' \', prc.surName, ' +
                  'CONCAT(\' (\', CONCAT(r.label, \')\'))))) members, ' +
                'GROUP_CONCAT(DISTINCT fundings.name) funding ' +
              'FROM plans p ' +
                'LEFT JOIN users cu ON cu.id = p.createdById ' +
                'LEFT JOIN users cm ON cm.id = p.modifiedById ' +
                'LEFT JOIN users cr ON cr.id = p.registeredById ' +
                'LEFT JOIN planMembers plc ON plc.planId = p.id ' +
                  'LEFT JOIN projectMembers prc ON prc.id = plc.projectMemberId ' +
                  'LEFT JOIN planMemberRoles plcr ON plc.id = plcr.planMemberId ' +
                    'LEFT JOIN memberRoles r ON plcr.memberRoleId = r.id ' +
                'LEFT JOIN planFundings ON planFundings.planId = p.id ' +
                  'LEFT JOIN projectFundings ON projectFundings.id = planFundings.projectFundingId ' +
                    'LEFT JOIN affiliations fundings ON projectFundings.affiliationId = fundings.uri ' +
              'WHERE p.projectId = ? ' +
              'GROUP BY p.id, cu.givenName, cu.surName, cm.givenName, cm.surName, ' +
                'p.title, p.status, p.visibility, ' +
                'p.dmpId, cr.givenName, cr.surName, p.registered, p.featured ' +
              'ORDER BY p.created DESC;';

    const result = await PlanSearchResult.findByProjectId('testing', context, projectId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, sql, [projectId.toString()], 'testing')
    expect(result).toEqual([planSearchResult]);
  });

  it('should return an empty array if no results are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await PlanSearchResult.findByProjectId('testing', context, projectId);
    expect(result).toEqual([]);
  });
});

describe('PlanSectionProgress', () => {
  let progress;

  const progressData = {
    versionedSectionId: casual.integer(1, 99),
    title: casual.sentence,
    displayOrder: casual.integer(1, 9),
    totalQuestions: casual.integer(1, 9),
    answeredQuestions: casual.integer(1, 9),
  }
  beforeEach(() => {
    progress = new PlanSectionProgress(progressData);
  });

  it('should initialize options as expected', () => {
    expect(progress.versionedSectionId).toEqual(progressData.versionedSectionId);
    expect(progress.title).toEqual(progressData.title);
    expect(progress.displayOrder).toEqual(progressData.displayOrder);
    expect(progress.totalQuestions).toEqual(progressData.totalQuestions);
    expect(progress.answeredQuestions).toEqual(progressData.answeredQuestions);
  });
});

describe('PlanSectionProgress.findByPlanId', () => {
  const originalQuery = Plan.query;

  let localQuery;
  let progress;

  beforeEach(() => {
    localQuery = jest.fn();
    (Plan.query as jest.Mock) = localQuery;

    progress = new PlanSectionProgress({
      sectionId: casual.integer(1, 99),
      sectionTitle: casual.sentence,
      displayOrder: casual.integer(1, 9),
      totalQuestions: casual.integer(1, 9),
      answeredQuestions: casual.integer(1, 9),
    });
  });

  afterEach(() => {
    Plan.query = originalQuery;
  });

  it('should call the correct SQL query', async () => {
    localQuery.mockResolvedValueOnce([progress]);
    const planId = casual.integer(1, 99);
    const sql = `SELECT
      vs.id AS versionedSectionId,
      vs.displayOrder,
      vs.name AS title,
      COUNT(DISTINCT vq.id) AS totalQuestions,
      COUNT(DISTINCT CASE
          WHEN a.id IS NOT NULL AND NULLIF(TRIM(a.json), '') IS NOT NULL
          THEN vq.id
        END) AS answeredQuestions,
      COALESCE(tagAgg.tags, JSON_ARRAY()) AS tags
    FROM plans p
      JOIN versionedTemplates vt ON p.versionedTemplateId = vt.id
      JOIN versionedSections vs ON vt.id = vs.versionedTemplateId
      LEFT JOIN (
        SELECT
          vst.versionedSectionId,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', t.id,
              'slug', t.slug,
              'name', t.name,
              'description', t.description
            )
          ) AS tags
        FROM versionedSectionTags vst
          JOIN tags t ON t.id = vst.tagId
        GROUP BY vst.versionedSectionId
      ) tagAgg ON tagAgg.versionedSectionId = vs.id
      LEFT JOIN versionedQuestions vq ON vs.id = vq.versionedSectionId
      LEFT JOIN answers a
        ON a.planId = p.id
        AND a.versionedQuestionId = vq.id
    WHERE p.id = ?
    GROUP BY vs.id, vs.displayOrder, vs.name, tagAgg.tags
    ORDER BY vs.displayOrder;
`
    const result = await PlanSectionProgress.findByPlanId('testing', context, planId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, sql, [planId.toString()], 'testing')
    expect(result).toEqual([progress]);
  });

  it('should return an empty array if no results are found', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await PlanSectionProgress.findByPlanId('testing', context, projectId);
    expect(result).toEqual([]);
  });
});


describe('PlanProgress', () => {
  let progress;

  const progressData = {
    totalQuestions: 10,
    answeredQuestions: 6,
  }

  beforeEach(() => {
    progress = new PlanProgress(progressData);
  });

  it('should initialize options as expected', () => {
    expect(progress.totalQuestions).toEqual(progressData.totalQuestions);
    expect(progress.answeredQuestions).toEqual(progressData.answeredQuestions);
    expect(progress.percentComplete).toEqual(Math.round(
        progressData.answeredQuestions / progressData.totalQuestions * 100));
  });
});

describe('PlanProgress.findByPlanId', () => {
  const originalQuery = Plan.query;

  let localQuery;
  let progress;

  beforeEach(() => {
    localQuery = jest.fn();
    (Plan.query as jest.Mock) = localQuery;

    progress = new PlanProgress({
      totalQuestions: casual.integer(50, 100),
      answeredQuestions: casual.integer(0, 50)
    });
  });

  afterEach(() => {
    Plan.query = originalQuery;
  });

  it('should call the correct SQL query', async () => {
    localQuery.mockResolvedValueOnce([progress]);
    const planId = casual.integer(1, 99);
    const sql = `SELECT COUNT(DISTINCT vq.id) AS totalQuestions,
        COUNT(DISTINCT CASE
            WHEN a.id IS NOT NULL AND NULLIF(TRIM(a.json), '') IS NOT NULL
            THEN vq.id
        END) AS answeredQuestions
        FROM plans p
            JOIN versionedTemplates vt ON vt.id = p.versionedTemplateId
            JOIN versionedSections  vs ON vs.versionedTemplateId = vt.id
            JOIN versionedQuestions vq ON vq.versionedSectionId = vs.id
            LEFT JOIN answers a
                ON a.planId = p.id
                AND a.versionedQuestionId = vq.id
        WHERE p.id = ?;
`
    const result = await PlanProgress.findByPlanId('testing', context, planId);
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, sql, [planId.toString()], 'testing')
    expect(result).toEqual(progress);
  });

  it('should return 0 if no questions are found', async () => {
    progress = new PlanProgress({
      totalQuestions: 0,
      answeredQuestions: 0
    });
    localQuery.mockResolvedValueOnce([]);
    expect(progress.percentComplete).toEqual(0);
  });
});

describe('Plan', () => {
  let plan;

  const planData = {
    projectId: casual.integer(1, 99),
    versionedTemplateId: casual.integer(1, 99),
    title: casual.sentence,
    dmpId: casual.uuid,
    registeredById: casual.integer(1, 99),
    registered: casual.date('YYYY-MM-DD'),
  }

  beforeEach(() => {
    plan = new Plan(planData);
  });

  it('should initialize options as expected', () => {
    expect(plan.projectId).toEqual(planData.projectId);
    expect(plan.versionedTemplateId).toEqual(planData.versionedTemplateId);
    expect(plan.title).toEqual(planData.title);
    expect(plan.dmpId).toEqual(planData.dmpId);
    expect(plan.registeredById).toEqual(planData.registeredById);
    expect(plan.registered).toEqual(planData.registered);
    expect(plan.featured).toEqual(false);
    expect(plan.status).toEqual(PlanStatus.DRAFT);
    expect(plan.visibility).toEqual(PlanVisibility.PRIVATE);
    expect(plan.languageId).toEqual(defaultLanguageId);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await plan.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the projectId field is missing', async () => {
    plan.projectId = null;
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['projectId']).toBeTruthy();
  });

  it('should return false when calling isValid if the versionedTemplateId field is missing', async () => {
    plan.versionedTemplateId = null;
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['versionedTemplateId']).toBeTruthy();
  });

  it('should return false when calling isValid if the title field is missing', async () => {
    plan.title = null;
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['title']).toBeTruthy();
  });

  it('should return false when calling isValid if the dmpId field is missing but registered is present', async () => {
    plan.dmpId = null;
    plan.registered = casual.date('YYYY-MM-DD');
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['dmpId']).toBeTruthy();
  });

  it('should return false when calling isValid if the Plan is published but the registered field is missing', async () => {
    plan.registered = null;
    plan.dmpId = casual.uuid;
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['registered']).toBeTruthy();
  });

  it('should return false when calling isValid if the Plan is published but a registeredById field is missing', async () => {
    plan.registeredById = null;
    plan.dmpId = casual.uuid;
    expect(await plan.isValid()).toBe(false);
    expect(Object.keys(plan.errors).length).toBe(1);
    expect(plan.errors['registeredById']).toBeTruthy();
  });

  it('generateDMPId should return the existing DMP Id', async () => {
    plan.dmpId = casual.uuid;

    const dmpId = await plan.generateDMPId(context);
    expect(dmpId).toEqual(plan.dmpId);
  });

  it('generateDMPId should generate a new DMP Id', async () => {
    plan.dmpId = null;
    jest.spyOn(Plan, 'query').mockResolvedValue([]);

    const dmpId = await plan.generateDMPId(context);
    expect(Plan.query).toHaveBeenCalledTimes(1);
    expect(dmpId.startsWith(`${generalConfig.dmpIdBaseURL}${generalConfig.dmpIdShoulder}`)).toBe(true);
  });

  it('generateDMPId should generate a DMP Id with the temporary prefix if unable to generate a unique DMP Id', async () => {
    plan.dmpId = null;
    jest.spyOn(Plan, 'query').mockResolvedValue([plan]);

    const dmpId = await plan.generateDMPId(context);
    expect(Plan.query).toHaveBeenCalledTimes(5);
    expect(dmpId.startsWith(DEFAULT_TEMPORARY_DMP_ID_PREFIX)).toBe(true);
  });

  it('isPublished should return true if the Plan has a dmpId', () => {
    plan.dmpId = casual.uuid;
    expect(plan.isPublished()).toBe(true);
  });
});

describe('findBy Queries', () => {
  const originalQuery = Plan.query;

  let localQuery;
  let plan;

  beforeEach(() => {
    localQuery = jest.fn();
    (Plan.query as jest.Mock) = localQuery;

    plan = new Plan({
      projectId: casual.integer(1, 99),
      versionedTemplateId: casual.integer(1, 99),
      dmpId: casual.uuid,
      registeredById: casual.integer(1, 99),
      registered: casual.date('YYYY-MM-DD'),
      status: getRandomEnumValue(PlanStatus),
      visibility: getRandomEnumValue(PlanVisibility),
      languageId: defaultLanguageId,
      featured: casual.boolean,
      createdById: casual.integer(1, 99),
      modifiedById: casual.integer(1, 99),
      created: casual.date('YYYY-MM-DD'),
      modified: casual.date('YYYY-MM-DD'),
      id: casual.integer(1, 99),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Plan.query = originalQuery;
  });

  it('findById should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([plan]);
    const planId = casual.integer(1, 999);
    const result = await Plan.findById('testing', context, planId);
    const expectedSql = 'SELECT * FROM plans WHERE id = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [planId.toString()], 'testing')
    expect(result).toEqual(plan);
  });

  it('findById should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const planId = casual.integer(1, 999);
    const result = await Plan.findById('testing', context, planId);
    expect(result).toEqual(null);
  });

  it('findByDMPId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([plan]);
    const dmpId = casual.uuid;
    const result = await Plan.findByDMPId('testing', context, dmpId);
    const expectedSql = 'SELECT * FROM plans WHERE dmpId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [dmpId.toString()], 'testing')
    expect(result).toEqual(plan);
  });

  it('findByDMPId should return null if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const dmpId = casual.uuid;
    const result = await Plan.findByDMPId('testing', context, dmpId);
    expect(result).toEqual(null);
  });

  it('findByProjectId should call query with correct params and return the default', async () => {
    localQuery.mockResolvedValueOnce([plan]);
    const projectId = casual.integer(1, 999);
    const result = await Plan.findByProjectId('testing', context, projectId);
    const expectedSql = 'SELECT * FROM plans WHERE projectId = ?';
    expect(localQuery).toHaveBeenCalledTimes(1);
    expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'testing')
    expect(result).toEqual([plan]);
  });

  it('findByProjectId should return an empty array if it finds no default', async () => {
    localQuery.mockResolvedValueOnce([]);
    const projectId = casual.integer(1, 999);
    const result = await Plan.findByProjectId('testing', context, projectId);
    expect(result).toEqual([]);
  });
});

describe('publish', () => {
  let plan;
  let mockFindById;
  let updateQuery;

  beforeEach(() => {
    mockFindById = jest.fn();
    (Plan.findById as jest.Mock) = mockFindById;
    updateQuery = jest.fn();
    (Plan.update as jest.Mock) = updateQuery;

    plan = new Plan({
      id: casual.integer(1, 999),
      dmpId: getMockDMPId(),
      createdById: casual.integer(1, 99),
      created: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
      modifiedById: casual.integer(1, 99),
      modified: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
      projectId: casual.integer(1, 99),
      versionedTemplateId: casual.integer(1, 99),
      title: casual.sentence,
      visibility: getRandomEnumValue(PlanVisibility),
      languageId: defaultLanguageId,
      featured: casual.boolean,
    });
  });

  it('returns the newly published Plan', async () => {
    updateQuery.mockResolvedValueOnce(plan);
    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.updateVersion as jest.Mock) = versionMock;

    const result = await plan.publish(context);
    const versionMockInput = versionMock.mock.calls[0][1] as Plan;

    expect(Object.keys(result.errors).length).toBe(0);
    expect(PlanVersionModule.updateVersion).toHaveBeenCalledTimes(1);

    expect(result).toBeInstanceOf(Plan);
    expect(versionMockInput.registered).toBeTruthy();
    expect(versionMockInput.registeredById).toBeTruthy();
  });

  it('returns an error if the Plan is not valid', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await plan.publish(context);
    expect(result instanceof Plan).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Plan is already published', async () => {
    plan.dmpId = getMockDMPId();
    plan.registered = getCurrentDate();
    plan.registeredById = casual.integer(1, 99);
    const result = await plan.publish(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });
});

describe('create', () => {
  const originalInsert = Plan.insert;
  let insertQuery;
  let plan;

  beforeEach(() => {
    insertQuery = jest.fn();
    (Plan.insert as jest.Mock) = insertQuery;

    plan = new Plan({
      projectId: casual.integer(1, 99),
      versionedTemplateId: casual.integer(1, 99),
      title: casual.sentence,
      status: PlanStatus.DRAFT,
      visibility: getRandomEnumValue(PlanVisibility),
      languageId: defaultLanguageId,
      featured: casual.boolean,
    });
  });

  afterEach(() => {
    Plan.insert = originalInsert;
  });

  it('returns the Plan with errors if it is invalid', async () => {
    plan.projectId = undefined;
    const response = await plan.create(context);
    expect(response.errors['projectId']).toBe('Project can\'t be blank');
  });

  it('returns the newly added Plan', async () => {
    const createdPlan = new Plan({ ...plan, id: 123 });
    insertQuery.mockResolvedValueOnce(createdPlan.id);
    const mockFindById = jest.fn().mockResolvedValueOnce(createdPlan);
    (Plan.findById as jest.Mock) = mockFindById;
    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.addVersion as jest.Mock) = versionMock;

    const result = await plan.create(context);

    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(insertQuery).toHaveBeenCalledTimes(1);
    expect(PlanVersionModule.addVersion).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Plan);
  });
});

describe('update', () => {
  let updateQuery;
  let plan;

  beforeEach(() => {
    updateQuery = jest.fn();
    (Plan.update as jest.Mock) = updateQuery;

    plan = new Plan({
      id: casual.integer(1, 999),
      projectId: casual.integer(1, 99),
      versionedTemplateId: casual.integer(1, 99),
      title: casual.sentence,
      dmpId: casual.url,
      status: getRandomEnumValue(PlanStatus),
      visibility: getRandomEnumValue(PlanVisibility),
      registeredById: casual.integer(1, 99),
      registered: casual.date('YYYY-MM-DD'),
      languageId: defaultLanguageId,
      featured: casual.boolean,
    })
  });

  it('returns the Plan with errors if it is not valid', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(false);

    const result = await plan.update(context);
    expect(result instanceof Plan).toBe(true);
    expect(localValidator).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the Plan has no id', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValueOnce(true);

    plan.id = null;
    const result = await plan.update(context);
    expect(Object.keys(result.errors).length).toBe(1);
    expect(result.errors['general']).toBeTruthy();
  });

  it('returns the updated Plan', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValue(true);

    updateQuery.mockResolvedValueOnce(plan);
    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.updateVersion as jest.Mock) = versionMock;

    const result = await plan.update(context);

    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Plan);
    expect(versionMock).toHaveBeenCalledTimes(1);
  });

  it('does not do any versioning if noTouch is true', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValue(true);

    updateQuery.mockResolvedValueOnce(plan);
    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.updateVersion as jest.Mock) = versionMock;

    const result = await plan.update(context, true);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Plan);
    expect(versionMock).toHaveBeenCalledTimes(0);
  });

  it('does not do any versioning if the Plan update failed', async () => {
    const localValidator = jest.fn();
    (plan.isValid as jest.Mock) = localValidator;
    localValidator.mockResolvedValue(true);

    updateQuery.mockResolvedValueOnce(null);
    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.updateVersion as jest.Mock) = versionMock;

    const result = await plan.update(context);
    expect(localValidator).toHaveBeenCalledTimes(1);
    expect(updateQuery).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Plan);
    expect(versionMock).toHaveBeenCalledTimes(0);
  });
});

describe('delete', () => {
  let plan;

  beforeEach(() => {
    plan = new Plan({
      id: casual.integer(1, 999),
      projectId: casual.integer(1, 99),
      versionedTemplateId: casual.integer(1, 99),
      dmpId: casual.url,
      languageId: defaultLanguageId,
      featured: casual.boolean,
    });
  })

  it('returns null if the Plan has no id', async () => {
    plan.id = null;
    expect(await plan.delete(context)).toBe(null);
  });

  it('returns null if it was not able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Plan.delete as jest.Mock) = deleteQuery;

    deleteQuery.mockResolvedValueOnce(null);
    expect(await plan.delete(context)).toBe(null);
  });

  it('returns the Plan if it was able to delete the record', async () => {
    const deleteQuery = jest.fn();
    (Plan.delete as jest.Mock) = deleteQuery;
    deleteQuery.mockResolvedValueOnce(plan);

    const mockFindById = jest.fn();
    (Plan.findById as jest.Mock) = mockFindById;
    mockFindById.mockResolvedValueOnce(plan);

    const versionMock = jest.fn().mockResolvedValueOnce(plan);
    (PlanVersionModule.removeVersions as jest.Mock) = versionMock;

    const result = await plan.delete(context);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result).toBeInstanceOf(Plan);
    expect(deleteQuery).toHaveBeenCalledTimes(1);
    expect(mockFindById).toHaveBeenCalledTimes(1);
    expect(versionMock).toHaveBeenCalledTimes(1);
  });
});
