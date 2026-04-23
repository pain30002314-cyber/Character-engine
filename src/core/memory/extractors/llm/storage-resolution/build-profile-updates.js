'use strict'

const {
  uniqObjectsBy,
  buildResolutionId,
  pickStringList,
  pickFirstText
} = require('./helpers')

function buildProfileUpdate(item) {
  return {
    profileUpdateId: buildResolutionId(
      'profile_update',
      { candidateId: item?.candidateId || item?.nodeResolutionId || null },
      item?.nodeType || 'profile'
    ),
    nodeResolutionId: item?.nodeResolutionId || null,
    candidateId: item?.candidateId || null,
    displayName: item?.displayNameSeed || null,
    aliases: pickStringList(item?.aliasSeeds),
    appearanceSummary: null,
    meaningSummary: item?.summarySeed || null,
    atmosphereSummary: null,
    relationshipSummary: pickFirstText(...pickStringList(item?.roleSeeds)),
    opinionSummary: null,
    ownershipSummary: null,
    tagSeeds: item?.tagSeeds || [],
    provenance: item?.provenance || null
  }
}

function buildProfileUpdates({
  nodeResolutions = []
} = {}) {
  const entities = uniqObjectsBy(
    nodeResolutions.filter((item) => item?.nodeType === 'entity').map(buildProfileUpdate),
    (item) => item?.nodeResolutionId
  )
  const objects = uniqObjectsBy(
    nodeResolutions.filter((item) => item?.nodeType === 'object').map(buildProfileUpdate),
    (item) => item?.nodeResolutionId
  )
  const locations = uniqObjectsBy(
    nodeResolutions.filter((item) => item?.nodeType === 'location').map(buildProfileUpdate),
    (item) => item?.nodeResolutionId
  )

  return {
    entities,
    objects,
    locations
  }
}

module.exports = {
  buildProfileUpdates
}
