import casual from "casual";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { Project, ProjectSearchResult } from "../Project";
import { generalConfig } from "../../config/generalConfig";
import { logger } from "../../logger";

jest.mock('../../context.ts');

let context;

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ProjectSearchResult', () => {
  let localQuery;
  let projectSearchResult;

  beforeEach(async () => {
    jest.resetAllMocks();

    localQuery = jest.fn();
    (Project.queryWithPagination as jest.Mock) = localQuery;

    context = await buildMockContextWithToken(logger);

    projectSearchResult = new ProjectSearchResult({
      id: casual.integer(1, 9),
      title: casual.sentence,
      abstractText: casual.sentences(5),
      startDate: casual.date('YYYY-MM-DD'),
      endDate: casual.date('YYYY-MM-DD'),
      researchDomain: casual.word,
      isTestProject: casual.boolean,
      createdById: casual.integer(1, 99),
      createdByName: casual.name,
      created: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
      modifiedById: casual.integer(1, 99),
      modifiedByName: casual.name,
      modified: casual.date('YYYY-MM-DDTHH:mm:ssZ'),
      collaboratorsData: 'foo@example.com|Comment|0000-0000-0000-1234,Jane Doe|Own|0000-0000-0000-5678',
      collaborators: [
        { name: 'foo@example.com', accessLevel: 'Comment', orcid: '0000-0000-0000-1234' },
        { name: 'Jane Doe', accessLevel: 'Own', orcid: '0000-0000-0000-5678' }
      ],
      membersData: 'John Smith|Principal Investigator (PI)|0000-0000-0000-TEST,' +
                          'John Smith|Other|0000-0000-0000-TEST,Elmer Fudd|Other|0000-0000-0000-9876',
      members: [
        { name: 'John Smith', role: 'Principal Investigator (PI), Other', orcid: '0000-0000-0000-TEST' },
        { name: 'Elmer Fudd', role: 'Other', orcid: '0000-0000-0000-9876' }
      ],
      fundingsData: 'Test funding|12345,Another funding|67890',
      fundings: [
        { name: 'Test funding', grantId: '12345' },
        { name: 'Another funding', grantId: '67890' },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('returns the matching ProjectSearchResults when userId and term are specified', async () => {
      const queryResult = {
        id: projectSearchResult.id,
        title: projectSearchResult.title,
        abstractText: projectSearchResult.abstractText,
        startDate: projectSearchResult.startDate,
        endDate: projectSearchResult.endDate,
        researchDomain: projectSearchResult.researchDomain,
        isTestProject: projectSearchResult.isTestProject,
        createdById: projectSearchResult.createdById,
        created: projectSearchResult.created,
        createdByName: projectSearchResult.createdByName,
        modifiedById: projectSearchResult.modifiedById,
        modified: projectSearchResult.modified,
        modifiedByName: projectSearchResult.modifiedByName,
        collaboratorsData: 'foo@example.com|Comment|0000-0000-0000-1234,Jane Doe|Own|0000-0000-0000-5678',
        membersData: 'John Smith|Principal Investigator (PI)|0000-0000-0000-TEST,' +
                          'John Smith|Other|0000-0000-0000-TEST,Elmer Fudd|Other|0000-0000-0000-9876',
        fundingsData: 'Test funding|12345,Another funding|67890',
      }
      localQuery.mockResolvedValueOnce({ items: [queryResult] });

      const term = 'Test';
      const result = await ProjectSearchResult.search('Test', context, term, projectSearchResult.createdById);
      const sql = 'SELECT p.id, p.title, p.abstractText, p.startDate, p.endDate, p.isTestProject, ' +
                            'researchDomains.description as researchDomain, ' +
                            'p.createdById, p.created, TRIM(CONCAT(cu.givenName, CONCAT(\' \', cu.surName))) as createdByName, ' +
                            'p.modifiedById, p.modified, TRIM(CONCAT(mu.givenName, CONCAT(\' \', mu.surName))) as modifiedByName, ' +
                            'GROUP_CONCAT(DISTINCT CONCAT_WS(\'|\', ' +
                              'CASE ' +
                                'WHEN collab.surName IS NOT NULL THEN TRIM(CONCAT(collab.givenName, CONCAT(\' \', collab.surName))) ' +
                                'ELSE (SELECT collabE.email FROM userEmails collabE WHERE collabE.userId = collab.id LIMIT 1) ' +
                              'END, ' +
                              'CONCAT(UPPER(SUBSTRING(pcol.accessLevel, 1, 1)), LOWER(SUBSTRING(pcol.accessLevel FROM 2))), ' +
                              'collab.orcid ' +
                            ') ORDER BY collab.created) collaboratorsData, ' +
                            'GROUP_CONCAT(DISTINCT ' +
                              'CONCAT_WS(\'|\', ' +
                              'CASE ' +
                                'WHEN pm.surName IS NOT NULL THEN TRIM(CONCAT(pm.givenName, CONCAT(\' \', pm.surName))) ' +
                                'ELSE (SELECT pmE.email FROM userEmails pmE WHERE pmE.userId = pm.id AND pmE.isPrimary = 1 LIMIT 1) ' +
                              'END, ' +
                              'r.label, ' +
                              'pm.orcid ' +
                            ') ORDER BY pm.created) as membersData, ' +
                            'GROUP_CONCAT(DISTINCT CONCAT_WS(\'|\', fundings.name, pf.grantId) ' +
                              'ORDER BY fundings.name SEPARATOR \',\') fundingsData, ' +
                            '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'DRAFT\') as draftPlans, ' +
                            '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'COMPLETE\') as completePlans, ' +
                            '(SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status = \'ARCHIVED\') as archivedPlans ' +
                            'FROM projects p ' +
                              'LEFT JOIN researchDomains ON p.researchDomainId = researchDomains.id ' +
                              'LEFT JOIN users cu ON cu.id = p.createdById ' +
                              'LEFT JOIN users mu ON mu.id = p.modifiedById ' +
                              'LEFT JOIN projectCollaborators pcol ON pcol.projectId = p.id ' +
                                'LEFT JOIN users collab ON pcol.userId = collab.id ' +
                              'LEFT JOIN projectMembers pm ON pm.projectId = p.id ' +
                                'LEFT JOIN projectMemberRoles pmr ON pm.id = pmr.projectMemberId ' +
                                  'LEFT JOIN memberRoles r ON pmr.memberRoleId = r.id ' +
                              'LEFT JOIN projectFundings pf ON pf.projectId = p.id ' +
                                'LEFT JOIN affiliations fundings ON pf.affiliationId = fundings.uri ';
      const vals = [`%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`,
                    projectSearchResult.createdById.toString(), projectSearchResult.createdById.toString()];
      const whereFilters = [
        '(LOWER(p.title) LIKE ? OR LOWER(p.abstractText) LIKE ?)',
        '((SELECT COUNT(*) FROM plans WHERE projectId = p.id AND status IN (\'DRAFT\', \'COMPLETE\')) >= 1 || (SELECT COUNT(*) FROM plans WHERE projectId = p.id) = 0)',
        '(p.createdById = ? OR p.id IN (SELECT projectId FROM projectCollaborators WHERE userId = ?))'
      ];
      const groupBy = 'GROUP BY p.id, p.title, p.abstractText, p.startDate, p.endDate, p.isTestProject, ' +
                        'p.createdById, p.created, p.modifiedById, p.modified, researchDomains.description';
      const sortFields = ["p.title", "p.created", "p.modified", "p.startDate", "p.endDate", "p.isTestProject"];
      const opts = {
        cursor: null,
        limit: generalConfig.defaultSearchLimit,
        sortField: 'p.modified',
        sortDir: 'DESC',
        countField: 'p.id',
        cursorField: 'p.id',
        availableSortFields: sortFields,
      };
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, sql, whereFilters, groupBy, vals, opts, 'Test')
      expect(result).toEqual({ items: [projectSearchResult] });
    });

    it('returns an empty array if there are no matching ProjectSearchResults', async () => {
      localQuery.mockResolvedValueOnce({ items: [] });

      const result = await ProjectSearchResult.search('Test', context, 'Test', projectSearchResult.createdById);
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [] });
    });
  });
});

