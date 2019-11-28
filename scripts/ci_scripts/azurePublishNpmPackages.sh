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

readonly NODE_MODULES="fabric-protos fabric-common fabric-ca-client fabric-client fabric-network"

publishAllPackages() {
    local module moduleDir
    for module in ${NODE_MODULES}; do
        moduleDir="${PROJECT_DIR}/${module}"
        if [ -d "${moduleDir}" ]; then
            echo -e "\033[32m Publishing ${module} \033[0m"
            (cd "${moduleDir}" && publishPackage "${module}")
        fi
    done
}

publishPackage() {
    readPackageVersion

    if [[ ${CURRENT_TAG} = *"skip"* ]]; then
        echo -e "\033[34m----> Don't publish $1 npm modules on skip tag \033[0m"
        return
    fi

    configureNpm

    if [[ ${CURRENT_TAG} = *"unstable"* ]]; then
        publishUnstablePackage "$1"
    else
        publishReleasePackage "$1"
    fi
}

readPackageVersion() {
    # Get the unstable tag from package.json
    CURRENT_TAG=$(grep '"tag":' package.json | cut -d\" -f4)
    echo -e "\033[32m ======> Current TAG: ${CURRENT_TAG} \033[0m"
    # Get the version from package.json
    RELEASE_VERSION=$(grep '"version":' package.json | cut -d\" -f4)
    echo -e "\033[32m ======> Current Version: ${RELEASE_VERSION} \033[0m"
}

configureNpm() {
    echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > '.npmrc'
}

publishUnstablePackage() {
    local module
    # Get the current unstable version of a module from npm registry
    UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/${CURRENT_TAG}:"/'{
        ver=$NF
        rel=$NF
        sub(/.*\./,"",rel)
        sub(/\.[[:digit:]]+$/,"",ver)
        print ver"."rel+1
    }')
    if [[ -z ${UNSTABLE_VER} ]]; then
        echo -e "\033[34m  ----> unstable ver is blank \033[0m"
        UNSTABLE_INCREMENT=1
    else
        # Get last digit of the unstable version built above
        UNSTABLE_INCREMENT=$(echo "${UNSTABLE_VER}" | rev | cut -d '.' -f 1 | rev)
    fi
    echo -e "\033[32m======> UNSTABLE_INCREMENT: ${UNSTABLE_INCREMENT} \033[0m"
    # Append last digit with the package.json version
    export UNSTABLE_INCREMENT_VERSION="${RELEASE_VERSION}.${UNSTABLE_INCREMENT}"
    echo -e "\033[32m======> UNSTABLE_INCREMENT_VERSION: ${UNSTABLE_INCREMENT_VERSION} \033[0m"
    for module in ${NODE_MODULES}; do
        sed -i "s/\"${module}\": \".*\"/\"${module}\": \"${CURRENT_TAG}\"/" package.json
    done

    # Replace existing version with $UNSTABLE_INCREMENT_VERSION
    sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'"${UNSTABLE_INCREMENT_VERSION}"\"\,'/' package.json
    # Show Version after modify the package.json with latest version to publish
    grep '"version":' package.json | cut -d\" -f4
    # Publish unstable versions to npm registry
    npmPublish "$1"
}

publishReleasePackage() {
    local module
    echo -e "\033[32m ========> PUBLISH $RELEASE_VERSION \033[0m"
    for module in ${NODE_MODULES}; do
        sed -i "s/\"${module}\": \".*\"/\"${module}\": \"${CURRENT_TAG}\"/" package.json
    done

    npmPublish "$1"
}

npmPublish() {
    npm publish --tag "${CURRENT_TAG}" || {
        echo -e "\033[31m FAILED to publish ${CURRENT_TAG} of $1 npm module \033[0m"
        exit 1
    }
    echo -e "\033[32m ========> PUBLISHED ${CURRENT_TAG} tag of $1 npm module SUCCESSFULLY \033[0m"
}

publishAllPackages
