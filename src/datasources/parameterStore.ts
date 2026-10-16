import {
  GetParameterCommand,
  GetParameterCommandOutput,
  SSMClient
} from '@aws-sdk/client-ssm';
import { MyContext } from "../context.js";
import { prepareObjectForLogs } from "../logger.js";
import { awsConfig } from "../config/awsConfig.js";

let client: SSMClient;

function getClient(): SSMClient {
  if (!client) {
    client = new SSMClient({ region: awsConfig.region });
  }
  return client;
}

export async function getParameter(context: MyContext, key: string): Promise<string> {
  try {
    const command = new GetParameterCommand({ Name: key, WithDecryption: true });
    const param: GetParameterCommandOutput = await getClient().send(command);
    return param.Parameter?.Value ?? '';
  } catch (err) {
    context.logger?.error(
      prepareObjectForLogs({ key, err }),
      "Error fetching parameter from SSM"
    );
    return '';
  }
}
