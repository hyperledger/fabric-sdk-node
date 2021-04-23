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

    # Tests have to be executed in the following order

    # First run the ca-tests that run good/bad path member registration/enrollment scenarios
    # The remaining tests re-use the same key value store with the saved user certificates, in order to interact with the network
    npx tape test/integration/fabric-ca-affiliation-service-tests.js \
        test/integration/fabric-ca-identity-service-tests.js \
        test/integration/fabric-ca-certificate-service-tests.js \
        test/integration/fabric-ca-services-tests.js

}

runTape $@
