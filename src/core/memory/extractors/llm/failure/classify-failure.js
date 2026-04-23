'use strict'

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function getStatusCode(error) {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status
  return Number.isFinite(status) ? Number(status) : null
}

function getErrorMessage(error) {
  return error?.message || String(error || 'unknown_failure')
}

function hasTransportSignal(error) {
  const code = String(error?.code || '').trim().toUpperCase()
  const message = getErrorMessage(error).toLowerCase()
  const statusCode = getStatusCode(error)

  if (Number.isFinite(statusCode) && (statusCode === 408 || statusCode === 429 || statusCode >= 500)) {
    return true
  }

  return (
    [
      'ECONNABORTED',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT'
    ].includes(code) ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('socket hang up') ||
    message.includes('temporarily unavailable') ||
    message.includes('model unavailable')
  )
}

function buildClassification(type, context = {}) {
  const error = context.error || null
  const validation = context.validation || null
  const initialParse = context.initialParse || null
  const repairResult = context.repairResult || null
  const statusCode = getStatusCode(error)

  return {
    type,
    code: error?.code || null,
    statusCode,
    message: getErrorMessage(error),
    retryable: type === 'llm_call_failure' && hasTransportSignal(error),
    warnings: safeArray(context.warnings),
    errors: safeArray(context.errors),
    details: {
      parsedCandidateCount: validation?.stats?.parsedCandidateCount ?? null,
      validCandidateCount: validation?.stats?.validCandidateCount ?? null,
      droppedCandidateCount: validation?.stats?.droppedCandidateCount ?? null,
      parseError: initialParse?.error || null,
      repairError: repairResult?.error || null
    }
  }
}

function classifyFailure(context = {}) {
  const validation = context.validation || null
  const initialParse = context.initialParse || null
  const repairResult = context.repairResult || null
  const error = context.error || null
  const retryExhausted = context.retryExhausted === true

  if (validation?.ok && validation?.stats?.parsedCandidateCount === 0) {
    return buildClassification('empty_result', context)
  }

  if (
    validation?.ok &&
    validation?.stats?.validCandidateCount > 0 &&
    validation?.stats?.droppedCandidateCount > 0
  ) {
    return buildClassification('partial_success', context)
  }

  if (initialParse && initialParse.ok === false && !repairResult) {
    return buildClassification('invalid_json', context)
  }

  if (initialParse && initialParse.ok === false && repairResult && !repairResult.ok) {
    return buildClassification(
      retryExhausted ? 'retry_exhausted' : 'unrecoverable_json',
      context
    )
  }

  if (validation && validation.ok === false) {
    return buildClassification('structure_mismatch', context)
  }

  if (hasTransportSignal(error)) {
    return buildClassification(
      retryExhausted ? 'retry_exhausted' : 'llm_call_failure',
      context
    )
  }

  if (retryExhausted) {
    return buildClassification('retry_exhausted', context)
  }

  return buildClassification('unknown_failure', context)
}

module.exports = {
  classifyFailure
}
