#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

export CONTAINER_LIST=(orderer peer0.org1 peer0.org2 ca0 ca1)

# error check
err_Check() {

  echo -e "\033[31m $1" "\033[0m"
  docker images | grep hyperledger && docker ps -a

  # Write orderer, peer & ca logs
  for CONTAINER in ${CONTAINER_LIST[*]}; do
     docker logs $CONTAINER.example.com >& $CONTAINER.log
  done

  # Write couchdb container logs into couchdb.log file
  docker logs couchdb >& couchdb.log

  # Copy debug log
  cp ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node/test/temp/*.log $WORKSPACE
  exit 1
}

Parse_Arguments() {
  while [ $# -gt 0 ]; do
    case $1 in
      --sdk_e2e_Tests)
          sdk_e2e_Tests
          ;;
      --publish_NpmModules)
          publish_NpmModules
          ;;
      --publish_ApiDocs)
          publish_ApiDocs
          ;;
      *)
          echo "Wrong function called"
          exit 1
          ;;
    esac
    shift
  done
}

# Install npm
install_Npm() {
  echo "-------> MARCH:" $MARCH
  if [[ $MARCH == "s390x" || $MARCH == "ppc64le" ]]; then
    set -x
    # Source nvmrc.sh
    source /etc/profile.d/nvmrc.sh
    # Delete any existing prefix
    npm config delete prefix
    # Install NODE_VER
    echo "------> Use $NODE_VER"
    nvm install $NODE_VER || true
    nvm use --delete-prefix v$NODE_VER --silent
    npm install || err_Check "ERROR!!! npm install failed"
    npm config set prefix ~/npm && npm install -g gulp && npm install -g istanbul

    echo -e "\033[32m npm version ------> $(npm -v)" "\033[0m"
    echo -e "\033[32m node version ------> $(node -v)" "\033[0m"
    set +x
  else
    echo -e "\033[32m npm version ------> $(npm -v)" "\033[0m"
    echo -e "\033[32m node version ------> $(node -v)" "\033[0m"
    set -x
    npm install || err_Check "ERROR!!! npm install failed"
    npm install -g gulp && npm install -g istanbul
    set +x
  fi
}

# run sdk e2e tests
sdk_e2e_Tests() {

  cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node

  # Install npm before start the tests
  install_Npm

  # Generate crypto material before running the tests
  if [ $ARCH == "s390x" ]; then
    set -x
    # Run the s390x gulp task
    gulp install-and-generate-certs-s390 || err_Check "ERROR!!! gulp install and generation of test certificates failed"
    set +x
  else
    set -x
    # Run the amd64 gulp task
    gulp install-and-generate-certs || err_Check "ERROR!!! gulp install and generation of test certificates failed"
    set +x
  fi

  echo " ########################"
  echo -e "\033[1m RUN gulp TESTS \033[0m"
  echo " ####################### "

  echo -e "\033[32m Execute Headless and Integration Tests" "\033[0m"
  set -x
  gulp test || err_Check "ERROR!!! gulp test failed"
  set +x
}

# Publish npm modules after successful merge on amd64
publish_NpmModules() {
  echo
  echo -e "\033[32m -----------> Publish npm modules from amd64" "\033[0m"
  ./publishNpmModules.sh
}

# Publish NODE_SDK API docs after successful merge on amd64
publish_ApiDocs() {
  echo
  echo -e "\033[32m -----------> Publish NODE_SDK API docs after successful merge on amd64" "\033[0m"
  ./publishApiDocs.sh
}
Parse_Arguments $@
