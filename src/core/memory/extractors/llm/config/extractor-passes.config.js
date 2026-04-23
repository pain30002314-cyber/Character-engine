'use strict'

function clonePassDefinition(pass) {
  return {
    order: pass.order,
    extractorKey: pass.extractorKey,
    extractorName: pass.extractorName,
    role: pass.role,
    enabled: pass.enabled !== false
  }
}

const LLM_EXTRACTOR_PASSES = Object.freeze([
  {
    order: 1,
    extractorKey: 'entity-object-location',
    extractorName: 'Сущности / объекты / локации',
    role: 'entity-object-location',
    enabled: true
  },
  {
    order: 2,
    extractorKey: 'fact',
    extractorName: 'Факты',
    role: 'fact',
    enabled: true
  },
  {
    order: 3,
    extractorKey: 'episode',
    extractorName: 'Эпизоды',
    role: 'episode',
    enabled: true
  },
  {
    order: 4,
    extractorKey: 'phase-open-loop',
    extractorName: 'Сигналы фаз и незакрытых циклов',
    role: 'phase-open-loop',
    enabled: true
  },
  {
    order: 5,
    extractorKey: 'cognition-realization',
    extractorName: 'Сигналы осознания и выводов',
    role: 'cognition-realization',
    enabled: true
  },
  {
    order: 6,
    extractorKey: 'emotion-atmosphere-significance',
    extractorName: 'Сигналы эмоций, атмосферы и значимости',
    role: 'emotion-atmosphere-significance',
    enabled: true
  },
  {
    order: 7,
    extractorKey: 'relationship-social',
    extractorName: 'Социальные и реляционные сигналы',
    role: 'relationship-social',
    enabled: true
  }
])

const LLM_EXTRACTOR_FLOW_CONFIG = Object.freeze({
  strategy: 'llm_wide_candidates_v1',
  extractorVersion: '3.0.0',
  promptTransport: 'text_packet',
  responseContract: 'minimal_json_candidates_v1',
  partialFailurePolicy: 'all_passes_settled'
})

module.exports = {
  LLM_EXTRACTOR_PASSES,
  LLM_EXTRACTOR_FLOW_CONFIG,
  getExtractorPassConfigByKey(extractorKey) {
    const normalizedKey = String(extractorKey || '').trim()
    const pass = LLM_EXTRACTOR_PASSES.find((item) => item.extractorKey === normalizedKey)
    return pass ? clonePassDefinition(pass) : null
  }
}
