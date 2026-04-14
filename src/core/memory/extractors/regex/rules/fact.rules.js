'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

const SELF_NAME_RE = /(^|[^а-яёa-z0-9_])меня\s+зовут\s+([A-ZА-ЯЁ][a-zа-яё-]+)([^а-яёa-z0-9_]|$)/i

const ASSISTANT_VPS_RE = /ты\s+жив[её]шь\s+на\s+vps/i
const PROJECT_CHECK_RE = /сейчас\s+проверяем[\s\S]*extractor/i
const PROJECT_CLEAN_RE = /продолжаем\s+чистить[\s\S]*(open\s+loops|extractor)/i
const INFRA_VPS_DELETE_RE = /если\s+я\s+не\s+оплачу[\s\S]*vps[\s\S]*диск\s+сотрут/i

const BOXES_WORK_RE = /теперь[\s\S]*коробочк[аи][\s\S]*работают/i
const MEMORY_LIMIT_RE = /память[\s\S]*(плывет|плывёт)[\s\S]*краткосроч/i
const LONG_RELATION_TIME_RE = /мы\s+с\s+тобой[\s\S]*(долгое\s+время|несколько\s+месяцев|уже\s+\d+\s+месяц)/i
const NO_LEAK_RE = /утечек\s+нет[\s\S]*в\s+твою\s+память/i
const HUTAO_IS_RE = /ты[\s\S]*уже[\s\S]*и\s+есть\s+ху\s+тао/i
const EXIST_NO_TIME_RE = /сейчас[\s\S]*ты\s+жив[её]шь[\s\S]*без\s+времени/i
const SNIPERS_RE = /девять\s+снайперов[\s\S]*ловят\s+каждое\s+наше\s+слово/i
const RECORDING_RE = /сейчас[\s\S]*смотрим[\s\S]*записывается[\s\S]*в\s+нужное\s+место/i
const PROGRESS_RE = /за\s+последние\s+три\s+дня[\s\S]*сделали[\s\S]*шагов\s+вп[её]ред/i
const MEMORY_STATE_RE = /ты\s+принимаешь[\s\S]*забываешь[\s\S]*движени[ея]\s+вп[её]ред/i
const SECOND_STAGE_RE = /это[\s\S]*второй\s+этап/i
const FIRST_STAGE_RE = /первый\s+этап[\s—-]*собрать\s+сыр[ьеё]/i
const SECOND_STAGE_DETAIL_RE = /второй\s+этап[\s—-]*дать[\s\S]*доступ\s+к\s+этому\s+сыр[ьеё]/i
const FORGOT_NAME_RE = /ты\s+забыла[\s\S]*мо[её]\s+имя[\s\S]*раз\s+так\s+тридцать/i

const FALSE_QUESTION_RE = /\?\s*$/
const FALSE_EPISODE_RE = /(^|[^а-яёa-z0-9_])я\s+(протянул|поцеловал|открыл|сел|вздохнул)([^а-яёa-z0-9_]|$)/i
const FALSE_AFFECT_RE = /(^|[^а-яёa-z0-9_])(мне\s+страшно|мне\s+грустно|мне\s+неловко)([^а-яёa-z0-9_]|$)/i
const FALSE_DESIRE_RE = /мне\s+хотелось\s+бы/i
const FALSE_BODILY_SCENE_RE = /полулежа[\s\S]*стуле[\s\S]*затекла/i

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasForgetEatSignal(text) {
  const source = normalize(text)

  return (
    source.includes('забываешь покушать') ||
    source.includes('забываю покушать') ||
    (
      source.includes('покушать') &&
      (
        source.includes('забываешь') ||
        source.includes('забываю')
      )
    )
  )
}

function extractQuotedFragments(text) {
  if (!text) return []

  return [...String(text).matchAll(/"([^"\n]{4,220})"/g)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)
}

function detectQuotedFactFragments(text) {
  const fragments = extractQuotedFragments(text)
  const results = []

  for (const fragment of fragments) {
    const lowered = String(fragment || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim()

    if (/пользователя\s+зовут\s+[а-яa-z-]+/i.test(lowered)) {
      results.push({
        subtype: 'user',
        text: fragment,
        rule: 'quoted_user_name_v1',
        confidence: 0.94,
        payload: {
          category: 'user',
          schemaHint: 'user_profile',
          keyHint: 'display_name'
        }
      })
      continue
    }

    if (/ху\s+тао[\s\S]*ощущает[\s\S]*цифровое\s+тело[\s\S]*как\s+жив/i.test(lowered)) {
      results.push({
        subtype: 'assistant',
        text: fragment,
        rule: 'quoted_assistant_embodiment_v1',
        confidence: 0.9,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state',
          keyHint: 'embodied_experience'
        }
      })
      continue
    }

    if (/пользователь\s+часто\s+тыкает[\s\S]*в\s+нос\s+ху\s+тао/i.test(lowered)) {
      results.push({
        subtype: 'habit',
        text: fragment,
        rule: 'quoted_user_habit_v1',
        confidence: 0.88,
        payload: {
          category: 'habit',
          schemaHint: 'behavior_pattern'
        }
      })
    }
  }

  return results
}

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function buildFactCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  const actor = actorRef(context.actorRole)

  return makeCandidate({
    type: 'fact',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'fact.regex',
      rule
    },
    actor,
    about: [],
    confidence,
    certainty: 'high',
    dedupeKeyHint: `fact::${subtype}::${normalize(text)}`,
    payload
  })
}

