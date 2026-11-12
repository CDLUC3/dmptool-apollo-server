import { MySqlModel } from "./MySqlModel.js";
import { MyContext } from "../context.js";
import { getCurrentDate, stripIdentifierBaseURL } from "../utils/helpers.js";
import { toError } from "graphql/jsutils/toError.js";
import { toErrorMessage } from "@dmptool/utils";
import {
  AssociatedObjectInterface,
  DMP_INDEX_NAME,
  fetchAssociatedObjects,
  generateIndexItem,
  PlanIndexDocumentInterface,
  ProjectPlanResponse,
  PropertyDefinition,
} from "../services/indexDMPService.js";
import { PlanMember, ProjectMember } from "./Member.js";
import { PlanFunding, ProjectFunding } from "./Funding.js";
import { Answer } from "./Answer.js";
import { OpenSearch } from "../datasources/openSearch.js";

export enum DataSyncJobStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// This interface represents the structure of the data that will be synchronized
// with OpenSearch or DynamoDB. It is a union of possible types
//
// TODO: Update to `type DataSyncItem = PlanIndexDocumentInterface | OtherType`
type DataSyncItem = PlanIndexDocumentInterface;

/**
 * An abstract class that represents a data synchronization job for updating
 * ephemeral data in OpenSearch and DynamoDB.
 */
export abstract class DataSyncJob extends MySqlModel {
  public jobName: string;
  public status: DataSyncJobStatus;
  public cursorTimestamp?: string;
  public cursorId?: number;
  public lockedAt?: string;
  public lastRunAt?: string;
  public lastSuccessAt?: string;
  public failureCount: number;
  public errorMessage?: string;

  private static tableName = 'syncJobStatus';

