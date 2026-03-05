import { Client, ClientOptions } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export interface OpenSearchConfig {
  host: string;
  port: number;
  useSSL: boolean;
  verifyCerts: boolean;
  authType: 'aws' | 'basic' | null;
  username: string | null;
  password: string | null;
  awsRegion: string | null;
  awsService: 'es' | 'aoss' | null;
}

export function createOpenSearchClient(config: OpenSearchConfig): Client {
  const protocol = config.useSSL ? 'https:' : 'http:';
  const url = new URL(`${protocol}//${config.host}:${config.port}`);

  const clientOptions: ClientOptions = {
    node: url.toString(),
    ssl: {
      rejectUnauthorized: config.verifyCerts,
    },
    compression: 'gzip',
  };

  if (config.authType === 'aws') {
    // Validation for AWS
    if (!config.awsRegion || !config.awsService) {
      throw new Error("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    }

    Object.assign(
      clientOptions,
      AwsSigv4Signer({
        region: config.awsRegion,
        service: config.awsService,
        getCredentials: fromNodeProviderChain(),
      }),
    );
  } else if (config.authType === 'basic') {
    // Validation for Basic Auth
    if (!config.username || !config.password) {
      throw new Error("Basic authentication requires 'username' and 'password' to be defined.");
    }

    clientOptions.auth = {
      username: config.username,
      password: config.password,
    };
  }

  return new Client(clientOptions);
}
