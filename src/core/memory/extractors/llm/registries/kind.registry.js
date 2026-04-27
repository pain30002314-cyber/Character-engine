'use strict'

function defineKindEntry(description, aliases = []) {
  return Object.freeze({
    description,
    aliases: Object.freeze(aliases)
  })
}

const KIND_REGISTRY = Object.freeze({
  'entity-object-location': Object.freeze({
    entity_candidate: defineKindEntry('упоминание сущности, персонажа или действующего участника', [
      'entity',
      'сущность',
      'персонаж',
      'участник'
    ]),
    object_candidate: defineKindEntry('упоминание объекта, предмета или ресурса', [
      'object',
      'объект',
      'предмет',
      'ресурс'
    ]),
    location_candidate: defineKindEntry('упоминание места, локации или пространства', [
      'location',
      'локация',
      'место',
      'пространство'
    ]),
    alias_signal: defineKindEntry('сигнал альтернативного имени, обращения или псевдонима', [
      'alias_signal',
      'alias_candidate',
      'alias',
      'алиас',
      'псевдоним',
      'прозвище',
      'вариант имени'
    ]),
    role_signal: defineKindEntry('сигнал роли, функции или статуса участника', [
      'role_signal',
      'role_candidate',
      'role',
      'роль',
      'функция',
      'статус'
    ])
  }),
  fact: Object.freeze({
    fact_candidate: defineKindEntry('отдельное утверждение или наблюдаемый факт', [
      'fact',
      'факт',
      'утверждение'
    ]),
    temporal_fact_candidate: defineKindEntry('факт, привязанный ко времени, периоду или последовательности', [
      'temporal_fact',
      'temporal fact',
      'временной факт',
      'временной_факт'
    ]),
    fact_support_signal: defineKindEntry('сигнал, что один факт подтверждает другой', [
      'fact_support_signal',
      'support_signal',
      'support',
      'поддержка',
      'подтверждение'
    ]),
    fact_contradiction_signal: defineKindEntry('сигнал, что один факт противоречит другому', [
      'fact_contradiction_signal',
      'contradiction_signal',
      'contradiction',
      'противоречие'
    ]),
    fact_refinement_signal: defineKindEntry('сигнал, что факт уточняет, сужает или дополняет другой факт', [
      'fact_refinement_signal',
      'refinement_signal',
      'refinement',
      'уточнение',
      'дополнение'
    ])
  }),
  episode: Object.freeze({
    episode_candidate: defineKindEntry('сцена или событие, значимое как эпизод памяти', [
      'episode',
      'эпизод',
      'scene_candidate',
      'scene',
      'сцена'
    ]),
    micro_episode_candidate: defineKindEntry('маленький локальный эпизод', [
      'micro_episode_candidate',
      'micro_scene_candidate',
      'micro_scene',
      'micro scene',
      'микро эпизод',
      'микро_эпизод',
      'микро-эпизод',
      'микроэпизод',
      'микро сцена',
      'микро_сцена',
      'микросцена'
    ]),
    situational_context_signal: defineKindEntry('сигнал обстановки, условий или рамки происходящего', [
      'situational_context_signal',
      'context_signal',
      'контекст сцены',
      'ситуационный контекст',
      'обстановка'
    ]),
    local_interaction_signal: defineKindEntry('локальное взаимодействие внутри сцены', [
      'local_interaction_signal',
      'interaction_candidate',
      'interaction',
      'взаимодействие',
      'локальное взаимодействие'
    ]),
    participant_signal: defineKindEntry('сигнал участника или состава участников сцены', [
      'participant_signal',
      'participant',
      'участник сцены',
      'состав участников'
    ]),
    scene_location_signal: defineKindEntry('сигнал места действия внутри сцены', [
      'scene_location_signal',
      'scene location',
      'место сцены',
      'место действия'
    ]),
    scene_progression_signal: defineKindEntry('сигнал изменения, движения или продвижения сцены', [
      'scene_progression_signal',
      'progression_signal',
      'progression',
      'progress signal',
      'продвижение',
      'развитие сцены'
    ])
  }),
  'phase-open-loop': Object.freeze({
    phase_transition_candidate: defineKindEntry('переход между фазами, состояниями или этапами', [
      'phase_transition_candidate',
      'phase_transition',
      'phase transition',
      'phase-transition',
      'переход фазы',
      'переход_фазы'
    ]),
    phase_marker_signal: defineKindEntry('маркер текущей фазы, этапа или состояния', [
      'phase_marker_signal',
      'phase_marker',
      'phase marker',
      'маркер фазы',
      'маркер_фазы'
    ]),
    plan_marker_signal: defineKindEntry('маркер плана, намерения или структуры действий', [
      'plan_marker_signal',
      'plan_marker',
      'plan marker',
      'маркер плана',
      'маркер_плана'
    ]),
    milestone_signal: defineKindEntry('значимая веха или достигнутый рубеж', [
      'milestone',
      'веха',
      'рубеж'
    ]),
    open_loop_candidate: defineKindEntry('незавершенная тема, вопрос или процесс', [
      'open_loop',
      'open loop',
      'незавершенный цикл',
      'незавершенный_цикл',
      'открытая петля'
    ]),
    deferred_topic_signal: defineKindEntry('сигнал отложенной темы', [
      'deferred_topic_signal',
      'deferred_topic',
      'deferred topic',
      'отложенная тема',
      'отложенная_тема'
    ]),
    pending_step_signal: defineKindEntry('сигнал шага, который еще предстоит сделать', [
      'pending_step_signal',
      'pending_step',
      'pending step',
      'ожидающий шаг',
      'ожидающий_шаг'
    ]),
    dependency_signal: defineKindEntry('зависимость, блокер или условие для продолжения', [
      'dependency',
      'зависимость',
      'блокер'
    ])
  }),
  'cognition-realization': Object.freeze({
    realization_candidate: defineKindEntry('осознание, замеченное понимание или вывод', [
      'realization_candidate',
      'realization_signal',
      'realization',
      'осознание',
      'понял'
    ]),
    cognitive_update_candidate: defineKindEntry('обновление картины понимания или внутренней модели', [
      'cognitive_update_candidate',
      'cognitive_update',
      'cognitive update',
      'когнитивное обновление',
      'когнитивное_обновление'
    ]),
    reframing_signal: defineKindEntry('сигнал переосмысления того же материала в новой рамке', [
      'reframing',
      'переосмысление'
    ]),
    interpretation_shift_signal: defineKindEntry('изменение интерпретации, смысла или чтения ситуации', [
      'interpretation_shift_signal',
      'interpretation_shift',
      'interpretation shift',
      'сдвиг интерпретации',
      'сдвиг_интерпретации'
    ]),
    certainty_shift_signal: defineKindEntry('изменение уверенности, сомнения или определенности', [
      'certainty_shift_signal',
      'certainty_shift',
      'certainty shift',
      'сдвиг уверенности',
      'сдвиг_уверенности'
    ])
  }),
  'emotion-atmosphere-significance': Object.freeze({
    emotional_state_candidate: defineKindEntry('зафиксированное эмоциональное состояние', [
      'emotional_state_candidate',
      'emotional_state',
      'emotional state',
      'эмоциональное состояние',
      'эмоциональное_состояние'
    ]),
    emotional_shift_candidate: defineKindEntry('изменение эмоционального состояния', [
      'emotional_shift_candidate',
      'emotional_shift',
      'emotional shift',
      'эмоциональный сдвиг',
      'эмоциональный_сдвиг'
    ]),
    atmosphere_candidate: defineKindEntry('атмосфера или общий эмоциональный фон сцены', [
      'atmosphere_candidate',
      'atmosphere_signal',
      'atmosphere',
      'атмосфера',
      'фон сцены'
    ]),
    tone_signal: defineKindEntry('сигнал тона высказывания или взаимодействия', [
      'tone',
      'тон'
    ]),
    significance_candidate: defineKindEntry('сигнал важности, веса или возможных последствий', [
      'significance_candidate',
      'significance_signal',
      'significance',
      'значимость',
      'важность'
    ]),
    emphasis_signal: defineKindEntry('сигнал акцента или смыслового выделения', [
      'emphasis',
      'акцент',
      'выделение'
    ])
  }),
  'relationship-social': Object.freeze({
    relationship_candidate: defineKindEntry('значимый социальный сигнал об отношении между участниками', [
      'relationship_candidate',
      'relationship_signal',
      'relationship',
      'отношение',
      'связь'
    ]),
    collaboration_signal: defineKindEntry('сигнал совместности, координации или общей работы', [
      'collaboration',
      'сотрудничество',
      'координация'
    ]),
    vulnerability_signal: defineKindEntry('сигнал уязвимости, раскрытия слабого места или просьбы о бережности', [
      'vulnerability',
      'уязвимость'
    ]),
    openness_signal: defineKindEntry('сигнал открытости, доверия или готовности делиться', [
      'openness',
      'открытость',
      'доверие'
    ]),
    boundary_signal: defineKindEntry('сигнал границы, ограничения или условий допустимого', [
      'boundary',
      'граница',
      'ограничение'
    ]),
    addressing_signal: defineKindEntry('сигнал формы обращения или адресации к другому участнику', [
      'addressing',
      'обращение',
      'адресация'
    ])
  })
})

