#!/usr/bin/env node
'use strict'

require('dotenv').config()
const { spawnSync } = require('child_process')

const { GCLOUD_PROJECT } = process.env
const usage = `Usage: deploy [setup|download|static|production|staging|branchName]

Argument can be:

  setup
      Creates the default backend bucket for this project.

  download
      Downloads all static files from the backend bucket.

  static
      Uploads all static files to the backend bucket.

  branchName
      Uploads branch static files and deploys the App to Google App Engine
      based on branchName.yaml file.
`

const verifyDependency = (condition, msg) => {
  if (! condition) {
    console.error(msg)
    process.exit(1)
  }
}


const execSafe = (cmd, args=[]) => {
  console.log(`> ${cmd} ${args.join(' ')}`)
  return spawnSync(cmd, args, { stdio: [null, process.stdout, process.stderr] })
}

const exec = (...args) => {
  const { status } = execSafe(...args)
  if (status !== 0) process.exit(status)
}

const [ argument, ] = process.argv.slice(2)

if (argument) {
  verifyDependency(GCLOUD_PROJECT, 'Sorry, you need to set a GCLOUD_PROJECT environment variable. You can set that in your local ".env" file.')
  verifyDependency(shell.which('gcloud'), 'Sorry, you need Google Cloud SDK installed. Get it on https://cloud.google.com/sdk/gcloud/')
  verifyDependency(shell.which('gsutil'), 'Sorry, you need "gsutil" Google Cloud Storage CLI installed. Get it on https://cloud.google.com/storage/docs/gsutil')

  const bucket = `gs://${GCLOUD_PROJECT}-backend`
  if (argument === 'setup') {
    // Creates the default backend bucket for this project, if non existant
    execSafe('gsutil', ['mb', '-p', GCLOUD_PROJECT, bucket])
  }
  else if (argument === 'download') {
    if (!shell.test('-d', 'storage')) shell.mkdir('storage')
    console.log('Fetching all static files from Google Cloud...')
    // Recursively downloads all static files.
    exec('gsutil', ['-m', 'rsync', '-r', bucket, 'storage'])
  }
  else if (argument === 'static') {
    if (shell.test('-d', 'storage')) {
      console.log('Syncing all static files...')
      // Recursively uploads all static files to the bucket.
      exec('gsutil', ['-m', 'rsync', '-r', 'storage', bucket])
    } else console.log('\'./storage\' not found, skipping static files sync.')
  }
  else {
    const storage = `storage/${argument}`
    verifyDependency(shell.test('-e', `${argument}.yaml`), `Sorry, I couldn't find "${argument}.yaml"`)
    if(shell.test('-d', storage)) {
      console.log('Syncing static files...')
      // Recursively uploads static files from the desired branch to the bucket.
      exec('gsutil', ['-m', 'rsync', '-r', storage, `${bucket}/${argument}`])
    } else console.log(`${storage} not found, skipping static files sync.`)

    console.log(`Deploying ${argument} to GAE...`)
    // Deploys app to Google App Engine based on the desired branch YAML file.
    exec('gcloud', ['app', 'deploy', `${argument}.yaml`, `--project=${GCLOUD_PROJECT}`, '-q'])
  }
}
else console.log(usage)
