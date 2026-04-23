'use strict'

function areValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function preserveRawField(target, {
  field,
  rawField,
  sourceValue,
  normalizedValue,
  forceKeepRaw = false
}) {
  target[field] = normalizedValue

  const shouldKeepRaw =
    forceKeepRaw ||
    !areValuesEqual(sourceValue, normalizedValue)

  if (shouldKeepRaw) {
    target[rawField] = sourceValue
    return {
      preserved: true,
      changed: true
    }
  }

  if (Object.prototype.hasOwnProperty.call(target, rawField)) {
    target[rawField] = sourceValue
  }

  return {
    preserved: Object.prototype.hasOwnProperty.call(target, rawField),
    changed: false
  }
}

function preserveRawValues(candidate, fields = []) {
  const next = {
    ...candidate
  }
  const changedFields = []
  const preservedRawFields = []

  for (const fieldConfig of fields) {
    const result = preserveRawField(next, fieldConfig)

    if (result.changed) {
      changedFields.push(fieldConfig.field)
    }

    if (result.preserved) {
      preservedRawFields.push(fieldConfig.rawField)
    }
  }

  return {
    candidate: next,
    changedFields,
    preservedRawFields
  }
}

module.exports = {
  preserveRawValues
}
