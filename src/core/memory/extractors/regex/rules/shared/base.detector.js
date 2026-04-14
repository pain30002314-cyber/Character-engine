'use strict'

function runRuleList({ clauses, detectOne }) {
  const results = []

  for (const entry of clauses) {
    const detected = detectOne(entry) || []
    if (detected.length) results.push(...detected)
  }

  return results
}

module.exports = {
  runRuleList
}