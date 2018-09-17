#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

npmPublish() {
  if [ $RELEASE = "snapshot" ]; then
      echo
      UNSTABLE_VER=$(npm dist-tags ls "$1" | awk '/unstable/{
      ver=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver}')

      echo "===> UNSTABLE VERSION --> $UNSTABLE_VER"

      UNSTABLE_INCREMENT=$(npm dist-tags ls "$1" | awk '/unstable/{
      ver=$NF
      rel=$NF
      sub(/.*\./,"",rel)
      sub(/\.[[:digit:]]+$/,"",ver)
      print ver"."rel+1}')

      echo "===> Incremented UNSTABLE VERSION --> $UNSTABLE_INCREMENT"

      #if [ "$1" = "fabric-network" ]; then
      #    sed -i 's/\(.*\"fabric-client\"\: \"\)\(.*\)/\1'$CLIENT_VER\"\,'/' package.json
      #    sed -i 's/\(.*\"fabric-ca-client\"\: \"\)\(.*\)/\1'$CA_CLIENT_VER\"\,'/' package.json
      #fi

      if [ "$UNSTABLE_VER" = "$CURRENT_RELEASE" ]; then
          # Replace existing version with Incremented $UNSTABLE_VERSION
          sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT\"\,'/' package.json
          npm publish --tag unstable
	      PUBLISHED_VER=$UNSTABLE_INCREMENT
      else
          # Replace existing version with $CURRENT_RELEASE
          sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$CURRENT_RELEASE\"\,'/' package.json
          npm publish --tag unstable
	      PUBLISHED_VER=$CURRENT_RELEASE
      fi
  else
      if [[ "$RELEASE" =~ alpha*|preview*|beta*|rc*|^[0-9].[0-9].[0-9]$ ]]; then
          echo "----> Publish $RELEASE from fabric-sdk-node-npm-release-x86_64 job"
      fi
  fi
}

##########################
#
# Fetch release version
#
##########################

versions() {

  CURRENT_RELEASE=$(cat package.json | grep version | awk -F\" '{ print $4 }')
  echo "===> Current Version --> $CURRENT_RELEASE"
  RELEASE=$(cat package.json | grep version | awk -F\" '{ print $4 }' | cut -d "-" -f 2)
  echo "===> Current Release --> $RELEASE"
}

# Publish unstable npm modules from amd64 ARCH
cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-sdk-node
echo "npm version ------> $(npm -v)"
echo "node version ------> $(node -v)"

npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# publish fabric-ca-client node module
cd fabric-ca-client
versions
npmPublish fabric-ca-client
CA_CLIENT_VER=$PUBLISHED_VER

# publish fabric-client node module
cd ../fabric-client
versions
npmPublish fabric-client
CLIENT_VER=$PUBLISHED_VER

# publish fabric-network node module
if [ -d "../fabric-network" ]; then
  cd ../fabric-network
  versions
  npmPublish fabric-network
fi
