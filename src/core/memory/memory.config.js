const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

module.exports = {
  dataDir: DATA_DIR,
  files: {
    events: path.join(DATA_DIR, 'events.json'),
    memory: path.join(DATA_DIR, 'memory.json'),
    snapshot: path.join(DATA_DIR, 'snapshot.json')
  },
  limits: {
    recentDialogPerThread: 8,
    maxEventsPerThread: 120,

    maxFacts: 40,
    maxEntities: 40,
    maxOpenLoops: 20,
    maxRelationshipSignals: 25,
    maxEpisodicMemories: 20,

    snapshotFacts: 6,
    snapshotEntities: 6,
    snapshotOpenLoops: 4,
    snapshotRelationshipSignals: 4,
    snapshotEpisodes: 3,

    maxCanonicalItems: 200,
    maxRawExtractions: 30,

    rawContextEvents: 6,
    rawContextCharsPerEvent: 1200
  },
  queue: {
    maxJobs: 1000
  }
}