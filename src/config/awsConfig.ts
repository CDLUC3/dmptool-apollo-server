import * as dotenv from 'dotenv';
import { verifyCriticalEnvVariable } from '../utils/helpers';

dotenv.config();

if (!['development', 'test'].includes(process.env.NODE_ENV)) {
  verifyCriticalEnvVariable('SES_ENDPOINT');
  verifyCriticalEnvVariable('SES_ACCESS_ID');
  verifyCriticalEnvVariable('SES_ACCESS_SECRET');
  verifyCriticalEnvVariable('SES_BOUNCE_EMAIL_ADDRESS');
  verifyCriticalEnvVariable('SES_BOUNCED_EMAIL_BUCKET');
  verifyCriticalEnvVariable('DYNAMO_TABLE_NAME');

  verifyCriticalEnvVariable('OPENSEARCH_HOST');
  verifyCriticalEnvVariable('OPENSEARCH_PORT');
  verifyCriticalEnvVariable('OPENSEARCH_USE_SSL');
  verifyCriticalEnvVariable('OPENSEARCH_VERIFY_CERTS');
  verifyCriticalEnvVariable('OPENSEARCH_AUTH_TYPE');
  verifyCriticalEnvVariable('OPENSEARCH_REGION');
  verifyCriticalEnvVariable('OPENSEARCH_SERVICE');
}

export const awsConfig = {
  // Basic AWS config
  region: process.env.AWS_REGION || 'us-west-2',

  // Simple Email Service (SES) configuration
  sesEndpoint: process.env.SES_ENDPOINT,
  port: process.env.SES_PORT ?? 465,
  sesAccessKey: process.env.SES_ACCESS_ID,
  sesAccessSecret: process.env.SES_ACCESS_SECRET,
  sesBounceAddress: process.env.SES_BOUNCE_EMAIL_ADDRESS,
  sesBouncedEmailBucket: process.env.SES_BOUNCED_EMAIL_BUCKET,

  // DynamoDB configuration
  dynamoTableName: process.env.DYNAMO_TABLE_NAME,
  dynamoEndpoint: process.env.DYNAMO_ENDPOINT,
  dynamoMaxQueryAttempts: process.env.DYNAMO_MAX_ATTEMPTS ? parseInt(process.env.DYNAMO_MAX_ATTEMPTS) : 3,

  // OpenSearch config
  opensearch: {
    host: process.env.OPENSEARCH_HOST || 'host.docker.internal',
    port: Number.parseInt(process.env.OPENSEARCH_PORT || '9200', 10),
    useSSL: process.env.OPENSEARCH_USE_SSL === 'true', // true or false
    verifyCerts: process.env.OPENSEARCH_VERIFY_CERTS === 'true', // true or false
    authType: process.env.OPENSEARCH_AUTH_TYPE || null, // aws or basic
    username: process.env.OPENSEARCH_USERNAME || null,
    password: process.env.OPENSEARCH_PASSWORD || null,
    awsRegion: process.env.OPENSEARCH_REGION || null,
    awsService: process.env.OPENSEARCH_SERVICE || null,
  }
}
