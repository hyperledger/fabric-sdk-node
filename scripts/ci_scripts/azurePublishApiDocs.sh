#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

clonePublishRepository() {
    rm -rf "${PUBLISH_DIR}"
    git clone "${REPOSITORY_URL}"
}

buildDocs() {
    rm -rf "${BUILD_DIR}"
    npx gulp docs
    cleanPublishDirectory
    cp -r "${BUILD_DIR}"/* "${PUBLISH_DIR}"
}

cleanPublishDirectory() {
    # Root files should only be removed from the top-level publish directory if building the master branch
    # removePublishRootFiles
    removePublishDirectories
}

removePublishRootFiles() {
    find "${PUBLISH_DIR}" -type f -maxdepth 1 -depth 1 -print | while read -r file; do
        echo "Removing ${file}"
        rm -f "${file}"
    done
}

removePublishDirectories() {
    find "${BUILD_DIR}" -type d -maxdepth 1 -depth 1 -print | while read -r subdir; do
        sourceDir=$(basename "${subdir}")
        targetDir="${PUBLISH_DIR}/${sourceDir}"
        echo "Removing ${targetDir}"
        rm -rf "${targetDir}"
    done
}

publishDocs() {
    git config --local user.name "${GITHUB_USER}"
    git config --local user.email "${GITHUB_EMAIL}"

    git add .
    git commit -m "Commit ${COMMIT_HASH}"
    git remote add publish "${PUBLISH_URL}"
    git push publish master
}

# Must be run from the repository root directory.

# Input environment variables:
: "${GITHUB_USER:?}" # The GitHub user name for publishing
: "${GITHUB_EMAIL:?}" # Email address of the GitHub user
: "${GITHUB_PASSWORD:?}" # Password or token for GitHub user
: "${PUBLISH_REPOSITORY:?}" # Qualified GitHub publish repository name (i.e. "organization/repository")

COMMIT_HASH=$(git rev-parse HEAD)
REPOSITORY_URL="https://github.com/${PUBLISH_REPOSITORY}.git"
PUBLISH_URL="https://${GITHUB_USER}:${GITHUB_PASSWORD}@github.com/${PUBLISH_REPOSITORY}.git"
BUILD_DIR="docs/gen"
PUBLISH_DIR=$(basename "${PUBLISH_REPOSITORY}")

clonePublishRepository
buildDocs
(cd "${PUBLISH_DIR}" && publishDocs)
