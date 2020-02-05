#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#

set -o pipefail
set -ev

####
# Note: the tape unit suite is being deprecated in favour of mocha. Please do not add files to this function
####

runTapeUnit() {
    # Run HSM tests by default
    HSM_SCRIPT=test/unit/pkcs11.js
    # If the script has been called with noHSM parameter
    # exclude test/unit/pkcs11.js
    if [ $1 ] && [ $1 == 'noHSM' ]
    then
        unset HSM_SCRIPT
    fi

    npx tape test/unit/channel.js \
    test/unit/commit-handler.js \
    test/unit/config.js \
    test/unit/couchdb-key-value-store.js \
    test/unit/crypto-key-store.js \
    test/unit/cryptosuite-ecdsa-aes.js \
    test/unit/cryptosuite-pkcs11.js \
    test/unit/ecdsa-key.js \
    test/unit/endorser-handler.js \
    test/unit/file-key-value-store.js \
    test/unit/identity.js \
    test/unit/logger.js \
    test/unit/msp.js \
    test/unit/network-config.js \
    test/unit/packager.js \
    test/unit/read-configtx.js \
    test/unit/remote.js \
    test/unit/user.js \
    ${HSM_SCRIPT} \
    | npx tap-colorize
}

runTapeUnit $* 