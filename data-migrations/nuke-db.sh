#!/usr/bin/env bash

if [ ! -f .env ]; then
  if [ $# -ne 1 ]; then
    echo 'If you do not have a Dotenv, you must specify the environment! (e.g. `./nuke-db.sh dev`)'
    exit 1
  else
    if [ $1 = "prd" ]; then
      echo 'NO!    This should never be run in production!'
    else
      echo "No Dotenv file found. Fetching DB info from SSM"
      MYSQL_HOST=$(echo `aws ssm get-parameter --name /uc3/dmp/hub/${1}/DbHost | jq .Parameter.Value | sed -e "s/\"//g"`)
      MYSQL_PORT=$(echo `aws ssm get-parameter --name /uc3/dmp/hub/${1}/DbPort | jq .Parameter.Value | sed -e "s/\"//g"`)
      MYSQL_DATABASE=$(echo `aws ssm get-parameter --name /uc3/dmp/hub/${1}/DbName | jq .Parameter.Value | sed -e "s/\"//g"`)
      MYSQL_USER=$(echo `aws ssm get-parameter --name /uc3/dmp/hub/${1}/DbUsername --with-decryption | jq .Parameter.Value | sed -e "s/\"//g"`)
      MYSQL_PASSWORD=$(echo `aws ssm get-parameter --name /uc3/dmp/hub/${1}/DbPassword --with-decryption | jq .Parameter.Value | sed -e "s/\"//g"`)
      MYSQL_ARGS="-h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD}"
    fi
  fi
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
fi

drop_tables() {
  FKEY_OFF="SET FOREIGN_KEY_CHECKS = 0;"
  LIST_TABLES="SELECT table_name FROM information_schema.tables WHERE table_schema = '${1}';"
  FKEY_ON="SET FOREIGN_KEY_CHECKS = 1;"

  echo "Purging all tables from database ${1} ..."
  if [ "${1}" == "${MYSQL_DATABASE}" ]; then
    MIGRATION_ARGS=${MYSQL_ARGS}
  else
    MIGRATION_ARGS=${MYSQL_TEST_ARGS}
  fi

  mariadb $MIGRATION_ARGS -N $1 <<< "$FKEY_OFF"

  TABLE_LIST=$(mariadb $MIGRATION_ARGS -N $1 <<< "$LIST_TABLES")

  while read -r TABLE; do
    echo "  Dropping: $TABLE"
    mariadb $MIGRATION_ARGS -N $1 <<< "${FKEY_OFF} DROP TABLE \`${TABLE}\`; ${FKEY_ON}"
  done <<< "$TABLE_LIST"

  mariadb $MIGRATION_ARGS -N $1 <<< "$FKEY_ON"
}

# If we are running locally, the MySQL cert will exist in /etc
  if [ -f "/etc/mysql-cert.pem" ]; then
    MIGRATION_ARGS="${MIGRATION_ARGS} --ssl-ca=/etc/mysql-cert.pem --ssl-verify-server-cert=OFF"
  fi

drop_tables $MYSQL_DATABASE

echo "Nuke complete. You may now run data-migrations/process.sh to rebuild the database tables"
