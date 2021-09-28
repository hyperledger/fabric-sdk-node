#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#

set -o pipefail
set -ev

####
# Note: the tape integration suite is being deprecated in favour of cucumber. Please do not add files to this function
####

runTape() {
    export HFC_LOGGING='{"debug":"test/temp/debug.log"}'

    # Run HSM tests by default
    E2E_SCRIPT_SUFFIX=-hsm
    # If the script has been called with noHSM parameter
    # run test/integration/network-e2e/e2e.js instead of test/integration/network-e2e/e2e-hsm.js
    if [ $1 ] && [ $1 == 'noHSM' ]
    then
        unset E2E_SCRIPT_SUFFIX
    fi

    # Tests have to be executed in the following order

	# first run the ca-tests that tests all the member registration and enrollment scenarios (good and bad calls).
    # Then the rest of the tests will re-use the same key value store that has saved the user certificates so they can interact with the network
    npx tape test/unit/config.js \
    test/integration/fabric-ca-affiliation-service-tests.js \
    test/integration/fabric-ca-identity-service-tests.js \
    test/integration/fabric-ca-certificate-service-tests.js \
    test/integration/fabric-ca-services-tests.js \
    test/integration/nodechaincode/e2e.js \
    test/integration/e2e.js \
    test/integration/network-e2e/e2e${E2E_SCRIPT_SUFFIX}.js \
    test/integration/signTransactionOffline.js \
    test/integration/query.js \
    test/integration/client.js \
    test/integration/orderer-channel-tests.js \
    test/integration/couchdb-fabricca-tests.js \
    test/integration/fileKeyValueStore-fabricca-tests.js \
    test/integration/install.js \
    test/integration/channel-event-hub.js \
    test/integration/upgrade.js \
    test/integration/get-config.js \
    test/integration/create-configtx-channel.js \
    test/integration/e2e/join-channel-copy.js \
    test/integration/instantiate.js \
    test/integration/e2e/invoke-transaction-copy.js \
    test/integration/e2e/query-copy.js \
    test/integration/invoke.js \
    test/integration/network-config.js \
    test/integration/only-admin.js \
    test/integration/javachaincode/e2e.js \
    test/integration/discovery.js \
    test/integration/grpc.js \
    test/typescript/test.js \
    test/integration/perf/orderer.js \
    test/integration/perf/peer.js \
    | npx tap-colorize
}

runTape $*