  constructor(options: Partial<DataSyncJob> = {}) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);
    this.jobName = options.jobName;
    this.cursorTimestamp = options.cursorTimestamp;
    this.cursorId = options.cursorId;
    this.lockedAt = options.lockedAt;
    this.lastRunAt = options.lastRunAt;
    this.lastSuccessAt = options.lastSuccessAt;
    this.failureCount = options.failureCount ?? 0;
    this.errorMessage = options.errorMessage;
  }

  /**
   * Validates the data synchronization job instance. It checks if the required
   * fields are present and adds errors to the instance if any validation fails.
   */
  async isValid(): Promise<boolean> {
    await super.isValid()

    if (this.jobName === null) this.addError('jobName', 'Job name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Prepare the data sync for saving.
   */
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.jobName = this.jobName?.trim();
  }

  /**
   * Creates a new data synchronization job record in the database.
   *
   * @param reference a reference string for the job creation
   * @param context the Apollo context
   * @returns void
   */
  async create(reference: string, context: MyContext): Promise<boolean> {
    if (!await this.isValid()) {
      context.logger.error({ jobName: this.jobName, errors: this.errors }, 'Data sync job is not valid');
      return false;
    }

    this.prepForSave();
    const result: number | null = await MySqlModel.insert(context, DataSyncJob.tableName, this, reference);
    return result !== null;
  }

  /**
   * Deletes the data synchronization job record from the database.
   *
   * @param context the Apollo context
   * @returns void
   */
  async delete(context: MyContext): Promise<boolean> {
    return await MySqlModel.delete(context, DataSyncJob.tableName, this.id);
  }

  /**
   * Locks the job for execution by updating its status to RUNNING and setting
   * the locked_at timestamp. If the job is already locked (status is RUNNING),
   * it will not update the status.
   *
   * @param reference a reference string for the job locking
   * @param context the Apollo context
   * @returns true if the job was successfully locked, false otherwise
   * @private
   */
  private async lockJob(reference: string, context: MyContext): Promise<boolean> {
    const existingStatus = await MySqlModel.query(
      context,
      `SELECT status FROM ${DataSyncJob.tableName} WHERE jobName = ?`,
      [this.jobName],
      reference,
    )
    if (existingStatus.length > 0 && existingStatus[0].status === DataSyncJobStatus.RUNNING) {
      return false;
    }

    context.logger.debug({ jobName: this.jobName }, 'Locking data sync job for execution');
    this.status = DataSyncJobStatus.RUNNING;
    this.lockedAt = getCurrentDate();
    this.lastRunAt = getCurrentDate();

    const locked: MySqlModel | null = await MySqlModel.update(context, DataSyncJob.tableName, this, reference);
    return locked && !locked.hasErrors();
  }

  /**
   * Saves an error message to the job instance, updates its status to FAILED,
   * increments the failure count, and persists the changes to the database.
   *
   * @param reference a reference string for the error saving
   * @param context the Apollo context
   * @param error the error message to save
   * @param cursorId the ID of the last processed item (optional)
   * @param cursorTimestamp the timestamp of the last processed item (optional)
   * @returns void
   * @private
   */
  private async saveError(
    reference: string,
    context: MyContext,
    error: string,
    cursorId?: number,
    cursorTimestamp?: string
  ): Promise<void> {
    this.status = DataSyncJobStatus.FAILED;
    this.failureCount += 1;
    this.errorMessage = error || 'An unknown error occurred during data synchronization.';
    this.cursorId = cursorId;
    this.cursorTimestamp = cursorTimestamp;

    const resp: MySqlModel | null = await MySqlModel.update(context, DataSyncJob.tableName, this, reference);
    if (resp || !resp.hasErrors()) {
      context.logger.error(
        { jobName: this.jobName, error, cursorId },
        'Data synchronization job failed with error'
      );
    } else {
      context.logger.error(
        { jobName: this.jobName, error, cursorId },
        'Unable to save error message for synchronization'
      );
    }
  }

  /**
   * Starts the data synchronization job. It first attempts to lock the job for
   * execution. If the job is already locked (status is RUNNING), it will not
   * proceed with execution. If the job is successfully locked, it will perform
   * the necessary synchronization tasks and update the job status accordingly.
   *
   * @param reference a reference string for the job execution
   * @param context the Apollo context
   * @param batchSize the number of items to fetch and synchronize in each batch (default: 500)
   * @returns void
   * @throws Error if the job is already locked or if any errors occur during execution
   * @remarks This method should be overridden by subclasses to implement the specific synchronization logic.
   */
  async start(reference: string, context: MyContext, batchSize = 500): Promise<void> {
    if (await this.lockJob(reference, context)) {
      let hasMore = true;
      while (hasMore) {
        const batch: DataSyncItem[] = await this.fetchDataToSync(reference, context, batchSize);

        if (!batch || batch.length === 0) {
          // eslint-disable-next-line no-useless-assignment
          hasMore = false;
          break;
        }
        for (const item of batch) {
          await this.performSync(reference, context, item);
          this.cursorId = item.cursorId;
          this.cursorTimestamp = item.modified;
        }
        // Persist progress after each batch chunk
        await MySqlModel.update(context, DataSyncJob.tableName, this, reference);
      }

      // First see where we left off and continue from there
      const data: DataSyncItem[] = await this.fetchDataToSync(reference, context, batchSize);

      if (Array.isArray(data)) {
        // Loop through the data and perform synchronization for each item
        for (const item of data) {
          try {
            const synced: boolean = await this.performSync(reference, context, item);

            // If the synchronization fails, save the error and throw an exception
            // to stop further processing
            if (!synced) {
              const msg = `Failed to synchronize item: ${JSON.stringify(item?.cursorId)}`;
              context.logger.error({ jobName: this.jobName, itemId: item?.cursorId }, msg);
              await this.saveError(reference, context, msg, item?.cursorId, item?.modified);
              throw new Error(msg);
            }

            context.logger.debug(
              { jobName: this.jobName, itemId: item?.cursorId },
              `Successfully synchronized item ${item?.cursorId}`
            );

          } catch (error) {
            // If an uncaught error occurs during synchronization, save the
            // error and rethrow it
            const errorMessage = toErrorMessage(toError(error));
            context.logger.error({ jobName: this.jobName, itemId: item?.cursorId, error: errorMessage }, errorMessage);
            await this.saveError(reference, context, errorMessage, item?.cursorId, item?.modified);
            throw error;
          }
        }

        // If all items were processed successfully, update the job status to COMPLETED
        this.status = DataSyncJobStatus.COMPLETED;
        this.lastSuccessAt = getCurrentDate();
        this.failureCount = 0;
        this.errorMessage = null;
        await MySqlModel.update(context, DataSyncJob.tableName, this, reference);
      } else {
        context.logger.debug({ jobName: this.jobName }, 'No data to synchronize for this job.');
      }
    } else {
      throw new Error(`Data sync job "${this.jobName}" is already locked for execution.`);
    }
  }

  /**
   * Abstract method to fetch the next batch of data to be synchronized.
   * Subclasses should implement this method to define how to retrieve the data
   * for synchronization.
   *
   * @param reference a reference string for the data fetching
   * @param context the Apollo context
   * @param batchSize the number of items to fetch in each batch
   * @returns void
   */
  abstract fetchDataToSync(reference: string, context: MyContext, batchSize: number): Promise<DataSyncItem[]>;

  /**
   * Abstract method to perform the synchronization of data. Subclasses should implement
   * this method to define how to synchronize the fetched data with the target system.
   *
   * @param reference a reference string for the synchronization
   * @param context the Apollo context
   * @param item the data item to be synchronized
   * @returns void
   */
  abstract performSync(reference: string, context: MyContext, item: DataSyncItem): Promise<boolean>;
}

/**
 * A class that represents a data synchronization job specifically for
 * synchronizing DMP data with OpenSearch.
 */
export class OpenSearchDMPSync extends DataSyncJob {
  constructor(options: Partial<DataSyncJob> = {}) {
    super(options);

    this.jobName = 'OpenSearchDMPSync';
  }

