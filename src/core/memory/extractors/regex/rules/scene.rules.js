'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function isFalseLocationScene(source) {
  if (!source) return true

  return (
    /^ручка\s+и\s+листочек\s+пустые/.test(source) ||
    /^я\s+стою(\s|$|[.,!?:;\-])/.test(source) ||
    /я\s+стою[\s\S]*(нейтральн|отстран)/.test(source)
  )
}

function buildSceneCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload = {}
}) {
  return makeCandidate({
    type: 'scene',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'scene.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `scene::${subtype}::${text.toLowerCase()}`,
    payload
  })
}

function isAnchoredAtmosphere(source) {
  return (
    /(^|[\s,.:;!?-])(душно|душновато|прохладно|холодно|тихо|темно|тёмно|пусто)(?=$|[\s,.:;!?-])/i.test(source) &&
    (
      /(^|[\s,.:;!?-])(здесь|тут|вокруг)(?=$|[\s,.:;!?-])/i.test(source) ||
      /(^|[\s,.:;!?-])в\s+(кабинете|комнате|офисе)(?=$|[\s,.:;!?-])/i.test(source)
    )
  )
}

function isAnchoredLocation(source) {
  return (
    /(^|[\s,.:;!?-])(я|мы)\s+в\s+(вет\s+клинике|клинике|кабинете|комнате|офисе)(?=$|[\s,.:;!?-])/i.test(source) ||
    /(^|[\s,.:;!?-])(я|мы)\s+(сижу|сидим|стою|стоим|лежу|лежим|сел|села|сели|находимся)(?=$|[\s,.:;!?-])/i.test(source) ||
    /(^|[\s,.:;!?-])(рядом\s+с\s+тобой|рядом\s+со\s+мной|перед\s+нами|передо\s+мной)(?=$|[\s,.:;!?-])/i.test(source)
  )
}

function isFalseScene(source, context) {
  if (!source) return true
  if (context.isQuestion) return true

  if (
    /(^|[\s,.:;!?-])(я хочу|я называю|ты была|у тебя было|у тебя не было|мне хотелось бы|мы договорились|я обещаю)(?=$|[\s,.:;!?-])/i.test(source)
  ) {
    return true
  }

  if (
    /(^|[\s,.:;!?-])(улыбнулся|улыбнулась|посмеялся|посмеялась|рассмеялся|рассмеялась|сделал паузу|сделала паузу|пожал плечами)(?=$|[\s,.:;!?-])/i.test(source)
  ) {
    return true
  }

  if (!context.isRp && source.length > 140) {
    return true
  }

  return false
}

function detectOne({ clause, context }) {
  const clauseText = clause?.clauseText || ''
  const unitText = clause?.text || clauseText
  const clauseSource = normalize(clauseText)
  const unitSource = normalize(unitText)

  const results = []

  if (!clauseText) return results
  if (isFalseScene(clauseSource, context)) return results

  if (isAnchoredAtmosphere(clauseSource)) {
    results.push(
      buildSceneCandidate({
        subtype: 'atmosphere',
        text: clauseText,
        clause,
        context,
        rule: 'anchored_atmosphere_v2',
        confidence: 0.84,
        payload: {
          sceneKind: 'atmosphere'
        }
      })
    )
  }

  if (isAnchoredLocation(unitSource) && !isFalseLocationScene(unitSource)) {
    results.push(
      buildSceneCandidate({
        subtype: 'location',
        text: unitText,
        clause,
        context,
        rule: 'anchored_location_v2',
        confidence: 0.8,
        payload: {
          sceneKind: 'location'
        }
      })
    )
  }

  return results
}

async function detect({ clauses }) {
  return runRuleList({ clauses, detectOne })
}

module.exports = {
  detect
}
