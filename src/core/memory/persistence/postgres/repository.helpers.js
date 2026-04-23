'use strict'

const { query: defaultQuery } = require('./client')

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function filterDefinedEntries(payload = {}) {
  return Object.entries(safeObject(payload)).filter(([, value]) => value !== undefined)
}

function jsonValue(value) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  return JSON.stringify(value)
}

function buildInsertStatement(tableName, payload = {}, options = {}) {
  const entries = filterDefinedEntries(payload)

  if (entries.length === 0) {
    throw new Error(`insert_payload_empty:${tableName}`)
  }

  const columns = entries.map(([column]) => column)
  const values = entries.map(([, value]) => value)
  const placeholders = values.map((_, index) => `$${index + 1}`)
  const conflictClause = options.onConflict || ''
  const returningClause =
    options.returning === false ? '' : ` RETURNING ${options.returning || '*'}`

  return {
    text: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})${conflictClause}${returningClause}`,
    values
  }
}

function buildUpdateStatement(tableName, patch = {}, where = {}, options = {}) {
  const patchEntries = filterDefinedEntries(patch)
  const whereEntries = filterDefinedEntries(where)

  if (patchEntries.length === 0) {
    throw new Error(`update_patch_empty:${tableName}`)
  }

  if (whereEntries.length === 0) {
    throw new Error(`update_where_empty:${tableName}`)
  }

  const values = []
  const setClauses = patchEntries.map(([column, value], index) => {
    values.push(value)
    return `${column} = $${index + 1}`
  })
  const whereClauses = whereEntries.map(([column, value], index) => {
    values.push(value)
    return `${column} = $${patchEntries.length + index + 1}`
  })
  const returningClause =
    options.returning === false ? '' : ` RETURNING ${options.returning || '*'}`

  return {
    text: `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}${returningClause}`,
    values
  }
}

function buildUpsertStatement(tableName, payload = {}, conflictColumns = [], updateColumns = null, options = {}) {
  const entries = filterDefinedEntries(payload)

  if (entries.length === 0) {
    throw new Error(`upsert_payload_empty:${tableName}`)
  }

  if (!Array.isArray(conflictColumns) || conflictColumns.length === 0) {
    throw new Error(`upsert_conflict_columns_missing:${tableName}`)
  }

  const columns = entries.map(([column]) => column)
  const values = entries.map(([, value]) => value)
  const placeholders = values.map((_, index) => `$${index + 1}`)
  const resolvedUpdateColumns = Array.isArray(updateColumns) && updateColumns.length > 0
    ? updateColumns
    : columns.filter((column) => !conflictColumns.includes(column))
  const updateClause = resolvedUpdateColumns.length > 0
    ? `DO UPDATE SET ${resolvedUpdateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`
    : 'DO NOTHING'
  const returningClause =
    options.returning === false ? '' : ` RETURNING ${options.returning || '*'}`

  return {
    text:
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
      `ON CONFLICT (${conflictColumns.join(', ')}) ${updateClause}${returningClause}`,
    values
  }
}

async function runQuery(statement, options = {}) {
  const executor = options.client
    ? options.client.query.bind(options.client)
    : defaultQuery

  return executor(statement.text, statement.values, options.client ? undefined : options)
}

function pickRow(result) {
  if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

function rowCount(result) {
  return Number(result?.rowCount || 0)
}

function isoNow() {
  return new Date().toISOString()
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function importanceToScore(value) {
  switch (String(value || '').trim()) {
    case 'high':
      return 0.9
    case 'medium':
      return 0.6
    case 'low':
      return 0.3
    default:
      return numericOrNull(value)
  }
}

module.exports = {
  buildInsertStatement,
  buildUpdateStatement,
  buildUpsertStatement,
  runQuery,
  pickRow,
  rowCount,
  jsonValue,
  isoNow,
  numericOrNull,
  importanceToScore
}
