'use strict'

const KIND_REGISTRY = Object.freeze({
  'entity-object-location': Object.freeze({
    entity_candidate: Object.freeze(['entity_candidate', 'entity', 'сущность']),
    object_candidate: Object.freeze(['object_candidate', 'object', 'объект', 'предмет']),
    location_candidate: Object.freeze(['location_candidate', 'location', 'локация', 'место']),
    alias_candidate: Object.freeze(['alias_candidate', 'alias', 'алиас', 'псевдоним']),
    role_candidate: Object.freeze(['role_candidate', 'role', 'роль'])
  }),
  fact: Object.freeze({
    fact_candidate: Object.freeze(['fact_candidate', 'fact', 'факт']),
    temporal_fact_candidate: Object.freeze(['temporal_fact_candidate', 'temporal_fact', 'temporal fact', 'временной_факт', 'временной факт']),
    support_signal: Object.freeze(['support_signal', 'support', 'поддержка']),
    contradiction_signal: Object.freeze(['contradiction_signal', 'contradiction', 'противоречие']),
    refinement_signal: Object.freeze(['refinement_signal', 'refinement', 'уточнение'])
  }),
  episode: Object.freeze({
    episode_candidate: Object.freeze(['episode_candidate', 'episode', 'эпизод']),
    scene_candidate: Object.freeze(['scene_candidate', 'scene', 'сцена']),
    micro_scene_candidate: Object.freeze([
      'micro_scene_candidate',
      'micro_episode_candidate',
      'micro_scene',
      'micro scene',
      'микро_сцена',
      'микросцена',
      'микро сцена',
      'микро_эпизод',
      'микро эпизод',
      'микро-эпизод',
      'микроэпизод'
    ]),
    interaction_candidate: Object.freeze(['interaction_candidate', 'interaction', 'взаимодействие']),
    progression_signal: Object.freeze(['progression_signal', 'progression', 'progress signal', 'продвижение'])
  }),
  'phase-open-loop': Object.freeze({
    phase_transition: Object.freeze(['phase_transition', 'phase transition', 'phase-transition', 'переход_фазы', 'переход фазы']),
    phase_marker: Object.freeze(['phase_marker', 'phase marker', 'маркер_фазы', 'маркер фазы']),
    plan_marker: Object.freeze(['plan_marker', 'plan marker', 'маркер_плана', 'маркер плана']),
    milestone_signal: Object.freeze(['milestone_signal', 'milestone', 'веха']),
    open_loop_candidate: Object.freeze(['open_loop_candidate', 'open_loop', 'open loop', 'незавершенный_цикл', 'незавершенный цикл']),
    deferred_topic: Object.freeze(['deferred_topic', 'deferred topic', 'отложенная_тема', 'отложенная тема']),
    pending_step: Object.freeze(['pending_step', 'pending step', 'ожидающий_шаг', 'ожидающий шаг']),
    dependency_signal: Object.freeze(['dependency_signal', 'dependency', 'зависимость'])
  }),
  'cognition-realization': Object.freeze({
    realization_signal: Object.freeze(['realization_signal', 'realization', 'осознание']),
    cognitive_update: Object.freeze(['cognitive_update', 'cognitive update', 'когнитивное_обновление', 'когнитивное обновление']),
    reframing_signal: Object.freeze(['reframing_signal', 'reframing', 'переосмысление']),
    interpretation_shift: Object.freeze(['interpretation_shift', 'interpretation shift', 'сдвиг_интерпретации', 'сдвиг интерпретации']),
    certainty_shift: Object.freeze(['certainty_shift', 'certainty shift', 'сдвиг_уверенности', 'сдвиг уверенности'])
  }),
  'emotion-atmosphere-significance': Object.freeze({
    emotional_state: Object.freeze(['emotional_state', 'emotional state', 'эмоциональное_состояние', 'эмоциональное состояние']),
    emotional_shift: Object.freeze(['emotional_shift', 'emotional shift', 'эмоциональный_сдвиг', 'эмоциональный сдвиг']),
    atmosphere_signal: Object.freeze(['atmosphere_signal', 'atmosphere', 'атмосфера']),
    tone_signal: Object.freeze(['tone_signal', 'tone', 'тон']),
    significance_signal: Object.freeze(['significance_signal', 'significance', 'значимость']),
    emphasis_signal: Object.freeze(['emphasis_signal', 'emphasis', 'акцент'])
  }),
  'relationship-social': Object.freeze({
    relationship_signal: Object.freeze(['relationship_signal', 'relationship', 'отношение']),
    collaboration_signal: Object.freeze(['collaboration_signal', 'collaboration', 'сотрудничество']),
    vulnerability_signal: Object.freeze(['vulnerability_signal', 'vulnerability', 'уязвимость']),
    openness_signal: Object.freeze(['openness_signal', 'openness', 'открытость']),
    boundary_signal: Object.freeze(['boundary_signal', 'boundary', 'граница']),
    addressing_signal: Object.freeze(['addressing_signal', 'addressing', 'обращение'])
  })
})

function canonicalizeKindAlias(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s-]+/g, '_')
}

const KIND_ALIAS_TO_NORMALIZED_BY_PASS = Object.freeze(
  Object.entries(KIND_REGISTRY).reduce((passAccumulator, [passKey, entryMap]) => {
    const aliasMap = {}

    for (const [normalizedKind, aliases] of Object.entries(entryMap)) {
      aliasMap[canonicalizeKindAlias(normalizedKind)] = normalizedKind

      for (const alias of aliases) {
        aliasMap[canonicalizeKindAlias(alias)] = normalizedKind
      }
    }

    passAccumulator[passKey] = Object.freeze(aliasMap)
    return passAccumulator
  }, {})
)

function getNormalizedKindsForPass(passKey) {
  return Object.keys(KIND_REGISTRY[passKey] || {})
}

module.exports = {
  KIND_REGISTRY,
  KIND_ALIAS_TO_NORMALIZED_BY_PASS,
  canonicalizeKindAlias,
  getNormalizedKindsForPass
}