  /**
   * Fetches the next batch of DMP data to be synchronized with OpenSearch.
   *
   * @param reference a reference string for the data fetching
   * @param context the Apollo context
   * @param batchSize the number of items to fetch in each batch
   * @returns an array of PlanIndexDocumentInterface objects representing the DMP data to be synchronized
   */
  async fetchDataToSync(reference: string, context: MyContext, batchSize: number): Promise<PlanIndexDocumentInterface[]> {
    const tstamp: string = this.cursorTimestamp || '1970-01-01 00:00:00.000';

    // Fetch the next batch of Plans that have been modified since the last
    // synchronization, using the cursorTimestamp and cursorId to determine
    // where to continue from. The query orders the results by modified timestamp
    // and id to ensure consistent ordering.
    const projectPlanResponses: ProjectPlanResponse[] = await MySqlModel.query(
      context,
      `SELECT p.id AS plan_id, p.dmpId AS dmp_id, p.projectId AS project_id,
        p.affiliationId AS affiliation_id, p.title AS plan_title, p.languageId AS language_id,
        p.visibility, p.featured, p.registered, p.created, p.modified,
        proj.title AS project_title, proj.abstractText AS abstract_text,
        proj.startDate AS project_start, proj.endDate AS project_end,
        proj.isTestProject AS is_test_project
      FROM plan p JOIN project proj ON p.projectId = proj.id
      WHERE p.modified >= ?
        AND (p.modified > ? OR (p.modified = ? AND p.id > ?))
      ORDER BY p.modified ASC, p.id ASC
      LIMIT ?;`,
      [tstamp, tstamp, tstamp, (this.cursorId || 0).toString(), (batchSize || 500).toString()],
      reference
    );

    const associatedObjects: AssociatedObjectInterface = await fetchAssociatedObjects(
      reference,
      context,
      projectPlanResponses.map((plan: ProjectPlanResponse) => plan.project_id) || [],
      projectPlanResponses.map((plan: ProjectPlanResponse) => plan.plan_id) || []
    );

    // There are many plans and projects, so we need to reconcile the associated
    // objects for each plan and project pair into a single set of members,
    // institutions and funding
    return projectPlanResponses.map((projectPlanResponse: ProjectPlanResponse): PlanIndexDocumentInterface => {
      const { project_id, plan_id } = projectPlanResponse;
      const projectMembers: ProjectMember[] = associatedObjects.projectMembers.filter((m: ProjectMember): boolean => {
        return m.projectId === project_id
      });
      const projectFunding: ProjectFunding[] = associatedObjects.projectFunding.filter((f: ProjectFunding): boolean => {
        return f.projectId === project_id
      });
      const planMembers: PlanMember[] = associatedObjects.planMembers.filter((m: PlanMember): boolean => {
        return m.planId === plan_id
      });
      const planFunding: PlanFunding[] = associatedObjects.planFunding.filter((f: PlanFunding): boolean => {
        return f.planId === plan_id
      });
      const planAnswers: Answer[] = associatedObjects.answers.filter((a: Answer): boolean => {
        return a.planId === plan_id
      });

      return generateIndexItem(
        {
          id: project_id,
          title: projectPlanResponse.project_title,
          abstractText: projectPlanResponse.abstract_text,
          startDate: projectPlanResponse.project_start,
          endDate: projectPlanResponse.project_end,
          isTestProject: !!projectPlanResponse.is_test_project,
        },
        {
          id: plan_id,
          dmpId: projectPlanResponse.dmp_id,
          affiliationId: projectPlanResponse.affiliation_id,
          title: projectPlanResponse.title,
          languageId: projectPlanResponse.language_id,
          visibility: projectPlanResponse.visibility,
          featured: !!projectPlanResponse.featured,
          registered: projectPlanResponse.registered,
          created: projectPlanResponse.created,
          modified: projectPlanResponse.modified,
        },
        associatedObjects.affiliations,
        projectMembers,
        projectFunding,
        planMembers,
        planFunding,
        planAnswers,
        associatedObjects.alternateIdentifiers,
        associatedObjects.relatedWorks
      );
    });
  }

  /**
   * Performs the synchronization of a single DMP data item with OpenSearch.
   *
   * @param reference a reference string for the synchronization
   * @param context the Apollo context
   * @param item the PlanIndexDocumentInterface representing the DMP data to be synchronized
   * @returns true if the synchronization was successful, false otherwise
   */
  async performSync(reference: string, context: MyContext, item: PlanIndexDocumentInterface): Promise<boolean> {
    const openSearch: OpenSearch = context.dataSources.openSearchServerlessDataSource;
    // Fire off the OpenSearch update
    context.logger.debug({ reference, index: DMP_INDEX_NAME, item }, "Indexing Plan");
    try{
      const dmpId: string = stripIdentifierBaseURL(item.dmp_id).trim();
      await openSearch.updateIndexItem(DMP_INDEX_NAME, PropertyDefinition, dmpId, item);
    } catch (error) {
      context.logger.error({ reference, error }, "Error indexing Plan");
      return false;
    }
    return true;
  }
}
