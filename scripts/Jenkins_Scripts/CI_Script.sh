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
                      --clean_Environment)
                            clean_Environment
                            ;;
                      --sdk_E2e_Tests)
                            sdk_E2e_Tests
                            ;;
                      --publish_NpmModules)
                            --publish_NpmModules
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
	echo "-----------> Build Env INFO"
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

# run sdk e2e tests
sdk_E2e_Tests() {
	echo
	echo "-----------> Execute NODE SDK E2E Tests"
        cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-sdk-node || exit
        # Install nvm to install multi node versions
        wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
        # shellcheck source=/dev/null
        export NVM_DIR="$HOME/.nvm"
        # shellcheck source=/dev/null
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

        echo "------> Install NodeJS"
        # This also depends on the fabric-baseimage. Make sure you modify there as well.
        nvm install $NODE_VER || true
        nvm use --delete-prefix v$NODE_VER --silent

        echo "npm version ------> $(npm -v)"
        echo "node version ------> $(node -v)"

        npm install || err_Check "ERROR!!! npm install failed"
        npm config set prefix ~/npm && npm install -g gulp && npm install -g istanbul
        ~/npm/bin/gulp || err_Check "ERROR!!! gulp failed"
        ~/npm/bin/gulp 	ca || err_Check "ERROR!!! gulp ca failed"
        rm -rf node_modules/fabric-ca-client && npm install || err_Check "ERROR!!! npm install failed"

        echo "------> Run node headless & e2e tests"
        echo "============"
        ~/npm/bin/gulp test || err_Check "ERROR!!! gulp test failed"
        echo "============"
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
