#!/bin/bash

# Force LocalStack to use us-west-2
export AWS_DEFAULT_REGION="us-west-2"

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

S3_BUCKET_NAME="local-s3-bucket"

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

# Create an S3 bucket that we will use to store logos and other media assets for the DMPTool
awslocal s3 mb s3://$S3_BUCKET_NAME
