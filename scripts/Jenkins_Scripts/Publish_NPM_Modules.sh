#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

npmPublish() {

if [[ "$CURRENT_TAG" = *"skip"* ]]; then
      echo "----> Don't publish npm modules on skip tag"
elif [[ "$CURRENT_TAG" = *"unstable"* ]]; then
## Get the version from npmjs of the  module
      echo
      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver}')

      echo "===> UNSTABLE VERSION --> $UNSTABLE_VER"
## Increment unstable version here
      UNSTABLE_INCREMENT=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
      ver=$NF
      rel=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver"."rel+1}')

      echo "===> Incremented UNSTABLE VERSION --> $UNSTABLE_INCREMENT

      # Get last digit of the unstable version of $CURRENT_TAG
      UNSTABLE_INCREMENT=$(echo $UNSTABLE_INCREMENT| rev | cut -d '.' -f 1 | rev)
      echo "--------> UNSTABLE_INCREMENT : $UNSTABLE_INCREMENT""

      # Append last digit with the package.json version
      export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
      echo "--------> UNSTABLE_INCREMENT_VERSION" $UNSTABLE_INCREMENT_VERSION

      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
      sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
      npm publish --tag $CURRENT_TAG

  else
      # Publish node modules on latest tag
      echo -e "\033[32m ========> PUBLISH --> $RELEASE_VERSION" "\033[0m"
      npm publish --tag $CURRENT_TAG
  fi
}

##########################
#
# Fetch release version
#
##########################

versions() {

  # Get the value of the tag from package.json
  CURRENT_TAG=$(cat package.json | grep tag | awk -F\" '{ print $4 }')
  echo -e "\033[32m ===> Current TAG --> $CURRENT_TAG" "\033[0m"

  # Get the version from package.json
  RELEASE_VERSION=$(cat package.json | grep version | awk -F\" '{ print $4 }')
  echo -e "\033[32m ===> Current Version --> $RELEASE_VERSION" "\033[0m"

}

echo "-------> Publish npm node modules<----------"

cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
# Set NPM_TOKEN from CI configuration
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Publish fabric-ca-client node module
cd fabric-ca-client
versions
npmPublish fabric-ca-client

# Publish fabric-client node module
cd ../fabric-client
versions
npmPublish fabric-client

# Publish fabric-network node module
if [ -d "../fabric-network" ]; then
     cd ../fabric-network
     versions
     npmPublish fabric-network
fi
