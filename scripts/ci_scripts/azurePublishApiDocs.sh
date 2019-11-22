#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

# Input environment variables:
: "${GITHUB_USER:?}" # The GitHub user name for publishing
: "${GITHUB_EMAIL:?}" # Email address of the GitHub user
: "${PUBLISH_URL:?}" # Git URL used to push published content
: "${PROJECT_DIR:?}" # Root directory for the Git project
: "${STAGING_DIR:?}" # Directory used to store content to publish to GitHub Pages

readonly COMMIT_HASH=$(git rev-parse HEAD)
readonly BUILD_DIR="${PROJECT_DIR}/docs/gen"
readonly DOCS_BRANCH='gh-pages'

prepareStaging() {
    echo "Preparing staging directory: ${STAGING_DIR}"
    rm -rf "${STAGING_DIR}"
	rsync -r --exclude-from=${PROJECT_DIR}/.gitignore "${PROJECT_DIR}/" "${STAGING_DIR}"
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
    echo 'Building documentation'
    rm -rf "${BUILD_DIR}"
    npx gulp docs
}

copyToStaging() {
    echo "Copying built documentation from ${BUILD_DIR} to ${STAGING_DIR}"
    cleanStaging
    cp -r "${BUILD_DIR}"/* "${STAGING_DIR}"
}

cleanStaging() {
    local releaseDir targetDir
    # Remove release sub-directories that have been re-built
    find "${BUILD_DIR}" -type d -maxdepth 1 -depth 1 -print | while read -r subdir; do
        releaseDir=$(basename "${subdir}")
        targetDir="${STAGING_DIR}/${releaseDir}"
        echo "Removing ${targetDir}"
        rm -rf "${targetDir}"
    done
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
copyToStaging
publishDocs
