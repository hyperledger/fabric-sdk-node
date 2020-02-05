#
# SPDX-License-Identifier: Apache-2.0
#

set -v # so we can see the docker command output

dockerClean() {
    # stop and remove chaincode docker instances
    docker kill $(docker ps | grep "dev-" | awk '{print $1}')
    docker rm $(docker ps -a | grep "dev-" | awk '{print $1}')
    #remove chaincode images so that they get rebuilt during test
    docker rmi $(docker images | grep "^dev-" | awk '{print $3}')

    # clean up all the containers created by docker-compose
    docker-compose -f test/fixtures/docker-compose/docker-compose-tls-level-db.yaml -p node down
    docker-compose -f test/fixtures/docker-compose/docker-compose-tls.yaml -p node down
    docker ps -a
}

dockerClean || true # kill, rm, and rmi may fail because the containers may have been cleaned up or do not exist