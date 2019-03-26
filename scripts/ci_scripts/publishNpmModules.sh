#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

nodeModules="fabric-protos fabric-common fabric-ca-client fabric-client fabric-network"

npmPublish() {
  if [[ "$CURRENT_TAG" = *"skip"* ]]; then
    echo -e "\033[34m----> Don't publish $1 npm modules on skip tag \033[0m"
    elif [[ "$CURRENT_TAG" = *"unstable"* ]]; then
      echo
      # Get the current unstable version of a module from npm registry
      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      rel=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver"."rel+1}')
      if [[ $UNSTABLE_VER = "" ]]; then
        echo -e "\033[34m  ----> unstable ver is blank \033[0m"
        UNSTABLE_INCREMENT=1
      else
        # Get last digit of the unstable version built above
        UNSTABLE_INCREMENT=$(echo $UNSTABLE_VER| rev | cut -d '.' -f 1 | rev)
      fi
      echo -e "\033[32m======> UNSTABLE_INCREMENT:" $UNSTABLE_INCREMENT "\033[0m"
      # Append last digit with the package.json version
      export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
      echo -e "\033[32m======> UNSTABLE_INCREMENT_VERSION:" $UNSTABLE_INCREMENT_VERSION "\033[0"
      for module in ${nodeModules}; do
          sed -i "s/\"${module}\": \".*\"/\"${module}\": \"${CURRENT_TAG}\"/" package.json
      done

      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
      sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
      # Show Version after modify the package.json with latest version to publish
      grep '"version":' package.json | cut -d\" -f4
      # Publish unstable versions to npm registry
      npm publish --tag $CURRENT_TAG
      if [ $? != 0 ]; then
        echo -e "\033[31m FAILED to publish $CURRENT_TAG of $1 npm module" "\033[0m"
        exit 1
      fi
      echo -e "\033[32m ========> PUBLISHED $CURRENT_TAG tag of $1 npm module SUCCESSFULLY" "\033[0m"

  else
    # Publish node modules on latest tag
    echo -e "\033[32m ========> PUBLISH $RELEASE_VERSION" "\033[0m"
    for module in ${nodeModules}; do
      sed -i "s/\"${module}\": \".*\"/\"${module}\": \"${CURRENT_TAG}\"/" package.json
    done

    npm publish --tag $CURRENT_TAG
    if [ $? != 0 ]; then
      echo -e "\033[31m FAILED TO PUBLISH $CURRENT_TAG of $1 npm module" "\033[0m"
      exit 1
    fi
    echo -e "\033[32m ========> PUBLISHED $CURRENT_TAG tag of $1 npm module SUCCESSFULLY" "\033[0m"
 fi
}

versions() {
  # Get the unstable tag from package.json
  CURRENT_TAG=$(grep '"tag":' package.json | cut -d\" -f4)
  echo -e "\033[32m ======> Current TAG: $CURRENT_TAG" "\033[0m"
  # Get the version from package.json
  RELEASE_VERSION=$(grep '"version":' package.json | cut -d\" -f4)
  echo -e "\033[32m ======> Current Version: $RELEASE_VERSION" "\033[0m"
}

echo " ____  _   _ ____  _     ___ ____  _   _   _   _ ____  __  __"
echo "|  _ \| | | | __ )| |   |_ _/ ___|| | | | | \ | |  _ \|  \/  |"
echo "| |_) | | | |  _ \| |    | |\___ \| |_| | |  \| | |_) | |\/| |"
echo "|  __/| |_| | |_) | |___ | | ___) |  _  | | |\  |  __/| |  | |"
echo "|_|    \___/|____/|_____|___|____/|_| |_| |_| \_|_|   |_|  |_|"

cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
# Set NPM_TOKEN from CI configuration
# Please post in #ci-pipeline channel if you observe npm_token issue
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Publish node modules
for module in ${nodeModules}; do
  if [ -d "$module" ]; then
    echo -e "\033[32m Publishing $module" "\033[0m"
    cd $module
    versions
    npmPublish $module
    cd -
  fi
done
