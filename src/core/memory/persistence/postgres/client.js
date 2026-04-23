'use strict'

const DEFAULT_CONNECTION_KEYS = Object.freeze([
  'MEMORY_POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_URL'
])

const poolCache = new Map()

function resolveConnectionString(options = {}) {
  if (options.connectionString) {
    return options.connectionString
  }

  for (const key of DEFAULT_CONNECTION_KEYS) {
    const value = process.env[key]

    if (value) {
      return value
    }
  }

  return null
}

function loadPgModule() {
  try {
    return require('pg')
  } catch (error) {
    const wrapped = new Error(
      'Postgres driver "pg" is not installed. Install it before using memory persistence.'
    )

    wrapped.code = 'postgres_driver_missing'
    wrapped.cause = error
    throw wrapped
  }
}

function createPoolKey(connectionString, options = {}) {
  return JSON.stringify({
    connectionString,
    max: options.max || null,
    idleTimeoutMillis: options.idleTimeoutMillis || null,
    ssl: options.ssl || null
  })
}

function getPool(options = {}) {
  const connectionString = resolveConnectionString(options)

  if (!connectionString) {
    const error = new Error(
      'Postgres connection string missing. Set MEMORY_POSTGRES_URL, DATABASE_URL, or POSTGRES_URL.'
    )

    error.code = 'postgres_connection_string_missing'
    throw error
  }

  const key = createPoolKey(connectionString, options)

  if (!poolCache.has(key)) {
    const { Pool } = loadPgModule()
    poolCache.set(
      key,
      new Pool({
        connectionString,
        max: options.max,
        idleTimeoutMillis: options.idleTimeoutMillis,
        ssl: options.ssl
      })
    )
  }

  return poolCache.get(key)
}

async function query(text, values = [], options = {}) {
  const client = options.client || getPool(options)
  return client.query(text, values)
}

async function withTransaction(work, options = {}) {
  if (typeof work !== 'function') {
    throw new TypeError('withTransaction requires a work function')
  }

  if (options.client) {
    return work(options.client)
  }

  const pool = getPool(options)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      error.rollbackError = rollbackError
    }

    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  resolveConnectionString
}
