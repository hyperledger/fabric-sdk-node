#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

export CONTAINER_LIST=(orderer peer0.org1 peer0.org2)

# error check
err_Check() {

echo -e "\033[31m $1" "\033[0m"

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
docker images | grep hyperledger && docker ps -a
exit 1

}

Parse_Arguments() {
      while [ $# -gt 0 ]; do
              case $1 in
                      --env_Info)
                            env_Info
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
rm -rf $HOME/.node-gyp/ $HOME/.npm/ $HOME/.npmrc  || true

# remove tmp/hfc and hfc-key-store data
rm -rf /home/jenkins/npm /tmp/fabric-shim /tmp/hfc* /tmp/npm* /home/jenkins/kvsTemp /home/jenkins/.hfc-key-store

rm -rf /var/hyperledger/*

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
        docker images
        docker ps -a
}

# Install NPM
install_Npm() {

echo "-------> ARCH:" $ARCH
if [[ $ARCH == "s390x" || $ARCH == "ppc64le" ]]; then
        # Source nvmrc.sh
        source /etc/profile.d/nvmrc.sh
        echo "------> Install NodeJS"
        # Install NODE_VER
        echo "------> Use $NODE_VER"
        nvm install $NODE_VER
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

        echo "------> Run node headless & Integration tests"
        echo "============"
        gulp test || err_Check "ERROR!!! gulp test failed"
        echo "============"
}

# Publish npm modules after successful merge on amd64
publish_NpmModules() {
        echo
        echo "-----------> Publish npm modules from amd64"
        ./Publish_NPM_Modules.sh
}

# Publish NODE_SDK API docs after successful merge on amd64
publish_ApiDocs() {
        echo
        echo "-----------> Publish NODE_SDK API docs after successful merge on amd64"
        ./Publish_API_Docs.sh
}
Parse_Arguments $@
