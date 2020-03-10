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
    HSM_SCRIPT=test/integration/network-e2e/e2e-hsm.js
    # If the script has been called with noHSM parameter
    # exclude test/integration/network-e2e/e2e-hsm.js
    if [ $1 ] && [ $1 == 'noHSM' ]
    then
        unset HSM_SCRIPT
    fi

    # Tests have to be executed in the following order

    # First run the ca-tests that run good/bad path member registration/enrollment scenarios
    # The remaining tests re-use the same key value store with the saved user certificates, in order to interact with the network
    npx tape test/integration/fabric-ca-affiliation-service-tests.js \
    test/integration/fabric-ca-identity-service-tests.js \
    test/integration/fabric-ca-certificate-service-tests.js \
    test/integration/fabric-ca-services-tests.js \
    test/integration/e2e.js \
    ${HSM_SCRIPT}
}

runTape $@
