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

      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk '/$CURRENT_TAG/{
      ver=$NF
      rel=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver"."rel+1}')
      echo "===> Incremented UNSTABLE VERSION --> $UNSTABLE_INCREMENT"
  
      # Get last digit of the unstable version of $CURRENT_TAG
      UNSTABLE_INCREMENT=$(echo $UNSTABLE_INCREMENT| rev | cut -d '.' -f 1 | rev)
      echo "--------> UNSTABLE_INCREMENT : $UNSTABLE_INCREMENT"

      # Append last digit with the package.json version
      export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
      echo "--------> UNSTABLE_INCREMENT_VERSION" $UNSTABLE_INCREMENT_VERSION


      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
      sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
      npm publish --tag $CURRENT_TAG

  else
          echo "----> Publish $RELEASE from fabric-sdk-node-npm-release-x86_64 job"
  fi
}

##########################
#
# Fetch release version
#
##########################
versions() {

  # Get the unstable tag from package.json
  CURRENT_TAG=$(cat package.json | grep tag | awk -F\" '{ print $4 }')
  echo "===> Current TAG --> $CURRENT_TAG"

  # Get the version from package.json
  RELEASE_VERSION=$(cat package.json | grep version | awk -F\" '{ print $4 }')
  echo "===> Current Version --> $RELEASE_VERSION"
}

# Publish unstable npm modules from amd64 ARCH
cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
echo "npm version ------> $(npm -v)"
echo "node version ------> $(node -v)"

ARCH=$(uname -m)
echo "-------> ARCH" $ARCH

if [[ "$ARCH" = "s390x" ]] || [[ "$ARCH" = "ppc64le" ]]; then
   echo "--------> Publish npm modules only from x86_64 (x) platform, not from $ARCH (z and p) now. <----"
else
   echo "----------> Publish npm node modules from $ARCH <--------"
   cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
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

   # Publish fabric-common node module
   if [ -d "../fabric-common" ]; then
      cd ../fabric-common
      versions
      npmPublish fabric-common
   fi
fi
