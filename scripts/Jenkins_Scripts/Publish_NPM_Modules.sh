#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

npmPublish() {
  if [[ "$CURRENT_TAG" = *"unstable"* ]] || [[ "$CURRENT_TAG" = *"skip"* ]]; then
      echo
      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver}')

      echo "===> UNSTABLE VERSION --> $UNSTABLE_VER"

      UNSTABLE_INCREMENT=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      rel=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver"."rel+1}')

      echo "======> Incremented UNSTABLE VERSION:" $UNSTABLE_INCREMENT

      # Get last digit of the unstable version of $CURRENT_TAG
      UNSTABLE_INCREMENT=$(echo $UNSTABLE_INCREMENT| rev | cut -d '.' -f 1 | rev)
      echo "======> UNSTABLE_INCREMENT:" $UNSTABLE_INCREMENT

      # Append last digit with the package.json version
      export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
      echo "======> UNSTABLE_INCREMENT_VERSION:" $UNSTABLE_INCREMENT_VERSION

      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
      sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
      npm publish --tag $CURRENT_TAG

  else
      # Publish node modules on latest tag
      echo -e "\033[32m ========> PUBLISH $RELEASE_VERSION" "\033[0m"
      npm publish --tag $CURRENT_TAG
  fi
}

versions() {

  # Get the unstable tag from package.json
  CURRENT_TAG=$(grep '"tag":' package.json | cut -d\" -f4)
  echo -e "\033[32m ======> Current TAG: $CURRENT_TAG" "\033[0m

  # Get the version from package.json
  RELEASE_VERSION=$(grep '"version":' package.json | cut -d\" -f4)
  echo -e "\033[32m ======> Current Version $RELEASE_VERSION" "\033[0m"
}
############
# START HERE
############

echo "----------> START PUBLISHING FROM HERE"
cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
# Set NPM_TOKEN from CI configuration
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Publish fabric-ca-client node module
cd fabric-ca-client
versions
# Publish fabric-ca-client node module
npmPublish fabric-ca-client

# Publish fabric-client node module
cd ../fabric-client
versions
# Publish fabric-client node module
npmPublish fabric-client

# Publish fabric-network node module
if [ -d "../fabric-network" ]; then
  cd ../fabric-network
  versions
  # Publish fabric-network node module
  npmPublish fabric-network
fi

# Publish fabric-common node module
if [ -d "../fabric-common" ]; then
   cd ../fabric-common
    versions
    # Publish fabric-common node module
    npmPublish fabric-common
fi
