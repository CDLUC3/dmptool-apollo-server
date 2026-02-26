#!/bin/bash

if [ ! -f .env ]; then
  if [ $# -ne 1 ]; then
    echo 'If you do not have a Dotenv, you must specify the environment! (e.g. `./process.sh dev`)'
    exit 1
  else
    echo "No Dotenv file found. Fetching DB info from SSM"
    MYSQL_HOST=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsHost | jq .Parameter.Value | sed -e "s/\"//g"`)
    MYSQL_PORT=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsPort | jq .Parameter.Value | sed -e "s/\"//g"`)
    MYSQL_DATABASE=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsName | jq .Parameter.Value | sed -e "s/\"//g"`)
    MYSQL_USER=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsUsername --with-decryption | jq .Parameter.Value | sed -e "s/\"//g"`)
    MYSQL_PASSWORD=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsPassword --with-decryption | jq .Parameter.Value | sed -e "s/\"//g"`)
    MYSQL_ARGS="-h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD}"

    # If a Test Database was defined then setup the args for it
    MYSQL_TEST_DATABASE=$(echo `aws ssm get-parameter --name /uc3/dmp/tool/${1}/RdsTestName | jq .Parameter.Value | sed -e "s/\"//g"`)
    if [ -n "${MYSQL_TEST_DATABASE}" ]; then
      MYSQL_TEST_ARGS="-h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD}"
    fi
  fi

  # We are in the AWS environment so do not run migrations scripts in the locals-only dir
  RUN_LOCALS=0
else
  echo "Load the DB info from Dotenv file"
  . .env

  # Run the migration using the env variable defined in the dotenv file
  if [ -z "${MYSQL_PASSWORD}" ]; then
    MYSQL_ARGS="-h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER}"
    MYSQL_TEST_ARGS="-h ${MYSQL_TEST_HOST} -P ${MYSQL_TEST_PORT} -u ${MYSQL_TEST_USER}"
  else
    MYSQL_ARGS="-h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD}"
    MYSQL_TEST_ARGS="-h ${MYSQL_TEST_HOST} -P ${MYSQL_TEST_PORT} -u ${MYSQL_TEST_USER} -p${MYSQL_TEST_PASSWORD}"
  fi

  # We are running locally so run migrations scripts in the locals-only dir
  if [ "${1}" == "local" ]; then
    RUN_LOCALS=1
  fi
fi

create_database() {
  # Create the database if it does not exist
  CREATE_DATABASE="CREATE DATABASE IF NOT EXISTS ${1}
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;"

  # If we are running locally, the MySQL cert will exist in /etc
  if [ -f "/etc/mysql-cert.pem" ]; then
    CREATE_ARGS="${MYSQL_ARGS} --ssl-ca=/etc/mysql-cert.pem --ssl-verify-server-cert=OFF"
  fi

  echo "Creating database, ${1}, if it does not already exist ..."
  if [ "${1}" == "${MYSQL_DATABASE}" ]; then
    mariadb ${CREATE_ARGS} <<< ${CREATE_DATABASE}
  else
    mariadb ${CREATE_ARGS} <<< ${CREATE_DATABASE}
  fi
}

process_migration() {
  # See if the migration was already processed, this will report an ERROR when
  # first creating the database. This is expected. The first SQL migration script
  # creates the table we are checking.
  echo "Checking to see if $2 has been run ..."
  if [ "${1}" == "${MYSQL_DATABASE}" ]; then
    MIGRATION_ARGS=${MYSQL_ARGS}
  else
    MIGRATION_ARGS=${MYSQL_TEST_ARGS}
  fi

  # If we are running locally, the MySQL cert will exist in /etc
  if [ -f "/etc/mysql-cert.pem" ]; then
    MIGRATION_ARGS="${MIGRATION_ARGS} --ssl-ca=/etc/mysql-cert.pem --ssl-verify-server-cert=OFF"
  fi

  EXISTS=$(mariadb ${MIGRATION_ARGS} -N ${1} <<< "SELECT * FROM dataMigrations WHERE migrationFile = '$2';")

  if [ -z "$EXISTS" ]; then
    # If not run it
    echo "NEW MIGRATION - $2. Processing migration ..."
    mariadb ${MIGRATION_ARGS} ${1} < $2

    WAS_PROCESSED=$?

    # If it worked then update the data-migrations table so we don't run it again!
    if [ $WAS_PROCESSED -eq 0 ]; then
      mariadb ${MIGRATION_ARGS} ${1} <<< "INSERT INTO dataMigrations (migrationFile) VALUES ('$2');"
      MIGRATIONS_RUN+=("$2")
      echo "    done"
      # Sleep for 2 seconds to allow the DB engine to fully process the last script
      # MariaDB tables have a tendency to get corrupted if too many schema changes happen in rapid sequence
      sleep 2
    else
      echo "    Something went wrong!"
      exit 1
    fi
  else
    echo "    it has."
  fi
}

# Initialize an array to keep track of migrations that were run
MIGRATIONS_RUN=()

# Create the database if it does not exist
echo "Making sure the DB exists"
create_database $MYSQL_DATABASE

# If RUN_LOCALS is true then also process any files in locals-only dir
if [ "${RUN_LOCALS:-0}" -eq 1 ]; then
  MIGRATION_PATH=(./data-migrations/*.sql ./data-migrations/local-only/*.sql)
else
  MIGRATION_PATH=(./data-migrations/*.sql)
fi

# Run this script to process any new SQL migrations on your local DB.
for i in "${MIGRATION_PATH[@]}"; do
  [ -f "$i" ] || break

  process_migration $MYSQL_DATABASE $i
  echo ''
  echo ''
done

echo "Complete. The following migrations were run:"
echo "${MIGRATIONS_RUN[@]}"
echo ''
echo ''

