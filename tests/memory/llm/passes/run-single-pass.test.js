'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildEvent, buildPass, createTempDir, freshRequire } = require('../helpers')

test('runSingleExtractorPass returns partial result when one candidate is dropped by validation', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('run-single-pass-')

  process.chdir(tempDir)

  try {
    const { runSingleExtractorPass } = freshRequire(
      'src/core/memory/extractors/llm/shared/run-single-pass.js'
    )
    const result = await runSingleExtractorPass({
      pass: buildPass(),
      event: buildEvent(),
      eventWindow: [],
      llm: {
        callModel: async () => ({
          rawResponseText: JSON.stringify({
            candidates: [
              {
                kind: 'факт',
                text: 'валидный сигнал',
                summary: 'валидный сигнал',
                importance: 'средняя',
                tags: ['сигнал'],
                payload: {}
              },
              {
                kind: 'факт',
                text: '',
                summary: 'сломанный сигнал',
                payload: {}
              }
            ]
          }),
          model: 'mock-model'
        })
      },
      runtime: {
        traceId: 'trace-pass'
      },
      flowConfig: {
        extractorVersion: '1.0.0'
      }
    })

    assert.equal(result.status, 'partial')
    assert.equal(result.candidates.length, 1)
    assert.match(result.rawResponseText, /валидный сигнал/)
  } finally {
    process.chdir(previousCwd)
  }
})
