import { generalConfig } from "../config/generalConfig";
import { awsConfig } from "../config/awsConfig";
import { mysqlPoolConfig } from "../config/mysqlConfig";
import { Logger } from "pino";
import { prepareObjectForLogs } from "../logger";
import { MyContext } from "../context";
import { DMPToolDMPType } from "@dmptool/types";
import { Plan } from '../models/Plan';
import {
  ConnectionParams,
  deleteDMP,
  DMPExists,
  DMPVersionType,
  DynamoConnectionParams,
  DMP_LATEST_VERSION,
  EnvironmentEnum,
  getDMPs,
  createDMP,
  planToDMPCommonStandard,
  tombstoneDMP,
  updateDMP, getDMPVersions,
} from "@dmptool/utils";

// Compile the parameters needed to connect to the DynamoDB table.
const GetDynamoConfigParams = (logger: Logger): DynamoConnectionParams => {
  return {
    tableName: awsConfig.dynamo.tableName,
    region: awsConfig.region,
    maxAttempts: awsConfig.dynamo.maxQueryAttempts,
    logger: logger,
  };
}

// Compile the parameters needed to connect to the RDS MySQL database.
const GetRdsConfigParams = (logger: Logger): ConnectionParams => {
  return {
    host: mysqlPoolConfig.host,
    port: mysqlPoolConfig.port,
    user: mysqlPoolConfig.user,
    password: mysqlPoolConfig.password,
    database: mysqlPoolConfig.database,
    logger
  };
}

// Convert the environment name to an EnvironmentEnum value.
const envToEnum = (env: string): EnvironmentEnum => {
  switch (env) {
    case 'stg':
      return EnvironmentEnum.STG;
    case 'prd':
      return EnvironmentEnum.PRD;
    default:
      return EnvironmentEnum.DEV;
  }
}

/**
 * Determines whether the specified DMP ID has a maDMP record in the DynamoDB table.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param dmpId The DMP ID to check.
 * @returns True if the maDMP exists in the DynamoDB table, false otherwise.
 */
export const maDMPExists = async (
  context: MyContext,
  dmpId: string
): Promise<boolean> => {
  try {
    return await DMPExists(GetDynamoConfigParams(context.logger), dmpId);
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs(err),
      'Error checking DynamoDB for DMP existence'
    );
    return false;
  }
}

/**
 * Fetch the timestamps of all versions of the specified DMP in the DynamoDB table.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * @param dmpId The DMP ID to fetch versions for.
 * @returns An array of DMPVersionType objects containing the timestamps of each
 * version sorted from the newest to the oldest, or an empty array if no versions exist.
 * @throws Error if there was an error fetching the versions from DynamoDB.
 */
export const getMaDMPVersionTimestamps = async (
  context: MyContext,
  dmpId: string
): Promise<DMPVersionType[]> => {
  try {
    return await getDMPVersions(GetDynamoConfigParams(context.logger), dmpId);
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ dmpId, err }),
      'Error getting version list for maDMP from DynamoDB'
    );
    throw(err);
  }
}

/**
 * Fetch the specified DMP metadata record
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param dmpId The DMP ID to fetch.
 * @param version The version of the DMP to fetch. Defaults to the latest version.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * extensions to the RDA Common Standard. Defaults to true.
 * @returns The DMP metadata record or an empty array if the DMP does not exist.
 * @throws Error if there was an error fetching the DMP metadata record.
 */
export const getMaDMP = async (
  context: MyContext,
  dmpId: string,
  version: string | null,
  includeExtensions = true
): Promise<DMPToolDMPType[] | []> => {
  try {
    return await getDMPs(
      GetDynamoConfigParams(context.logger),
      `https://${generalConfig.domain}`,
      dmpId,
      version || DMP_LATEST_VERSION,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ dmpId, version, err }),
      'Error getting maDMP from DynamoDB'
    );
    throw(err);
  }
}

/**
 * Create the initial maDMP metadata record for the PLan in the DynamoDB table.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param plan The Plan instance containing the DMP ID to create.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * Extensions in the response. Defaults to true.
 * @returns The created maDMP metadata record or null if the DMP already exists.
 * @throws Error if there was an error creating the maDMP metadata record.
 */
