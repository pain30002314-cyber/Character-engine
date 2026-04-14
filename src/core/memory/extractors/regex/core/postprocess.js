'use strict'

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.!?…,:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameUnit(a, b) {
  return normalize(a?.unitText || a?.text) === normalize(b?.unitText || b?.text)
}

function sameText(a, b) {
  return normalize(a?.text) === normalize(b?.text)
}

function hasAtom(list, predicate) {
  return list.some(predicate)
}

function isIdentityDisplayName(atom) {
  return atom?.type === 'identity' && atom?.subtype === 'display_name'
}

function isUserNameFact(atom) {
  if (atom?.type !== 'fact' || atom?.subtype !== 'user') return false
  const keyHint = String(atom?.payload?.keyHint || '').toLowerCase()
  const text = normalize(atom?.text)
  return keyHint === 'display_name' || /^меня зовут\s+/.test(text)
}

function isSelfNamedPersonEntity(atom) {
  if (atom?.type !== 'entity' || atom?.subtype !== 'person') return false
  const unit = normalize(atom?.unitText || atom?.text)
  return /^меня зовут\s+/.test(unit)
}

function isRelationshipAffection(atom) {
  return atom?.type === 'relationship' && atom?.subtype === 'affection'
}

function isAffectAffection(atom) {
  return atom?.type === 'affect' && atom?.subtype === 'affection'
}

function isEpisodeInteraction(atom) {
  return atom?.type === 'episode' && atom?.subtype === 'interaction'
}

function isEpisodeEmotional(atom) {
  return atom?.type === 'episode' && atom?.subtype === 'emotional_moment'
}

function isEpisodeEvent(atom) {
  return atom?.type === 'episode' && atom?.subtype === 'event'
}

function isEpisodeScene(atom) {
  return atom?.type === 'episode' && atom?.subtype === 'scene'
}

function isActionPhysical(atom) {
  return atom?.type === 'action' && atom?.subtype === 'physical'
}

function isActionGesture(atom) {
  return atom?.type === 'action' && atom?.subtype === 'gesture'
}

function isActionPauseish(atom) {
  if (atom?.type !== 'action') return false
  const text = normalize(atom?.text)
  return atom?.subtype === 'pause' || atom?.subtype === 'attention_shift' || /^я\s+молчал/.test(text)
}

function isTemporalAnchorNow(atom) {
  return atom?.type === 'temporal' && atom?.subtype === 'anchor_now'
}

function isTemporalSequence(atom) {
  return atom?.type === 'temporal' && atom?.subtype === 'sequence'
}

function isInstructionConversation(atom) {
  return atom?.type === 'instruction' && atom?.subtype === 'conversation_instruction'
}

function isSceneLocation(atom) {
  return atom?.type === 'scene' && atom?.subtype === 'location'
}

function isSceneAtmosphere(atom) {
  return atom?.type === 'scene' && atom?.subtype === 'atmosphere'
}

function isEntity(atom, value, subtype = null) {
  if (atom?.type !== 'entity') return false
  if (subtype && atom?.subtype !== subtype) return false
  return normalize(atom?.text) === normalize(value)
}

function isEmotionalExclamationOpenLoop(atom) {
  if (atom?.type !== 'open_loop' || atom?.subtype !== 'direct_question') return false
  const text = normalize(atom?.text)
  return /^как\s+же\s+я\s+/.test(text) || /^как\s+я\s+/.test(text)
}

function isWeakGenericObjectEntity(atom) {
  if (atom?.type !== 'entity' || atom?.subtype !== 'object') return false
  const text = normalize(atom?.text)
  return ['механизм', 'система', 'лог', 'логи', 'файл', 'файлы'].includes(text)
}

function isWeakSystemRegex(atom) {
  return atom?.type === 'entity' && atom?.subtype === 'system' && normalize(atom?.text) === 'regex'
}

function isWeakRelativeFuture(atom) {
  if (atom?.type !== 'temporal' || atom?.subtype !== 'relative_future') return false
  const text = normalize(atom?.text)

  const hasFutureVerb =
    /(вернемся|вернёмся|обсудим|поговорим|посмотрим|сделаю|проверю|добью|разберу|разберусь|займусь|продолжим)/i.test(text)

  if (hasFutureVerb) return false
  if (/^потом\b/.test(text)) return true
  if (/\bпотом\b/.test(text) && !hasFutureVerb) return true

  return false
}

