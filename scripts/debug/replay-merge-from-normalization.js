'use strict'

const fs = require('node:fs')
const path = require('node:path')

const { mergePassResults } = require('../../src/core/memory/extractors/llm/merge/merge-pass-results')

const LOG_DIR = path.resolve(process.cwd(), 'logs/memory')
const NORMALIZATION_LOG = path.join(LOG_DIR, 'normalization.jsonl')

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`)
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function getLastTraceId(rows) {
  return rows.at(-1)?.traceId
}

function main() {
  const rows = readJsonl(NORMALIZATION_LOG)
  const traceId = process.argv[2] || getLastTraceId(rows)

  if (!traceId) {
    throw new Error('traceId not found')
  }

  const traceRows = rows.filter((row) => row.traceId === traceId)

  const passResults = traceRows.map((row) => {
    const candidates =
      row.normalizedCandidates ||
      row.outputCandidates ||
      row.candidates ||
      []

    return {
      sourcePass: row.sourcePass,
      extractorName: row.extractorName,
      status: row.status,
      candidates
    }
  })

  console.log('traceId:', traceId)
  console.log('passResults:', passResults.map((p) => ({
    sourcePass: p.sourcePass,
    candidateCount: p.candidates.length
  })))

  const result = mergePassResults({
    traceId,
    eventId: traceRows[0]?.eventId,
    threadId: traceRows[0]?.threadId,
    passResults
  })

  console.log('\nMERGE META:')
  console.dir(result.mergeMeta, { depth: 10 })

  console.log('\nOVERLAP PREVIEW:')
  console.dir(result.mergeMeta?.overlapGroupPreview, { depth: 10 })

  console.log('\nRELATED CANDIDATES:')
  console.table(
    result.candidates
      .filter((candidate) => candidate.relatedCandidateIds?.length)
      .map((candidate) => ({
        id: candidate.candidateId,
        pass: candidate.sourcePass,
        kind: candidate.kind,
        related: candidate.relatedCandidateIds.length,
        flags: candidate.flags?.join(','),
        summary: candidate.summary
      }))
  )
}

main()