export const createMaDMP = async (
  context: MyContext,
  plan: Plan,
  includeExtensions = true
): Promise<DMPToolDMPType | null> => {
  try {
    return await createDMP(
      GetDynamoConfigParams(context.logger),
      `https://${generalConfig.domain}`,
      plan.dmpId,
      await convertPlanToMaDMP(context, plan.id, includeExtensions),
      DMP_LATEST_VERSION,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ dmpId: plan.dmpId, title: plan.title, err }),
      'Error creating initial maDMP in DynamoDB'
    );
    throw(err);
  }
}

/**
 * Update an existing maDMP metadata record in the DynamoDB table. The updateDMP
 * function will handle any versioning needed.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param plan The Plan instance containing the DMP ID to update.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * Extensions in the response. Defaults to true.
 * @returns The updated maDMP metadata record or null if the DMP does not exist.
 * @throws Error if there was an error updating the maDMP metadata record.
 */
export const updateMaDMP = async (
  context: MyContext,
  plan: Plan,
  includeExtensions = true,
): Promise<DMPToolDMPType | null> => {
  try {
    return await updateDMP(
      GetDynamoConfigParams(context.logger),
      `https://${generalConfig.domain}`,
      plan.dmpId,
      await convertPlanToMaDMP(context, plan.id, includeExtensions),
      awsConfig.dynamo.versioningGracePeriodInMS,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({
        dmpId: plan.dmpId,
        title: plan.title,
        modified: plan.modified,
        err
      }),
      'Error updating maDMP in DynamoDB'
    );
    throw(err);
  }
}

/**
 * Tombstone the specified maDMP metadata record in the DynamoDB table.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param plan The Plan instance containing the DMP ID to tombstone.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * Extensions in the response. Defaults to true.
 * @returns The tombstoned maDMP metadata record or null if the DMP does not exist.
 * @throws Error if there was an error tombstoning the maDMP metadata record.
 */
export const tombstoneMaDMP = async (
  context: MyContext,
  plan: Plan,
  includeExtensions = true,
): Promise<DMPToolDMPType> => {
  try {
    return await tombstoneDMP(
      GetDynamoConfigParams(context.logger),
      `https://${generalConfig.domain}`,
      plan.dmpId,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ dmpId: plan.dmpId, err }),
      'Error tombstoning maDMP in DynamoDB'
    );
    throw(err);
  }
}

/**
 * Delete the specified maDMP metadata record from the DynamoDB table.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param plan The Plan instance containing the DMP ID to delete.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * Extensions in the response. Defaults to true.
 * @returns The deleted maDMP metadata record or null if the DMP does not exist.
 * @throws Error if there was an error deleting the maDMP metadata record.
 */
export const deleteMaDMP = async (
  context: MyContext,
  plan: Plan,
  includeExtensions = true,
): Promise<DMPToolDMPType> => {
  try {
    return await deleteDMP(
      GetDynamoConfigParams(context.logger),
      `https://${generalConfig.domain}`,
      plan.dmpId,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ dmpId: plan.dmpId, err }),
      'Error deleting maDMP from DynamoDB'
    );
    throw(err);
  }
}

/**
 * Convert a Plan record to a maDMP record.
 *
 * @param context The Apollo Server Context object passed in to the Resolver on
 * each request.
 * @param planId The Plan ID to convert.
 * @param includeExtensions The flag to indicate whether to include the DMP Tool
 * Extensions. Defaults to true.
 * @returns The converted maDMP record.
 * @throws Error if the Plan cannot be converted to a maDMP record.
 */
export const convertPlanToMaDMP = async (
  context: MyContext,
  planId: number,
  includeExtensions = true,
): Promise<DMPToolDMPType> => {
  try {
    return await planToDMPCommonStandard(
      GetRdsConfigParams(context.logger),
      generalConfig.applicationName,
      `https://${generalConfig.domain}`,
      envToEnum(generalConfig.env),
      planId,
      includeExtensions
    );
  } catch (err) {
    context.logger.error(
      prepareObjectForLogs({ planId, err }),
      'Error converting Plan to maDMP'
    );
    throw(err);
  }
}
