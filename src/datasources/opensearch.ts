import {Client, ClientOptions} from "@opensearch-project/opensearch";
import {AwsSigv4Signer} from "@opensearch-project/opensearch/lib/aws";
import {fromNodeProviderChain} from "@aws-sdk/credential-providers";
import {OpenSearchConfig} from "../services/openSearchService";


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
    Object.assign(
      clientOptions,
      AwsSigv4Signer({
        region: config.awsRegion,
        service: config.awsService,
        getCredentials: fromNodeProviderChain(),
      }),
    );
  } else if (config.authType === 'basic') {
    clientOptions.auth = {
      username: config.username || '',
      password: config.password || '',
    };
  }

  return new Client(clientOptions);
}