describe('Project', () => {
  let project;

  const projectData = {
    title: casual.sentence,
    abstractText: casual.sentences(4),
    startDate: '2024-12-13',
    endDate: '2026-01-21',
    researchDomainId: casual.integer(1, 99),
  }
  beforeEach(() => {
    project = new Project(projectData);
  });

  it('should initialize options as expected', () => {
    expect(project.title).toEqual(projectData.title);
    expect(project.abstractText).toEqual(projectData.abstractText);
    expect(project.startDate).toEqual(projectData.startDate);
    expect(project.endDate).toEqual(projectData.endDate);
    expect(project.researchDomainId).toEqual(projectData.researchDomainId);
    expect(project.isTestProject).toBe(false);
  });

  it('should return true when calling isValid if object is valid', async () => {
    expect(await project.isValid()).toBe(true);
  });

  it('should return false when calling isValid if the title field is missing', async () => {
    project.title = null;
    expect(await project.isValid()).toBe(false);
    expect(Object.keys(project.errors).length).toBe(1);
    expect(project.errors['title']).toBeTruthy();
  });

  it('should return false when calling isValid if the startDate field is not in a valid date', async () => {
    project.startDate = '123A-12-1';
    expect(await project.isValid()).toBe(false);
    expect(Object.keys(project.errors).length).toBe(1);
    expect(project.errors['startDate']).toBeTruthy();
  });

  it('should return false when calling isValid if the endDate field is not in a valid date', async () => {
    project.endDate = '123A-12-1';
    expect(await project.isValid()).toBe(false);
    expect(Object.keys(project.errors).length).toBe(1);
    expect(project.errors['endDate']).toBeTruthy();
  });

  it('should return false when calling isValid if the endDate is less than the startDate', async () => {
    project.startDate = '2025-01-21';
    project.endDate = '2025-01-01'
    expect(await project.isValid()).toBe(false);
    expect(Object.keys(project.errors).length).toBe(1);
    expect(project.errors['endDate']).toBeTruthy();
  });

  it('should return false when calling isValid if the endDate is equal to than the startDate', async () => {
    project.startDate = '2025-01-21';
    project.endDate = '2025-01-21'
    expect(await project.isValid()).toBe(false);
    expect(Object.keys(project.errors).length).toBe(1);
    expect(project.errors['endDate']).toBeTruthy();
  });

  describe('findBy Queries', () => {
    const originalQuery = Project.query;

    let localQuery;
    let context;
    let project;

    beforeEach(async () => {
      localQuery = jest.fn();
      (Project.query as jest.Mock) = localQuery;

      context = await buildMockContextWithToken(logger);

      project = new Project({
        id: casual.integer(1, 999),
        title: casual.sentence,
        abstractText: casual.sentences(4),
        startDate: '2024-12-13',
        endDate: '2026-01-21',
        researchDomainId: casual.integer(1, 99),
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
      Project.query = originalQuery;
    });

    it('findById should call query with correct params and return the default', async () => {
      localQuery.mockResolvedValueOnce([project]);
      const projectId = casual.integer(1, 999);
      const result = await Project.findById('testing', context, projectId);
      const expectedSql = 'SELECT * FROM projects WHERE id = ?';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [projectId.toString()], 'testing')
      expect(result).toEqual(project);
    });

    it('findById should return null if it finds no default', async () => {
      localQuery.mockResolvedValueOnce([]);
      const projectId = casual.integer(1, 999);
      const result = await Project.findById('testing', context, projectId);
      expect(result).toEqual(null);
    });

    it('findByUserId should call query with correct params and return the default', async () => {
      localQuery.mockResolvedValueOnce([project]);
      const userId = casual.integer(1, 999);
      const result = await Project.findByUserId('testing', context, userId);
      const expectedSql = 'SELECT * FROM projects WHERE createdById = ? ORDER BY created DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [userId.toString()], 'testing')
      expect(result).toEqual([project]);
    });

    it('findByUserId should return empty array if it finds no default', async () => {
      localQuery.mockResolvedValueOnce([]);
      const userId = casual.integer(1, 999);
      const result = await Project.findByUserId('testing', context, userId);
      expect(result).toEqual([]);
    });

    it('findByAffiliation should call query with correct params and return the default', async () => {
      localQuery.mockResolvedValueOnce([project]);
      const affiliationId = casual.url;
      const result = await Project.findByAffiliation('testing', context, affiliationId);
      let expectedSql = 'SELECT projects.* FROM projects INNER JOIN users ON projects.createdById = users.id';
      expectedSql += ' WHERE users.affiliationId = ? ORDER BY created DESC';
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, [affiliationId], 'testing')
      expect(result).toEqual([project]);
    });

    it('findByAffiliation should return empty array if it finds no default', async () => {
      localQuery.mockResolvedValueOnce([]);
      const affiliationId = casual.url;
      const result = await Project.findByAffiliation('testing', context, affiliationId);
      expect(result).toEqual([]);
    });

    it('findByOwnerAndTitle should call query with correct params and return the default', async () => {
      localQuery.mockResolvedValueOnce([project]);
      const title = casual.sentence;
      const result = await Project.findByOwnerAndTitle('testing', context, title, context.token.id);
      const expectedSql = 'SELECT * FROM projects WHERE createdById = ? AND LOWER(title) LIKE ?';
      const expectedVals = [context.token.id.toString(), `%${title.toLowerCase().trim()}%`]
      expect(localQuery).toHaveBeenCalledTimes(1);
      expect(localQuery).toHaveBeenLastCalledWith(context, expectedSql, expectedVals, 'testing')
      expect(result).toEqual(project);
    });

    it('findByOwnerAndTitle should return empty array if it finds no default', async () => {
      localQuery.mockResolvedValueOnce([]);
      const title = casual.sentence;
      const result = await Project.findByOwnerAndTitle('testing', context, title, context.token.id);
      expect(result).toEqual(null);
    });
  });

  describe('update', () => {
    let updateQuery;
    let project;

    beforeEach(() => {
      updateQuery = jest.fn();
      (Project.update as jest.Mock) = updateQuery;

      project = new Project({
        id: casual.integer(1, 999),
        title: casual.sentence,
        abstractText: casual.sentences(4),
        startDate: '2024-12-13',
        endDate: '2026-01-21',
        researchDomainId: casual.integer(1, 99),
        isTestProject: casual.boolean,
      })
    });

    it('returns the Project with errors if it is not valid', async () => {
      const localValidator = jest.fn();
      (project.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await project.update(context);
      expect(result instanceof Project).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns an error if the Project has no id', async () => {
      const localValidator = jest.fn();
      (project.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      project.id = null;
      const result = await project.update(context);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the updated Project', async () => {
      const localValidator = jest.fn();
      (project.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(true);

      updateQuery.mockResolvedValueOnce(project);

      const mockFindById = jest.fn();
      (Project.findById as jest.Mock) = mockFindById;
      mockFindById.mockResolvedValueOnce(project);

      const result = await project.update(context);
      expect(localValidator).toHaveBeenCalledTimes(1);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(Project);
    });
  });

  describe('create', () => {
    const originalInsert = Project.insert;
    let insertQuery;
    let project;

    beforeEach(() => {
      insertQuery = jest.fn();
      (Project.insert as jest.Mock) = insertQuery;

      project = new Project({
        title: casual.sentence,
        abstractText: casual.sentences(4),
        startDate: '2024-12-13',
        endDate: '2026-01-21',
        researchDomainId: casual.integer(1, 99),
        isTestProject: casual.boolean,
      });
    });

    afterEach(() => {
      Project.insert = originalInsert;
    });

    it('returns the Project without errors if it is valid', async () => {
      const localValidator = jest.fn();
      (project.isValid as jest.Mock) = localValidator;
      localValidator.mockResolvedValueOnce(false);

      const result = await project.create(context);
      expect(result instanceof Project).toBe(true);
      expect(localValidator).toHaveBeenCalledTimes(1);
    });

    it('returns the Project with errors if it is invalid', async () => {
      project.title = undefined;
      const response = await project.create(context);
      expect(response.errors['title']).toBe('Title can\'t be blank');
    });

    it('returns the Project with an error if the question already exists', async () => {
      const mockFindBy = jest.fn();
      (Project.findByOwnerAndTitle as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValueOnce(project);

      const result = await project.create(context);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(1);
      expect(result.errors['general']).toBeTruthy();
    });

    it('returns the newly added Project', async () => {
      const mockFindBy = jest.fn();
      (Project.findByOwnerAndTitle as jest.Mock) = mockFindBy;
      mockFindBy.mockResolvedValueOnce(null);

      const mockFindById = jest.fn();
      (Project.findById as jest.Mock) = mockFindById;
      mockFindById.mockResolvedValueOnce(project);

      const result = await project.create(context);
      expect(mockFindBy).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(insertQuery).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(Project);
    });
  });

  describe('delete', () => {
    let project;

    beforeEach(() => {
      project = new Project({
        id: casual.integer(1, 999),
        title: casual.sentence,
      });
    })

    it('returns null if the Project has no id', async () => {
      project.id = null;
      expect(await project.delete(context)).toBe(null);
    });

    it('returns null if it was not able to delete the record', async () => {
      const deleteQuery = jest.fn();
      (Project.delete as jest.Mock) = deleteQuery;

      deleteQuery.mockResolvedValueOnce(null);
      expect(await project.delete(context)).toBe(null);
    });

    it('returns the Project if it was able to delete the record', async () => {
      const deleteQuery = jest.fn();
      (Project.delete as jest.Mock) = deleteQuery;
      deleteQuery.mockResolvedValueOnce(project);

      const mockFindById = jest.fn();
      (Project.findById as jest.Mock) = mockFindById;
      mockFindById.mockResolvedValueOnce(project);

      const result = await project.delete(context);
      expect(Object.keys(result.errors).length).toBe(0);
      expect(result).toBeInstanceOf(Project);
    });
  });
});