function isWeakPhase(atom) {
  if (atom?.type !== 'temporal' || atom?.subtype !== 'phase') return false
  const text = normalize(atom?.text)

  if (/^пока\b/.test(text) && !/\bне\b/.test(text)) {
    return true
  }

  return false
}

function isWeakSequenceExplanation(atom) {
  if (!isTemporalSequence(atom)) return false
  const text = normalize(atom?.text)

  return (
    text.includes('вместо того, чтобы сначала') ||
    text.includes('сначала разобраться') ||
    text.includes('на самом деле') ||
    text.includes('не повлияло бы')
  )
}

function isWeakConversationInstruction(atom) {
  if (!isInstructionConversation(atom)) return false
  const text = normalize(atom?.text)

  return (
    text.includes('вместо того, чтобы сначала') ||
    text.includes('на самом деле') ||
    text.includes('это ни на что') ||
    text.includes('не более')
  )
}

function isWeakInteraction(atom) {
  if (atom?.type !== 'action' || atom?.subtype !== 'interaction') return false
  const text = normalize(atom?.text)

  return (
    text === 'в том, как я смотрю' ||
    text === 'смотрю на тебя пристально' ||
    text === 'смотрю на тебя, и в глазах появляется что-то тихое, почти печальное, но без драмы' ||
    text.startsWith('смотрю на тебя') ||
    text.startsWith('в том, как я смотрю')
  )
}

function isWeakEmotionalEpisode(atom) {
  if (atom?.type !== 'episode' || atom?.subtype !== 'emotional_moment') return false
  const text = normalize(atom?.text)

  return (
    text === 'я задумался' ||
    text === 'я чуть посмеялся'
  )
}

function isWeakGesture(atom) {
  if (!isActionGesture(atom)) return false
  const text = normalize(atom?.text)

  return (
    text === 'я пожал плечами' ||
    text === 'я тихонько посмеялся' ||
    text === 'киваю на робота' ||
    text === 'я задумался' ||
    text === 'я чуть посмеялся' ||
    text === 'я чуть наклонил голову в бок' ||
    text.startsWith('возвращаю взгляд к тебе') ||
    text.includes('улыбаюсь криво')
  )
}

function isWeakSceneAtmosphere(atom) {
  if (!isSceneAtmosphere(atom)) return false
  const text = normalize(atom?.text)

  return (
    text === 'я тихонько посмеялся' ||
    text === 'я посмеялся' ||
    text === 'легкая усмешка' ||
    text === 'лёгкая усмешка'
  )
}

function isWeakGesture(atom) {
  if (!isActionGesture(atom)) return false
  const text = normalize(atom?.text)

  return (
    text === 'я пожал плечами' ||
    text === 'я тихонько посмеялся' ||
    text === 'киваю на робота' ||
    text === 'я задумался' ||
    text === 'я чуть посмеялся' ||
    text === 'я чуть наклонил голову в бок' ||
    /^возвращаю\s+взгляд\s+к\s+тебе(?:\s|,|$)/i.test(text) ||
    /^поворачиваюсь\s+к\s+тебе(?:\s|,|$)/i.test(text) ||
    /улыбаюсь\s+(?:чуть\s+)?криво/i.test(text)
  )
}

