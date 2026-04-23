'use strict'

const { LLM_NORMALIZATION_CONFIG } = require('../config/normalization.config')

const IMPORTANCE_REGISTRY = Object.freeze({
  низкая: Object.freeze(['низкая', 'низкий', 'low']),
  средняя: Object.freeze(['средняя', 'средний', 'medium']),
  высокая: Object.freeze(['высокая', 'высокий', 'high'])
})

const IMPORTANCE_ALIAS_TO_NORMALIZED = Object.freeze(
  Object.entries(IMPORTANCE_REGISTRY).reduce((accumulator, [normalized, aliases]) => {
    for (const alias of aliases) {
      accumulator[String(alias).trim().toLowerCase().replace(/ё/g, 'е')] = normalized
    }

    return accumulator
  }, {})
)

module.exports = {
  IMPORTANCE_REGISTRY,
  IMPORTANCE_ALIAS_TO_NORMALIZED,
  ALLOWED_IMPORTANCE_VALUES: LLM_NORMALIZATION_CONFIG.allowedImportanceValues
}
