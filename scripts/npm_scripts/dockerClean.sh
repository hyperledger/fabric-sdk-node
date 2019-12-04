#
# SPDX-License-Identifier: Apache-2.0
#

set -v # so we can see the docker command output

dockerClean() {
    #stop and remove docker containers
    docker kill $(docker ps -aq)
    docker rm $(docker ps -aq) -f
    #remove chaincode images so that they get rebuilt during test
    docker rmi $(docker images | grep "^dev-" | awk '{print $3}')
}

dockerClean || true # kill, rm, and rmi may fail because the containers may have been cleaned up or do not exist