function dropShadowedAtoms(atoms) {
  const list = Array.isArray(atoms) ? atoms : []

  return list.filter((atom) => {
      if (atom?.type === 'action' && atom?.subtype === 'gesture') {
      const text = normalize(atom?.text)

      if (
        /^возвращаю\s+взгляд\s+к\s+тебе(?:\s|,|$)/i.test(text) ||
        /^поворачиваюсь\s+к\s+тебе(?:\s|,|$)/i.test(text)
      ) {
        return false
      }

      if (/улыбаюсь\s+(?:чуть\s+)?криво/i.test(text)) {
        return false
      }
    }
    if (isWeakInteraction(atom)) return false
    if (isWeakEmotionalEpisode(atom)) return false
    if (isEmotionalExclamationOpenLoop(atom)) return false
    if (isWeakGenericObjectEntity(atom)) return false
    if (isWeakSystemRegex(atom)) return false
    if (isWeakRelativeFuture(atom)) return false
    if (isWeakPhase(atom)) return false
    if (isWeakSequenceExplanation(atom)) return false
    if (isWeakConversationInstruction(atom)) return false
    if (isWeakSceneAtmosphere(atom)) return false
    if (isWeakGesture(atom)) return false

    if (isUserNameFact(atom)) {
      const hasIdentity = hasAtom(list, (other) => other !== atom && isIdentityDisplayName(other) && sameUnit(other, atom))
      if (hasIdentity) return false
    }

    if (isSelfNamedPersonEntity(atom)) {
      const hasIdentity = hasAtom(list, (other) => other !== atom && isIdentityDisplayName(other) && sameUnit(other, atom))
      if (hasIdentity) return false
    }

    if (isAffectAffection(atom)) {
      const hasRelationship = hasAtom(list, (other) => other !== atom && isRelationshipAffection(other) && sameUnit(other, atom))
      if (hasRelationship) return false
    }

    if (isActionPhysical(atom)) {
      const hasEpisodeInteraction = hasAtom(list, (other) => other !== atom && isEpisodeInteraction(other) && sameUnit(other, atom))
      if (hasEpisodeInteraction) return false
    }

    if (isActionGesture(atom) || isActionPauseish(atom)) {
      const hasEpisodeEmotionalMoment = hasAtom(list, (other) => other !== atom && isEpisodeEmotional(other) && sameUnit(other, atom))
      if (hasEpisodeEmotionalMoment) return false
    }

    if (atom?.type === 'action' && atom?.subtype === 'action') {
      const hasEpisodeSceneMatch = hasAtom(list, (other) => other !== atom && isEpisodeScene(other) && sameUnit(other, atom))
      if (hasEpisodeSceneMatch) return false
    }

    if (isEpisodeScene(atom)) {
      const hasSceneLocationMatch = hasAtom(list, (other) => other !== atom && isSceneLocation(other) && sameUnit(other, atom))
      if (hasSceneLocationMatch) return false
    }

    if (isSceneLocation(atom)) {
      const unit = normalize(atom?.unitText || atom?.text)
      const looksEventish = /^перед\s+нами\s+появил/.test(unit) || /^прош[её]л\s+час/.test(unit)
      if (looksEventish) {
        const hasEpisodeEventMatch = hasAtom(list, (other) => other !== atom && isEpisodeEvent(other) && sameUnit(other, atom))
        if (hasEpisodeEventMatch) return false
      }
    }

    if (isSceneLocation(atom)) {
      const text = normalize(atom?.text)
      if (/^(в\s+кабинете\s+душновато|в\s+комнате\s+прохладно|здесь\s+прохладно|вокруг\s+меня\s+тихо|пасмурно\s+сегодня)$/.test(text)) {
        const hasAtmosphere = hasAtom(list, (other) => other !== atom && isSceneAtmosphere(other) && sameUnit(other, atom))
        if (hasAtmosphere) return false
      }
    }

    if (isTemporalAnchorNow(atom)) {
      const text = normalize(atom?.text)
      const hasFactSameUnit = hasAtom(list, (other) => other !== atom && other?.type === 'fact' && sameUnit(other, atom))
      if (hasFactSameUnit) {
        if (
          /^сейчас\s+ты\s+жив/.test(text) ||
          /^сейчас\s+смотрим/.test(text) ||
          /^сейчас\s+работаем/.test(text)
        ) {
          return false
        }
      }
    }

    if (isEntity(atom, 'regex', 'system')) {
      const hasRegexExtractor = hasAtom(list, (other) => other !== atom && isEntity(other, 'regex extractor', 'project') && sameUnit(other, atom))
      if (hasRegexExtractor) return false
    }

    if (atom?.type === 'entity' && atom?.subtype === 'person') {
      const hasIdentity = hasAtom(list, (other) => other !== atom && isIdentityDisplayName(other) && sameUnit(other, atom))
      if (hasIdentity && sameText(atom, { text: atom.text })) {
        const unit = normalize(atom?.unitText || atom?.text)
        if (/^меня зовут\s+/.test(unit)) return false
      }
    }

    return true
  })
}

module.exports = {
  dropShadowedAtoms
}