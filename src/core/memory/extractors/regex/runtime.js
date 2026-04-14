'use strict'

const { buildPreprocessedEvent } = require('./core/preprocess')
const { buildUnits, enrichClauses } = require('./core/segment')
const { buildClauseContext } = require('./core/context')
const { filterWeakCandidates } = require('./core/garbage-control')
const { dedupeByBestScore } = require('./core/dedupe')
const { dropShadowedAtoms } = require('./core/postprocess')

const { appendRegexDebugLog } = require('./debug/regex.debug')

const { buildAtom } = require('./builders/atom.builder')
const { buildIdentityHints } = require('./builders/identity-hints.builder')
const { buildResponse } = require('./builders/response.builder')

const intentDetector = require('./rules/intent.rules')
const openLoopDetector = require('./rules/open-loop.rules')
const affectDetector = require('./rules/affect.rules')
const entityDetector = require('./rules/entity.rules')
const actionDetector = require('./rules/action.rules')
const sceneDetector = require('./rules/scene.rules')

const DETECTORS = [
  intentDetector,
  openLoopDetector,
  affectDetector,
  entityDetector,
  actionDetector,
  sceneDetector
]

async function extractRegexAtoms({ event }) {
  const startedAt = Date.now()

  const preprocessed = buildPreprocessedEvent(event)
  const units = buildUnits(preprocessed)
  const clauses = enrichClauses(units).map((clause) => ({
    clause,
    context: buildClauseContext(clause, event)
  }))

  let candidates = []
  const detectorLogs = []

  for (const detector of DETECTORS) {
    const detectorName =
      detector?.name ||
      detector?.detect?.name ||
      detector?.constructor?.name ||
      'anonymous_detector'

    const result = await detector.detect({ event, preprocessed, clauses })
    const list = Array.isArray(result) ? result : []

    detectorLogs.push({
      detector: detectorName,
      count: list.length,
      items: list
    })

    if (list.length) {
      candidates.push(...list)
    }
  }

  const candidatesBeforeFilter = candidates
  const filteredCandidates = filterWeakCandidates(candidatesBeforeFilter)
  const builtAtoms = dedupeByBestScore(
    filteredCandidates.map((item) => buildAtom(item, event))
  )
  const atoms = dropShadowedAtoms(builtAtoms)
  const identityHints = buildIdentityHints(atoms, event)

  const response = buildResponse({
    event,
    identityHints,
    atoms,
    service: {
      extractorVersion: '1.0.0',
      processedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      stats: {
        rpBlocksCount: preprocessed.rpBlocks.length,
        unitCount: units.length,
        clauseCount: clauses.length,
        detectorCount: detectorLogs.length,
        candidatesBeforeFilter: candidatesBeforeFilter.length,
        filteredCandidates: filteredCandidates.length,
        builtAtoms: builtAtoms.length,
        finalAtoms: atoms.length,
        identityHintCount: identityHints.length
      },
      warnings: [],
      debug: {}
    }
  })

  appendRegexDebugLog({
    timestamp: new Date().toISOString(),
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    role: event?.role || null,

    sourceText: event?.text || '',
    preprocessed,
    units,

    clauses: clauses.map(({ clause, context }) => ({
      clauseId: context?.clauseId || null,
      text: clause?.text || '',
      normalizedText: clause?.normalizedText || '',
      flags: {
        isQuestion: context?.isQuestion || false,
        isImperative: context?.isImperative || false,
        isConditional: context?.isConditional || false,
        isHypothetical: context?.isHypothetical || false,
        isReported: context?.isReported || false,
        isHedged: context?.isHedged || false,
        hasQuote: context?.hasQuote || false
      }
    })),

    detectorLogs,

    candidatesBeforeFilter,
    filteredCandidates,
    builtAtoms,
    finalAtoms: atoms,
    identityHints,

    stats: {
      detectors: detectorLogs.length,
      candidatesBeforeFilter: candidatesBeforeFilter.length,
      filteredCandidates: filteredCandidates.length,
      builtAtoms: builtAtoms.length,
      finalAtoms: atoms.length,
      identityHints: identityHints.length,
      durationMs: Date.now() - startedAt
    }
  })

  return response
}

module.exports = {
  extractRegexAtoms
}
