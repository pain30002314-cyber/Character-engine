const fs = require('fs')
const path = require('path')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function ensureJsonFile(filePath, defaultValue) {
  ensureDir(path.dirname(filePath))

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8')
  }
}

function readJson(filePath, defaultValue) {
  ensureJsonFile(filePath, defaultValue)

  const raw = fs.readFileSync(filePath, 'utf-8')

  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${filePath}`)
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

module.exports = {
  ensureDir,
  ensureJsonFile,
  readJson,
  writeJson
}