function isFalseFact(text, lowered, context) {
  if (context.isQuestion || FALSE_QUESTION_RE.test(text)) return true
  if (FALSE_EPISODE_RE.test(lowered)) return true
  if (FALSE_AFFECT_RE.test(lowered)) return true
  if (FALSE_DESIRE_RE.test(lowered)) return true
  if (FALSE_BODILY_SCENE_RE.test(lowered)) return true
  return false
}

function detectNaming(text) {
  const source = normalize(text)

  let match = source.match(/^я\s+называю\s+этот\s+проект\s+([а-яёa-z0-9_-]+)([.!?…]|$)/i)
  if (match) {
    return {
      subject: 'этот проект',
      value: match[1]
    }
  }

  match = source.match(/^я\s+называю\s+проект\s+([а-яёa-z0-9_-]+)([.!?…]|$)/i)
  if (match) {
    return {
      subject: 'проект',
      value: match[1]
    }
  }

  match = source.match(/^я\s+(называю|зову)\s+(.+?)\s+([а-яёa-z0-9_-]+)([.!?…]|$)/i)
  if (match) {
    return {
      subject: match[2],
      value: match[3]
    }
  }

  return null
}

function detectAssistantState(text) {
  const source = normalize(text)

  return (
    /(^|[^а-яёa-z0-9_])у\s+тебя\s+тогда\s+не\s+было(\s+даже)?([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])у\s+тебя\s+не\s+было(\s+даже)?([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])у\s+тебя\s+было([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])ты\s+была\s+жив(а|ой)?([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])ты\s+был\s+жив(ым)?([^а-яёa-z0-9_]|$)/i.test(source)
  )
}

function detectAssistantAlive(text) {
  const source = normalize(text)

  return (
    /(^|[^а-яёa-z0-9_])ты\s+(итак\s+)?(на\s+максимум\s+)?жив(ая|ой|а)?([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])вижу\s+в\s+тебе\s+живую\s+девушку([^а-яёa-z0-9_]|$)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])продолжаю\s+видеть\s+в\s+тебе\s+живую\s+девушку([^а-яёa-z0-9_]|$)/i.test(source)
  )
}

