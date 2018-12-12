#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

npmPublish() {

 if [[ "$CURRENT_TAG" = *"skip"* ]]; then
     echo "----> Don't publish $1 npm modules on skip tag"
 elif [[ "$CURRENT_TAG" = *"unstable"* ]]; then
      echo
      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver}')
      echo "======> UNSTABLE VERSION:" $UNSTABLE_VER

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

      if [ "$1" = "fabric-network" ]; then
          sed -i 's/\(.*\"fabric-client\"\: \"\)\(.*\)/\1'$CURRENT_TAG\"\,'/' package.json
          sed -i 's/\(.*\"fabric-ca-client\"\: \"\)\(.*\)/\1'$CURRENT_TAG\"\,'/' package.json
      fi

      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
      sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
      # Show Version after modify the package.json with latest version to publish
      grep '"version":' package.json | cut -d\" -f4
      # Publish unstable versions to npm registry
      npm publish --tag $CURRENT_TAG
      if [ $? != 0 ]; then
           echo -e "\033[31m FAILED to Publish $CURRENT_TAG of $1 npm module" "\033[0m"
           exit 1
      fi
      echo -e "\033[32m ========> PUBLISHED $CURRENT_TAG tag of $1 npm module SUCCESSFULLY" "\033[0m"

 else
      # Publish node modules on latest tag
      echo -e "\033[32m ========> PUBLISH $RELEASE_VERSION" "\033[0m"

      if [ "$1" = "fabric-network" ]; then
          sed -i 's/\(.*\"fabric-client\"\: \"\)\(.*\)/\1'$CURRENT_TAG\"\,'/' package.json
          sed -i 's/\(.*\"fabric-ca-client\"\: \"\)\(.*\)/\1'$CURRENT_TAG\"\,'/' package.json
      fi

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

############
# START HERE
############

echo "----------> START PUBLISHING FROM HERE"
cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
# Set NPM_TOKEN from CI configuration
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Add or delete modules from here..
for modules in fabric-network fabric-common fabric-ca-client fabric-client; do
     if [ -d "$modules" ]; then
           echo -e "\033[32m Publishing $modules" "\033[0m"
           cd $modules
           versions
          npmPublish $modules
          cd -
     fi
done
