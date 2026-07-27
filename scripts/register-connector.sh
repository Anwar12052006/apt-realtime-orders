#!/bin/sh
set -e

DEBEZIUM_URL="${DEBEZIUM_CONNECT_URL:-http://localhost:8083}"
CONNECTOR_NAME="orders-cdc-connector"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-apt_realtime_orders}"

echo "Checking Debezium Connect endpoint at ${DEBEZIUM_URL}..."

until curl -s -f "${DEBEZIUM_URL}/" > /dev/null; do
  echo "Waiting for Debezium Connect to become healthy..."
  sleep 2
done

echo "Debezium Connect is healthy."

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${DEBEZIUM_URL}/connectors/${CONNECTOR_NAME}")

if [ "$STATUS" -eq 200 ]; then
  echo "Connector '${CONNECTOR_NAME}' is already registered."
else
  echo "Registering connector '${CONNECTOR_NAME}'..."
  curl -s -X POST -H "Accept:application/json" -H "Content-Type:application/json" \
    "${DEBEZIUM_URL}/connectors/" \
    -d '{
      "name": "'"${CONNECTOR_NAME}"'",
      "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "tasks.max": "1",
        "plugin.name": "pgoutput",
        "database.hostname": "'"${DB_HOST}"'",
        "database.port": "'"${DB_PORT}"'",
        "database.user": "'"${DB_USER}"'",
        "database.password": "'"${DB_PASSWORD}"'",
        "database.dbname": "'"${DB_NAME}"'",
        "topic.prefix": "cdc",
        "schema.include.list": "public",
        "table.include.list": "public.orders",
        "slot.name": "orders_cdc_slot",
        "publication.name": "orders_cdc_publication",
        "publication.autocreate.mode": "filtered",
        "snapshot.mode": "initial",
        "tombstones.on.delete": "false",
        "slot.drop.on.stop": "false"
      }
    }'
  echo ""
  echo "Connector registration successfully submitted."
fi
