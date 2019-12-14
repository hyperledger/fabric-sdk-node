#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

set -e -o pipefail

# Input environment variables:
: "${GITHUB_USER:?}" # The GitHub user name for publishing
: "${GITHUB_EMAIL:?}" # Email address of the GitHub user
: "${PUBLISH_URL:?}" # Git URL used to push published content
: "${PROJECT_DIR:?}" # Root directory for the Git project
: "${STAGING_DIR:?}" # Directory used to store content to publish to GitHub Pages
: "${SOURCE_BRANCH:?}" # Source code branch name

readonly COMMIT_HASH=$(git rev-parse HEAD)
readonly BUILD_DIR="${PROJECT_DIR}/docs/gen"
readonly TEMPLATE_DIR="${PROJECT_DIR}/docs/redirectTemplates"
readonly DOCS_BRANCH='gh-pages'
readonly STAGING_RELEASE_DIR="${STAGING_DIR}/${SOURCE_BRANCH}"

prepareStaging() {
    echo "Preparing staging directory: ${STAGING_DIR}"
    rm -rf "${STAGING_DIR}"
	rsync -r --exclude-from="${PROJECT_DIR}/.gitignore" "${PROJECT_DIR}/" "${STAGING_DIR}"
    (cd "${STAGING_DIR}" && _stagingGitSetUp)
}

_stagingGitSetUp() {
    git config --local user.name "${GITHUB_USER}"
    git config --local user.email "${GITHUB_EMAIL}"
    git reset --hard
    git clean -xdf
    git fetch origin
    git checkout -B "${DOCS_BRANCH}" "origin/${DOCS_BRANCH}"
    git clean -xdf
}

buildDocs() {
    echo "Building documentation for ${SOURCE_BRANCH} branch in ${BUILD_DIR}"
    rm -rf "${BUILD_DIR}"
	npm run docs
}

cleanStaging() {
    echo "Removing ${STAGING_RELEASE_DIR}"
    rm -rf "${STAGING_RELEASE_DIR}"

    if [[ ${SOURCE_BRANCH} = master ]]; then
        removeStagingRootFiles
    fi
}

removeStagingRootFiles() {
    find "${STAGING_DIR}" -type f -maxdepth 1 -mindepth 1 \
        -exec echo Removing {} \; \
        -exec rm -f {} \;
}

copyToStaging() {
    echo "Copying built documentation from ${BUILD_DIR} to ${STAGING_RELEASE_DIR}"
    rsync -r "${BUILD_DIR}/" "${STAGING_RELEASE_DIR}"

    if [[ ${SOURCE_BRANCH} = master ]]; then
        echo "Copying template files from ${TEMPLATE_DIR} to ${STAGING_DIR}"
        rsync -r "${TEMPLATE_DIR}/" "${STAGING_DIR}"
    fi
}

publishDocs() {
    echo 'Publishing documentation from staging'
    (cd "${STAGING_DIR}" && _stagingPushDocs)
}

_stagingPushDocs() {
    git add .
    git commit -m "Commit ${COMMIT_HASH}"
    git push "${PUBLISH_URL}" "${DOCS_BRANCH}"
}

prepareStaging
buildDocs
cleanStaging
copyToStaging
publishDocs
