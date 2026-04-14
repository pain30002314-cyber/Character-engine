/**
 * Здесь пока только shape-комментарии.
 * Позже сюда добавим валидаторы состояний.
 */

const DEFAULT_PERSONALITY_STATE = {
  tone: 'hutao_core',
  stability: 1
}

const DEFAULT_RELATIONSHIP_STATE = {
  closeness: 0,
  trust: 0,
  tension: 0
}

const DEFAULT_MOOD_STATE = {
  mood: 'neutral_playful',
  intensity: 0.2
}

module.exports = {
  DEFAULT_PERSONALITY_STATE,
  DEFAULT_RELATIONSHIP_STATE,
  DEFAULT_MOOD_STATE
}