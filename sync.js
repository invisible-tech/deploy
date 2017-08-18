#!/usr/bin/env node
'use strict'

const assert = require('assert')
const gcs = require('@google-cloud/storage')()
const { includes, map, filter, flatten } = require('lodash/fp')

// eslint-disable no-console

const branch = process.env.GAE_SERVICE === 'default'
  ? 'production'
  : process.env.GAE_SERVICE

const forCurrentEnvironment = ({ name }) =>
  includes(branch)(name)

const fixName = name => name.replace(/^\w+\//, '')

const download = file => {
  const destination = fixName(file.name)
  console.log(`Downloading file: ${destination}`)
  return file.download({ destination })
}

const sync = async () => {
  const bucketName = `${process.env.GCLOUD_PROJECT}-backend`
  const bucket = gcs.bucket(bucketName)
  const [exists] = await bucket.exists()

  if (exists) {
    const msg = [
      `Syncing static files for ${process.env.GCLOUD_PROJECT}`,
      `service: ${process.env.GAE_SERVICE}`,
      `from ${bucketName}`
    ].join(' ')
    console.log(msg)
    bucket
      .getFiles()
      .then(flatten)
      .then(filter(forCurrentEnvironment))
      .then(map(download))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  } else console.log(`${bucketName} doesn't exist, skipping static file sync.`)
}

if (process.env.GCLOUD_PROJECT) {
  sync()
}
