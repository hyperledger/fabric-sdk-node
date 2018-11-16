#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

export CONTAINER_LIST=(orderer peer0.org1 peer0.org2)
export NEXUS_URL=nexus3.hyperledger.org:10001
export ORG_NAME="hyperledger/fabric"

# error check
err_Check() {

  echo -e "\033[31m $1" "\033[0m"
  docker images | grep hyperledger && docker ps -a

  # Write orderer, peer logs
  for CONTAINER in ${CONTAINER_LIST[*]}; do
     docker logs $CONTAINER.example.com >& $CONTAINER.log
  done

  # Write ca logs into ca_peerOrg1.log
  docker logs ca_peerOrg1 >& ca_peerOrg1.log
  # Write ca logs into ca_peerOrg2.log
  docker logs ca_peerOrg2 >& ca_peerOrg2.log
  # Write couchdb container logs into couchdb.log file
  docker logs couchdb >& couchdb.log

  # Copy debug log
  cp /tmp/hfc/test-log/*.log $WORKSPACE || true
  clean_Environment
  exit 1
}

Parse_Arguments() {
      while [ $# -gt 0 ]; do
              case $1 in
                      --env_Info)
                            env_Info
                            ;;
                      --pull_Docker_Images)
                            pull_Docker_Images
                            ;;
                      --clean_Environment)
                            clean_Environment
                            ;;
                      --sdk_E2e_Tests)
                            sdk_E2e_Tests
                            ;;
                      --publish_NpmModules)
                            publish_NpmModules
                            ;;
                      --publish_ApiDocs)
                            publish_ApiDocs
                            ;;
              esac
              shift
      done
}

clean_Environment() {

echo "-----------> Clean Docker Containers & Images, unused/lefover build artifacts"
function clearContainers () {
        CONTAINER_IDS=$(docker ps -aq)
        if [ -z "$CONTAINER_IDS" ] || [ "$CONTAINER_IDS" = " " ]; then
                echo "---- No containers available for deletion ----"
        else
                docker rm -f $CONTAINER_IDS || true
        fi
}

function removeUnwantedImages() {
        DOCKER_IMAGES_SNAPSHOTS=$(docker images | grep snapshot | grep -v grep | awk '{print $1":" $2}')

        if [ -z "$DOCKER_IMAGES_SNAPSHOTS" ] || [ "$DOCKER_IMAGES_SNAPSHOTS" = " " ]; then
                echo "---- No snapshot images available for deletion ----"
        else
                docker rmi -f $DOCKER_IMAGES_SNAPSHOTS || true
        fi
        DOCKER_IMAGE_IDS=$(docker images | grep -v 'base*\|couchdb\|kafka\|zookeeper\|cello' | awk '{print $3}')

        if [ -z "$DOCKER_IMAGE_IDS" ] || [ "$DOCKER_IMAGE_IDS" = " " ]; then
                echo "---- No images available for deletion ----"
        else
                docker rmi -f $DOCKER_IMAGE_IDS || true
        fi
}

# Delete nvm prefix & then delete nvm
rm -rf $HOME/.nvm/ $HOME/.node-gyp/ $HOME/.npm/ $HOME/.npmrc  || true

mkdir $HOME/.nvm || true

# remove tmp/hfc and hfc-key-store data
rm -rf /home/jenkins/.nvm /home/jenkins/npm /tmp/fabric-shim /tmp/hfc* /tmp/npm* /home/jenkins/kvsTemp /home/jenkins/.hfc-key-store

rm -rf /var/hyperledger/*

rm -rf gopath/src/github.com/hyperledger/fabric-ca/vendor/github.com/cloudflare/cfssl/vendor/github.com/cloudflare/cfssl_trust/ca-bundle || true
# yamllint disable-line rule:line-length
rm -rf gopath/src/github.com/hyperledger/fabric-ca/vendor/github.com/cloudflare/cfssl/vendor/github.com/cloudflare/cfssl_trust/intermediate_ca || true

clearContainers
removeUnwantedImages
}

env_Info() {
        # This function prints system info

        #### Build Env INFO
        echo -e "\033[32m -----------> Build Env INFO" "\033[0m"
        # Output all information about the Jenkins environment
        uname -a
        cat /etc/*-release
        env
        gcc --version
        docker version
        docker info
        docker-compose version
        pgrep -a docker
        docker ps
        docker images
}

# pull fabric, fabric-ca images from nexus
pull_Docker_Images() {
            for IMAGES in peer orderer ca javaenv; do
                 if [ $IMAGES == "javaenv" ]; then
                       if [ $ARCH == "s390x" ]; then
                             # Do not pull javaenv if OS_VER == s390x
                             echo "\033[32m -----------> skipping pull of javaenv image on s390x" "\033[0m"
                       else
                             # Pull javaenv at same level as node SDK
                             echo "\033[32m -----------> pull $ORG_NAME-$IMAGES:${IMAGE_TAG} image" "\033[0m"
                             echo
                             docker pull $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} > /dev/null 2>&1
                             if [ $? -ne 0 ]; then
                                   echo -e "\033[31m FAILED to pull docker images" "\033[0m"
                                   exit 1
                             fi
                             docker tag $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} $ORG_NAME-$IMAGES
                             docker tag $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} $ORG_NAME-$IMAGES:${ARCH}-${VERSION}
                             docker rmi -f $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG}
                       fi
                 else
                       echo "-----------> pull $IMAGES image"
                       echo
                       docker pull $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} > /dev/null 2>&1
                             if [ $? -ne 0 ]; then
                                   echo -e "\033[31m FAILED to pull docker images" "\033[0m"
                                   exit 1
                             fi
                             docker tag $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} $ORG_NAME-$IMAGES
                             docker tag $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG} $ORG_NAME-$IMAGES:${ARCH}-${VERSION}
                             docker rmi -f $NEXUS_URL/$ORG_NAME-$IMAGES:${IMAGE_TAG}
                 fi
            done
                 echo
                 docker images | grep hyperledger/fabric
}
# Install NPM
install_Npm() {

echo "-------> ARCH:" $ARCH
if [[ $ARCH == "s390x" || $ARCH == "ppc64le" ]]; then
       # Install nvm to install multi node versions
        wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
        # shellcheck source=/dev/null
        export NVM_DIR="$HOME/.nvm"
        # shellcheck source=/dev/null
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
        echo "------> Install NodeJS"
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

        npm install || err_Check "ERROR!!! npm install failed"
        npm install -g gulp && npm install -g istanbul
fi
}

# run sdk e2e tests
sdk_E2e_Tests() {

        cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node

        # Install NPM before start the tests
        install_Npm

        gulp || err_Check "ERROR!!! gulp failed"
        gulp ca || err_Check "ERROR!!! gulp ca failed"

        echo -e "\033[32m Execute Headless and Integration Tests" "\033[0m"
        gulp test || err_Check "ERROR!!! gulp test failed"
}

# Publish npm modules after successful merge on amd64
publish_NpmModules() {
        echo
        echo -e "\033[32m -----------> Publish npm modules from amd64" "\033[0m"
        ./Publish_NPM_Modules.sh
}

# Publish NODE_SDK API docs after successful merge on amd64
publish_ApiDocs() {
        echo
        echo -e "\033[32m -----------> Publish NODE_SDK API docs after successful merge on amd64" "\033[0m"
        ./Publish_API_Docs.sh
}
Parse_Arguments $@