const FALLBACK_KIND_BY_PASS = Object.freeze({
  'entity-object-location': 'object_candidate',
  fact: 'fact_candidate',
  episode: 'episode_candidate',
  'phase-open-loop': 'phase_marker_signal',
  'cognition-realization': 'cognitive_update_candidate',
  'emotion-atmosphere-significance': 'emotional_state_candidate',
  'relationship-social': 'relationship_candidate'
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

    for (const [normalizedKind, entry] of Object.entries(entryMap)) {
      aliasMap[canonicalizeKindAlias(normalizedKind)] = normalizedKind

      for (const alias of entry.aliases) {
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

function getAllowedKindDescriptionsForPass(passKey) {
  return Object.entries(KIND_REGISTRY[passKey] || {}).map(([kind, entry]) => ({
    kind,
    description: entry.description
  }))
}

function getFallbackKindForPass(passKey) {
  const normalizedPassKey = String(passKey || '').trim()
  return FALLBACK_KIND_BY_PASS[normalizedPassKey] || 'unknown_candidate_kind'
}

module.exports = {
  KIND_REGISTRY,
  KIND_ALIAS_TO_NORMALIZED_BY_PASS,
  FALLBACK_KIND_BY_PASS,
  canonicalizeKindAlias,
  getNormalizedKindsForPass,
  getAllowedKindDescriptionsForPass,
  getFallbackKindForPass
}
