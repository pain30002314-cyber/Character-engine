'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_TIME_CONTEXT = {
  timezone: 'Asia/Krasnoyarsk',
  utcOffsetMinutes: 420
}

const TIME_CONTEXT_FILE = path.join(process.cwd(), 'data', 'config', 'time-context.json')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }

    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

function ensureTimeContextFile() {
  if (fs.existsSync(TIME_CONTEXT_FILE)) {
    return
  }

  ensureDir(path.dirname(TIME_CONTEXT_FILE))
  fs.writeFileSync(
    TIME_CONTEXT_FILE,
    JSON.stringify(DEFAULT_TIME_CONTEXT, null, 2),
    'utf-8'
  )
}

function getTimeContext() {
  const disk = readJsonSafe(TIME_CONTEXT_FILE)

  if (
    disk &&
    typeof disk === 'object' &&
    typeof disk.timezone === 'string' &&
    disk.timezone.trim() &&
    Number.isFinite(disk.utcOffsetMinutes)
  ) {
    return {
      timezone: disk.timezone.trim(),
      utcOffsetMinutes: Number(disk.utcOffsetMinutes)
    }
  }

  return { ...DEFAULT_TIME_CONTEXT }
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  const mins = String(abs % 60).padStart(2, '0')
  return `${sign}${hours}:${mins}`
}

function toOffsetIso(dateInput, utcOffsetMinutes) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000)

  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hours = String(shifted.getUTCHours()).padStart(2, '0')
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0')
  const seconds = String(shifted.getUTCSeconds()).padStart(2, '0')
  const milliseconds = String(shifted.getUTCMilliseconds()).padStart(3, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${formatOffset(utcOffsetMinutes)}`
}

function getNowTimestamp() {
  const context = getTimeContext()
  return toOffsetIso(new Date(), context.utcOffsetMinutes)
}

function enrichMetaWithTimeContext(meta = {}) {
  const context = getTimeContext()

  return {
    ...meta,
    timezone:
      typeof meta.timezone === 'string' && meta.timezone.trim()
        ? meta.timezone.trim()
        : context.timezone,
    utcOffsetMinutes:
      Number.isFinite(meta.utcOffsetMinutes)
        ? Number(meta.utcOffsetMinutes)
        : context.utcOffsetMinutes
  }
}

module.exports = {
  getTimeContext,
  getNowTimestamp,
  enrichMetaWithTimeContext,
  ensureTimeContextFile,
  toOffsetIso
}