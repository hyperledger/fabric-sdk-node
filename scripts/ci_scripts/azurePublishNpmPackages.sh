#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

set -e -o pipefail

# Input environment variables:
: "${NPM_TOKEN:?}" # The npm publishing auth token
: "${PROJECT_DIR:?}" # The project root directory

readonly NODE_PACKAGES=(fabric-protos fabric-common fabric-ca-client fabric-network)

publishAllPackages() {
    loadPackageInfo
    forEachNodePackage preparePackage
    forEachNodePackage publishPackage
}

loadPackageInfo() {
    RELEASE_VERSION=$(readPackageProperty version)
    : "${RELEASE_VERSION:?}"
    echoLog "Release version: ${RELEASE_VERSION}"

    RELEASE_TAG=$(readPackageProperty tag)
    : "${RELEASE_TAG:?}"
    echoLog "Release tag: ${RELEASE_TAG:?}"

    if isStableRelease; then
        echoLog 'Stable release'
    else
        echoLog 'Unstable release'
    fi
}

readPackageProperty() {
    node -e "console.log(require('./package.json').$1 || '')"
}

echoLog() {
    echo -e "\033[32m======>" "$@" "\033[0m"
}

forEachNodePackage() {
    local packageName packageDir
    for packageName in "${NODE_PACKAGES[@]}"; do
        packageDir="${PROJECT_DIR}/${packageName}"
        (cd "${packageDir}" && "$@" "${packageName}")
    done
}

isStableRelease() {
    isStableVersion "${RELEASE_VERSION}"
}

isStableVersion() {
    [[ $1 = *-* ]] && return 1 || return 0
}

preparePackage() {
    local packageVersion

    if isSkipPackage; then
        packageVersion=$(readCurrentPackageVersion "$1")
        : "${packageVersion:?}"
        echoLog "Preparing skipped package $1 at version ${packageVersion}"
    elif isStableRelease; then
        packageVersion="${RELEASE_VERSION}"
        echoLog "Preparing stable package $1 at version ${packageVersion}"
    else
        packageVersion=$(readNextUnstablePackageVersion "$1")
        echoLog "Preparing unstable package $1 at version ${packageVersion}"
    fi

    updatePackageVersion "${packageVersion}"
    updateAllDependencyVersions "$1" "${packageVersion}"
}

isSkipPackage() {
    [[ $(readPackageProperty tag) = skip ]]
}

readCurrentPackageVersion() {
    npm dist-tags ls "$1" | awk "/^${RELEASE_TAG}:"/'{ print $NF }'
}

readNextUnstablePackageVersion() {
    local nextVersion
    nextVersion=$(npm view "$1" versions --json | awk -F . "/\"${RELEASE_VERSION}/"'{
        ver=$NF
        sub(/\".*/, "", ver)
        print ver+1
    }' | tail -1)
    echo "${RELEASE_VERSION}.${nextVersion:-1}"
}

updatePackageVersion() {
    npm --allow-same-version --no-git-tag-version version "$1"
}

updateAllDependencyVersions() {
    forEachNodePackage updateDependencyVersion "$1" "$2"
}

updateDependencyVersion() {
    local packageJson
    packageJson=$(node -e "const pkg = require('./package.json'); if (pkg.dependencies['$1']) pkg.dependencies['$1'] = '$2'; console.log(JSON.stringify(pkg, undefined, 2))")
    echo "${packageJson}" > package.json
}

publishPackage() {
    if [[ $(readPackageProperty tag) = skip ]]; then
        echoLog "Skipping publish for package $1"
        return
    fi

    if npmPublish; then
        echoLog "Successfully published ${RELEASE_TAG} tag of $1"
    else
        echoLog "FAILED to publish ${RELEASE_TAG} of $1"
        false
    fi
}

npmPublish() {
    echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > '.npmrc'
    npm publish --tag "${RELEASE_TAG}"
}

(cd "${PROJECT_DIR}" && publishAllPackages)
