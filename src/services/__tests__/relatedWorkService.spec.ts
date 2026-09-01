import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// ---------------------------------------------------------------------------
// No jest.unstable_mockModule needed at all in this file — every model here
// is real, spied per-test via jest.spyOn, and every fixture handed to a
// spied method is a genuine `new X(...)` instance rather than a plain
// object literal, so none of the asX(...) cast helpers used elsewhere in
// this migration are needed either.
// ---------------------------------------------------------------------------
import type { MyContext } from '../../context.js';
import type { AddRelatedWorkManualInput } from '../../types.js';

const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import('../../logger.js');
const { Plan } = await import('../../models/Plan.js');
const {
  AcceptedWork,
  RelatedWork,
  RelationType,
  Work,
  WorkVersion,
} = await import('../../models/RelatedWork.js');
const { NOT_FOUND_ERROR_CODE } = await import('../../utils/graphQLErrors.js');
const {
  addAcceptedWork,
  removeAcceptedWork,
  UpdateAcceptedWork,
} = await import('../relatedWorkService.js');

describe('relatedWorkService', () => {
  let context: MyContext;
  let plan: InstanceType<typeof Plan>;

  const reference = 'related-work-service-test';

  const buildInput = (
    overrides: Partial<AddRelatedWorkManualInput> = {},
  ): AddRelatedWorkManualInput =>
  ({
    planId: 42,
    doi: '10.1234/example-doi',
    hash: 'a1b2',
    workType: 'DATASET',
    relationType: 'CITES',
    publicationDate: '2026-01-01',
    title: 'A related work title',
    abstractText: 'Abstract',
    authors: [{ givenName: 'Alex', surname: 'Doe' }],
    institutions: [{ name: 'UC3' }],
    funders: [{ name: 'NSF' }],
    awards: [{ awardId: 'NSF-123' }],
    publicationVenue: 'Zenodo',
    sourceName: 'OpenAlex',
    sourceUrl: 'https://example.org/work',
    ...overrides,
  } as AddRelatedWorkManualInput);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    context = await buildMockContextWithToken(logger);
    plan = new Plan({ id: 42, projectId: 7, title: 'Plan' });
  });

  describe('addAcceptedWork', () => {
    it('creates work/workVersion/relatedWork and returns accepted work', async () => {
      const input = buildInput();

      const createdWork = new Work({ id: 10, doi: input.doi });
      jest.spyOn(Work, 'findByDoi').mockResolvedValueOnce(null);
      jest.spyOn(Work.prototype, 'create').mockResolvedValue(createdWork);

      const createdVersion = new WorkVersion({
        id: 20,
        workId: createdWork.id,
        hash: Buffer.from(input.hash.toString(), 'hex'),
        workType: input.workType,
        authors: [],
        institutions: [],
        funders: [],
        awards: [],
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
      });
      const findByDoiAndHashSpy = jest
        .spyOn(WorkVersion, 'findByDoiAndHash')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(WorkVersion.prototype, 'create')
        .mockResolvedValue(createdVersion);

      const createdRelatedWork = new RelatedWork({
        id: 30,
        planId: plan.id,
        workVersionId: createdVersion.id,
        status: 'ACCEPTED',
        sourceType: 'USER_ADDED',
        score: 1,
        scoreMax: 1,
      });
      jest
        .spyOn(RelatedWork.prototype, 'create')
        .mockResolvedValue(createdRelatedWork);

      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: input.doi,
        workId: createdWork.id,
        workVersionId: createdVersion.id,
        relatedWorkId: createdRelatedWork.id,
        workType: input.workType,
        relationType: input.relationType,
      });
      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);

      const result = await addAcceptedWork(reference, context, plan, input);

      expect(result).toBe(accepted);
      expect(Work.prototype.create).toHaveBeenCalledTimes(1);
      expect(WorkVersion.prototype.create).toHaveBeenCalledTimes(1);
      expect(RelatedWork.prototype.create).toHaveBeenCalledTimes(1);

      const hashArg = findByDoiAndHashSpy.mock.calls[0][3];
      expect(Buffer.isBuffer(hashArg)).toBe(true);
      expect(hashArg.toString('hex')).toBe(input.hash);
    });

    it('returns an error when found/created work has errors', async () => {
      const input = buildInput();

      const badWork = new Work({
        id: 10,
        doi: input.doi,
        errors: { general: 'bad work' },
      });
      jest.spyOn(Work, 'findByDoi').mockResolvedValue(badWork);
      jest.spyOn(WorkVersion, 'findByDoiAndHash').mockResolvedValue(
        new WorkVersion({
          id: 20,
          workId: 10,
          hash: Buffer.from(input.hash.toString(), 'hex'),
          workType: input.workType,
          authors: [],
          institutions: [],
          funders: [],
          awards: [],
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl,
        }),
      );
      jest.spyOn(RelatedWork.prototype, 'create').mockResolvedValue(
        new RelatedWork({
          id: 99,
          planId: plan.id,
          workVersionId: 20,
          status: 'ACCEPTED',
          sourceType: 'USER_ADDED',
          score: 1,
          scoreMax: 1,
        }),
      );

      const result = await addAcceptedWork(reference, context, plan, input);

      expect(result.errors.general).toBe('Unable to create or find work');
      expect(RelatedWork.prototype.create).not.toHaveBeenCalled();
    });

    it('returns an error when work version creation fails', async () => {
      const input = buildInput();

      jest.spyOn(Work, 'findByDoi').mockResolvedValue(
        new Work({ id: 10, doi: input.doi }),
      );
      jest.spyOn(WorkVersion, 'findByDoiAndHash').mockResolvedValueOnce(null);
      jest.spyOn(WorkVersion.prototype, 'create').mockResolvedValue(
        new WorkVersion({
          id: 20,
          workId: 10,
          hash: Buffer.from(input.hash.toString(), 'hex'),
          errors: { general: 'bad version' },
        }),
      );
      jest.spyOn(RelatedWork.prototype, 'create').mockResolvedValue(
        new RelatedWork({
          id: 99,
          planId: plan.id,
          workVersionId: 20,
          status: 'ACCEPTED',
          sourceType: 'USER_ADDED',
          score: 1,
          scoreMax: 1,
        }),
      );

      const result = await addAcceptedWork(reference, context, plan, input);

      expect(result.errors.general).toBe(
        'Unable to create or find a version of the work',
      );
      expect(RelatedWork.prototype.create).not.toHaveBeenCalled();
    });

    it('returns an error when related work creation fails', async () => {
      const input = buildInput();

      jest.spyOn(Work, 'findByDoi').mockResolvedValue(
        new Work({ id: 10, doi: input.doi }),
      );
      jest.spyOn(WorkVersion, 'findByDoiAndHash').mockResolvedValue(
        new WorkVersion({
          id: 20,
          workId: 10,
          hash: Buffer.from(input.hash.toString(), 'hex'),
          workType: input.workType,
          authors: [],
          institutions: [],
          funders: [],
          awards: [],
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl,
        }),
      );
      jest.spyOn(RelatedWork.prototype, 'create').mockResolvedValue(
        new RelatedWork({
          id: 30,
          planId: plan.id,
          workVersionId: 20,
          errors: { general: 'could not save' },
        }),
      );

      const result = await addAcceptedWork(reference, context, plan, input);

      expect(result.errors.general).toBe('Unable to create related work');
    });
  });

  describe('UpdateAcceptedWork', () => {
    it('returns accepted work unchanged when workType is unchanged', async () => {
      const input = buildInput({ workType: 'DATASET' });
      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: input.doi,
        workVersionId: 20,
        relatedWorkId: 30,
        workType: input.workType,
      });
      const findBySpy = jest.spyOn(WorkVersion, 'findById');
      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);

      const result = await UpdateAcceptedWork(reference, context, plan, input);

      expect(result).toBe(accepted);
      expect(findBySpy).not.toHaveBeenCalled();
    });

    it('throws (current behavior) when accepted work is not found', async () => {
      jest.spyOn(AcceptedWork, 'findByPlanIdAndDoi').mockResolvedValue(null);

      await expect(
        UpdateAcceptedWork(reference, context, plan, buildInput()),
      ).rejects.toBeInstanceOf(TypeError);
    });

    it('adds an error when source workVersion cannot be found', async () => {
      const input = buildInput({ workType: 'SOFTWARE' });
      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: input.doi,
        workVersionId: 20,
        relatedWorkId: 30,
        workType: 'DATASET',
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(WorkVersion, 'findById').mockResolvedValue(null);

      const result = await UpdateAcceptedWork(reference, context, plan, input);

      expect(result.errors.general).toBe('Unable to update version of work');
    });

    it('updates related work relation type when work type changes', async () => {
      const input = buildInput({
        workType: 'SOFTWARE',
        relationType: 'CITES',
      });

      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: input.doi,
        workVersionId: 20,
        relatedWorkId: 30,
        workType: 'DATASET',
      });

      const currentVersion = new WorkVersion({
        id: 20,
        workId: 10,
        hash: Buffer.from(input.hash.toString(), 'hex'),
        workType: 'DATASET',
        authors: [],
        institutions: [],
        funders: [],
        awards: [],
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
      });

      const related = new RelatedWork({
        id: 30,
        planId: plan.id,
        workVersionId: 20,
        relationType: RelationType.REFERENCES,
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(WorkVersion, 'findById').mockResolvedValue(currentVersion);
      jest
        .spyOn(WorkVersion.prototype, 'create')
        .mockResolvedValue(new WorkVersion({ ...currentVersion, id: 21 }));
      jest
        .spyOn(RelatedWork, 'findByPlanAndWorkVersionId')
        .mockResolvedValue(related);
      jest.spyOn(RelatedWork.prototype, 'update').mockResolvedValue(related);

      const result = await UpdateAcceptedWork(reference, context, plan, input);

      expect(result.errors.workType).toBeUndefined();
      expect(related.relationType).toBe(RelationType.CITES);
      expect(RelatedWork.prototype.update).toHaveBeenCalledTimes(1);
    });

    it('adds an error when related work cannot be updated/found', async () => {
      const input = buildInput({
        workType: 'SOFTWARE',
      });

      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: input.doi,
        workVersionId: 20,
        relatedWorkId: 30,
        workType: 'DATASET',
      });

      const currentVersion = new WorkVersion({
        id: 20,
        workId: 10,
        hash: Buffer.from(input.hash.toString(), 'hex'),
        workType: 'DATASET',
        authors: [],
        institutions: [],
        funders: [],
        awards: [],
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(WorkVersion, 'findById').mockResolvedValue(currentVersion);
      jest
        .spyOn(WorkVersion.prototype, 'create')
        .mockResolvedValue(new WorkVersion({ ...currentVersion, id: 21 }));
      jest
        .spyOn(RelatedWork, 'findByPlanAndWorkVersionId')
        .mockResolvedValue(null);

      const result = await UpdateAcceptedWork(reference, context, plan, input);

      expect(result.errors.workType).toBe('Unable to update related work');
    });
  });

  describe('removeAcceptedWork', () => {
    it('throws (current behavior) when accepted work is not found', async () => {
      jest.spyOn(AcceptedWork, 'findByPlanIdAndDoi').mockResolvedValue(null);

      await expect(
        removeAcceptedWork(reference, context, plan, '10.1000/missing'),
      ).rejects.toBeInstanceOf(TypeError);
    });

    it('throws not found when related work is missing', async () => {
      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: '10.1234/example-doi',
        workVersionId: 20,
        relatedWorkId: 30,
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(RelatedWork, 'findById').mockResolvedValue(null);

      await expect(
        removeAcceptedWork(reference, context, plan, accepted.doi),
      ).rejects.toMatchObject({
        extensions: { code: NOT_FOUND_ERROR_CODE },
      });
    });

    it('adds an error when delete fails', async () => {
      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: '10.1234/example-doi',
        workVersionId: 20,
        relatedWorkId: 30,
      });

      const related = new RelatedWork({
        id: accepted.relatedWorkId,
        planId: plan.id,
        workVersionId: accepted.workVersionId,
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(RelatedWork, 'findById').mockResolvedValue(related);
      jest.spyOn(RelatedWork.prototype, 'delete').mockResolvedValue(
        new RelatedWork({
          id: related.id,
          planId: related.planId,
          workVersionId: related.workVersionId,
          errors: { general: 'failed delete' },
        }),
      );

      const result = await removeAcceptedWork(
        reference,
        context,
        plan,
        accepted.doi,
      );

      expect(result.errors.general).toBe('Unable to delete related work');
    });

    it('returns accepted work when delete succeeds', async () => {
      const accepted = new AcceptedWork({
        planId: plan.id,
        doi: '10.1234/example-doi',
        workVersionId: 20,
        relatedWorkId: 30,
      });

      const related = new RelatedWork({
        id: accepted.relatedWorkId,
        planId: plan.id,
        workVersionId: accepted.workVersionId,
      });

      jest
        .spyOn(AcceptedWork, 'findByPlanIdAndDoi')
        .mockResolvedValue(accepted);
      jest.spyOn(RelatedWork, 'findById').mockResolvedValue(related);
      jest.spyOn(RelatedWork.prototype, 'delete').mockResolvedValue(related);

      const result = await removeAcceptedWork(
        reference,
        context,
        plan,
        accepted.doi,
      );

      expect(result).toBe(accepted);
      expect(result.errors.general).toBeUndefined();
    });
  });
});