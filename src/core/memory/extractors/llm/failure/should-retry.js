'use strict'

const MAX_PASS_RETRIES = 1

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT'
])

function getStatusCode(error) {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status
  return Number.isFinite(status) ? Number(status) : null
}

function isRetryableStatus(statusCode) {
  if (!Number.isFinite(statusCode)) {
    return false
  }

  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode <= 599)
}

function hasRetryableErrorCode(error) {
  const code = String(error?.code || '').trim().toUpperCase()
  return RETRYABLE_ERROR_CODES.has(code)
}

function hasRetryableMessage(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('socket hang up') ||
    message.includes('temporarily unavailable') ||
    message.includes('model unavailable')
  )
}

function shouldRetry({
  failureType = null,
  error = null,
  retryCount = 0,
  maxRetries = MAX_PASS_RETRIES
} = {}) {
  const normalizedRetryCount = Math.max(0, Number(retryCount || 0))
  const normalizedMaxRetries = Math.max(0, Number(maxRetries || 0))
  const statusCode = getStatusCode(error)
  const retryableTransport =
    isRetryableStatus(statusCode) ||
    hasRetryableErrorCode(error) ||
    hasRetryableMessage(error)

  const retryable =
    failureType === 'llm_call_failure' &&
    retryableTransport &&
    normalizedRetryCount < normalizedMaxRetries

  return {
    retry: retryable,
    retryableTransport,
    retryCount: normalizedRetryCount,
    maxRetries: normalizedMaxRetries,
    remainingRetries: Math.max(0, normalizedMaxRetries - normalizedRetryCount),
    statusCode,
    reason: retryable
      ? 'retryable_transport_failure'
      : normalizedRetryCount >= normalizedMaxRetries
        ? 'retry_limit_reached'
        : 'non_retryable_failure'
  }
}

module.exports = {
  MAX_PASS_RETRIES,
  shouldRetry
}
