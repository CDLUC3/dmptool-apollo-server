#!/bin/bash

# Force LocalStack to use us-west-2
export AWS_DEFAULT_REGION="us-west-2"

GENERATE_MADMP_RECORD_FUNCTION="/etc/lambda-code/generateMaDMPRecord.zip"

if [ -e "$GENERATE_MADMP_RECORD_FUNCTION" ]; then
  # Define ENV Variables needed by the Lambda Functions
  AWS_REGION="us-west-2"

  ENV="dev"
  NODE_ENV="development"
  LOG_LEVEL="debug"
  APPLICATION_NAME="dmptool"
  DOMAIN_NAME="http://localhost"

  DYNAMO_ENDPOINT="http://localstack:4566"
  DYNAMODB_TABLE_NAME="localDMPTable"
  MAX_ATTEMPTS="3"

  RDS_HOST="apollo-mysql"
  RDS_PORT="3306"
  RDS_USERNAME="root"
  RDS_PASSWORD="d0ckerSecr3t"
  RDS_DATABASE="dmptool"

  SSM_ENDPOINT="http://localstack:4566"

  EZID_BASE_URL="https://doi.org"
  EZID_SHOULDER="11.22222/A1"
  VERSION_GRACE_PERIOD="7200000"

  # Create the DynamoDB table to store maDMP records
  echo "Creating DynamoDB table: localDMPTable..."
  awslocal dynamodb create-table \
      --table-name localDMPTable \
      --attribute-definitions \
          AttributeName=PK,AttributeType=S \
          AttributeName=SK,AttributeType=S \
      --key-schema \
          AttributeName=PK,KeyType=HASH \
          AttributeName=SK,KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST \
      --stream-specification StreamEnabled=true,StreamViewType=NEW_IMAGE

  # Create the SQS queue for the lambda function
  echo 'Creating SQS Queue For generateMaDMPRecord Lambda Function'
  awslocal sqs create-queue --queue-name generateMaDMPRecord
  QUEUE_URL=$(awslocal sqs get-queue-url --queue-name generateMaDMPRecord --query 'QueueUrl' --output text)
  QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

  # Setup the SSM parameters for the lambda function
  echo 'Creating SSM parameters used by Lambda Functions'
  awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/RdsUsername" --value "${RDS_USERNAME}" --type "String" --overwrite
  awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/RdsPassword" --value "${RDS_PASSWORD}" --type "String" --overwrite
  awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/maDMPGenerationPaused" --value "false" --type "String" --overwrite
  awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/EzidShoulder" --value "${EZID_SHOULDER}" --type "String" --overwrite
  # AWS SSM CLI attempts to fetch from URLs, so we need to send it buried in a JSON object for this one:
  awslocal ssm put-parameter --cli-input-json "{
    \"Name\": \"/uc3/dmp/tool/dev/EzidBaseUrl\",
    \"Value\": \"$EZID_BASE_URL\",
    \"Type\": \"String\",
    \"Overwrite\": true
  }"

  # Install the lambda function into the Localstack environment
  echo 'Creating generateMaDMPRecord Lambda Function'
  awslocal lambda create-function \
    --function-name generateMaDMPRecord \
    --runtime nodejs22.x \
    --zip-file fileb:///etc/lambda-code/generateMaDMPRecord.zip \
    --handler index.handler \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --environment "Variables={AWS_REGION=$AWS_REGION,\
                              ENV=$ENV,\
                              NODE_ENV=$NODE_ENV,\
                              LOG_LEVEL=$LOG_LEVEL,\
                              APPLICATION_NAME=$APPLICATION_NAME,\
                              DOMAIN_NAME=$DOMAIN_NAME,\
                              DYNAMO_ENDPOINT=$DYNAMO_ENDPOINT,\
                              DYNAMODB_TABLE_NAME=$DYNAMODB_TABLE_NAME,\
                              MAX_ATTEMPTS=$MAX_ATTEMPTS,\
                              RDS_HOST=$RDS_HOST,\
                              RDS_PORT=$RDS_PORT,\
                              RDS_DATABASE=$RDS_DATABASE,\
                              SSM_ENDPOINT=$SSM_ENDPOINT,\
                              VERSION_GRACE_PERIOD=$VERSION_GRACE_PERIOD}" \
    > /dev/null

  # Create the event source mapping for the lambda function
  echo 'Creating event source mapping so messages sent to the SQS queue trigger the generateMaDMPRecord Lambda Function'
  awslocal lambda create-event-source-mapping \
    --function-name generateMaDMPRecord \
    --batch-size 1 \
    --event-source-arn $QUEUE_ARN

else
  echo "No Lambda code found at ${GENERATE_MADMP_RECORD_FUNCTION}"
fi
