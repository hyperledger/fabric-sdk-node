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

  # Write orderer, peer logs
  for CONTAINER in ${CONTAINER_LIST[*]}; do
     docker logs $CONTAINER.example.com >& $CONTAINER.log
  done

  # Write couchdb container logs into couchdb.log file
  docker logs couchdb >& couchdb.log

  # Copy debug log
  cp /tmp/hfc/test-log/*.log $WORKSPACE
  exit 1
}

Parse_Arguments() {
  while [ $# -gt 0 ]; do
    case $1 in
      --sdk_Headless)
          sdk_Headless
          ;;
      --sdk_Integration)
          sdk_Integration
          ;;
      --sdk_Cucumber)
          sdk_Cucumber
          ;;
      --sdk_Logger)
          sdk_Logger
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
sdk_Headless() {

  cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node

  # Install npm before start the tests
  # install_Npm

  # gulp || err_Check "ERROR!!! gulp failed"
  # gulp ca || err_Check "ERROR!!! gulp ca failed"

  echo -e "\033[32m npm version ------> $(npm -v)" "\033[0m"
  echo -e "\033[32m node version ------> $(node -v)" "\033[0m"

  echo " ######################## "
  echo -e "\033[1m R U N  g u l p T E S T S \033[0m"
  echo " ######################## "

  set -x
  gulp test-headless || err_Check "ERROR!!! gulp test-headless failed"
  set +x
}
sdk_Integration() {
  cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node
  echo " ############################# "
  echo -e "\033[1m R U N  test-integration T E S T S \033[0m"
  echo " ############################# "

  set -x
  gulp test-integration || err_Check "ERROR!!! gulp test-integration failed"
  set +x
}
sdk_Cucumber() {
  cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node
  echo " ############################# "
  echo -e "\033[1m R U N  run-test-cucumber T E S T S \033[0m"
  echo " ############################# "

  echo -e "\033[32m Execute Just the Cucumber Tests" "\033[0m"
  set -x
  gulp run-test-cucumber || err_Check "ERROR!!! gulp run-test-cucumber failed"
  set +x
}

sdk_Logger() {
  cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node
  echo " ############################# "
  echo -e "\033[1m  R U N  run-test-logger T E S T S \033[0m"
  echo " ############################# "

  echo -e "\033[32m Execute Just the logger Tests" "\033[0m"
  set -x
  gulp run-test-logger || err_Check "ERROR!!! gulp run-test-logger failed"
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