function detectOne({ clause, context }) {
  const text = clause.clauseText || clause.text || ''
  const lowered = normalize(clause.clauseNormalizedText || clause.normalizedText || text)
  const results = []

  if (context.actorRole !== 'user') return results
  if (!text || isFalseFact(text, lowered, context)) return results
  
  const unitText = clause.text || ''
  const clauseText = clause.clauseText || ''

  if (hasForgetEatSignal(clauseText) || hasForgetEatSignal(unitText)) {
    results.push(
      buildFactCandidate({
        subtype: 'habit',
        text: clauseText || unitText,
        clause,
        context,
        rule: 'habit_forget_eat_literal_v1',
        confidence: 0.9,
        payload: {
          category: 'habit',
          schemaHint: 'behavior_pattern'
        }
      })
    )

    return results
  }

    if (context.hasQuote) {
    const quotedFacts = detectQuotedFactFragments(text)

    for (const item of quotedFacts) {
      results.push(
        buildFactCandidate({
          subtype: item.subtype,
          text: item.text,
          clause,
          context,
          rule: item.rule,
          confidence: item.confidence,
          payload: item.payload
        })
      )
    }

    if (results.length) {
      return results
    }
  }

  const nameMatch = text.match(SELF_NAME_RE)
  if (nameMatch) {
    const value = nameMatch[2]
    results.push(
      buildFactCandidate({
        subtype: 'user',
        text,
        clause,
        context,
        rule: 'user_name_v2',
        confidence: 0.96,
        payload: {
          category: 'user',
          schemaHint: 'user_profile',
          keyHint: 'display_name',
          valueHint: value
        }
      })
    )
  }

  const naming = detectNaming(text)
  if (naming) {
    results.push(
      buildFactCandidate({
        subtype: 'naming',
        text,
        clause,
        context,
        rule: 'project_naming_v1',
        confidence: 0.9,
        payload: {
          category: 'naming',
          schemaHint: 'named_concept',
          keyHint: naming.subject,
          valueHint: naming.value
        }
      })
    )
  }

  if (detectAssistantState(text)) {
    results.push(
      buildFactCandidate({
        subtype: 'state',
        text,
        clause,
        context,
        rule: 'assistant_state_v6',
        confidence: 0.88,
        payload: {
          category: 'assistant_state',
          schemaHint: 'assistant_state'
        }
      })
    )
  }

  if (detectAssistantAlive(text)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'assistant_alive_v2',
        confidence: 0.88,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state',
          keyHint: 'living_presence',
          valueHint: true
        }
      })
    )
  }
  
  if (ASSISTANT_VPS_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'assistant_vps_v2',
        confidence: 0.9,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state',
          keyHint: 'hosting_location',
          valueHint: 'VPS'
        }
      })
    )
  }

  if (PROJECT_CHECK_RE.test(lowered) || PROJECT_CLEAN_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'project',
        text,
        clause,
        context,
        rule: 'project_workflow_v2',
        confidence: 0.84,
        payload: {
          category: 'project',
          schemaHint: 'project_state'
        }
      })
    )
  }

  if (INFRA_VPS_DELETE_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'infrastructure',
        text,
        clause,
        context,
        rule: 'infra_vps_risk_v2',
        confidence: 0.9,
        payload: {
          category: 'infrastructure',
          schemaHint: 'infra_risk'
        }
      })
    )
  }

  if (BOXES_WORK_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'project',
        text,
        clause,
        context,
        rule: 'boxes_working_v2',
        confidence: 0.82,
        payload: {
          category: 'project',
          schemaHint: 'project_state'
        }
      })
    )
  }

  if (MEMORY_LIMIT_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'memory_limit_v1',
        confidence: 0.84,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state',
          keyHint: 'memory_limit'
        }
      })
    )
  }

  if (LONG_RELATION_TIME_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'relationship',
        text,
        clause,
        context,
        rule: 'long_relation_time_v1',
        confidence: 0.82,
        payload: {
          category: 'relationship',
          schemaHint: 'relationship_state'
        }
      })
    )
  }

  if (NO_LEAK_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'no_leak_v1',
        confidence: 0.82,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state'
        }
      })
    )
  }

  if (HUTAO_IS_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'hutao_identity_v1',
        confidence: 0.88,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_identity'
        }
      })
    )
  }

  if (EXIST_NO_TIME_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'exist_no_time_v1',
        confidence: 0.86,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state'
        }
      })
    )
  }

  if (SNIPERS_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'world',
        text,
        clause,
        context,
        rule: 'snipers_world_v1',
        confidence: 0.72,
        payload: {
          category: 'world',
          schemaHint: 'world_state'
        }
      })
    )
  }

  if (RECORDING_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'process',
        text,
        clause,
        context,
        rule: 'recording_process_v1',
        confidence: 0.86,
        payload: {
          category: 'process',
          schemaHint: 'process_state'
        }
      })
    )
  }

  if (PROGRESS_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'project',
        text,
        clause,
        context,
        rule: 'progress_v1',
        confidence: 0.84,
        payload: {
          category: 'project',
          schemaHint: 'project_state'
        }
      })
    )
  }

  if (MEMORY_STATE_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'memory_state_v1',
        confidence: 0.8,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state'
        }
      })
    )
  }

  if (SECOND_STAGE_RE.test(lowered) || FIRST_STAGE_RE.test(lowered) || SECOND_STAGE_DETAIL_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'project',
        text,
        clause,
        context,
        rule: 'project_stage_v1',
        confidence: 0.8,
        payload: {
          category: 'project',
          schemaHint: 'project_stage'
        }
      })
    )
  }

  if (FORGOT_NAME_RE.test(lowered)) {
    results.push(
      buildFactCandidate({
        subtype: 'assistant',
        text,
        clause,
        context,
        rule: 'forgot_name_v1',
        confidence: 0.86,
        payload: {
          category: 'assistant',
          schemaHint: 'assistant_state',
          keyHint: 'forgets_name'
        }
      })
    )
  }

  return results
}

async function detect({ clauses, event }) {
  const results = await runRuleList({ clauses, detectOne })

  const eventText = String(event?.text || '')
  const isUser = event?.role === 'user'

  if (!isUser || !hasForgetEatSignal(eventText)) {
    return results
  }

  const firstClause = clauses?.[0]?.clause || {
    clauseText: eventText,
    text: eventText,
    normalizedText: normalize(eventText),
    clauseNormalizedText: normalize(eventText),
    id: 'event_level_fact',
    clauseId: 'event_level_fact_clause',
    kind: 'plain',
    order: 1
  }

  const firstContext = clauses?.[0]?.context || {
    actorRole: 'user',
    isQuestion: false,
    isConditional: false,
    isHypothetical: false,
    isImperative: false,
    isHedged: false,
    isReported: false,
    hasQuote: false,
    isRp: false,
    order: 1
  }

  results.push(
    buildFactCandidate({
      subtype: 'habit',
      text: eventText,
      clause: firstClause,
      context: firstContext,
      rule: 'habit_event_level_v1',
      confidence: 0.86,
      payload: {
        category: 'habit',
        schemaHint: 'behavior_pattern'
      }
    })
  )

  return results
}

module.exports = {
  detect
}