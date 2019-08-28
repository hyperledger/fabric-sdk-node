This tutorial illustrates the different ways of installing, configuring and testing the Hardware Security Module SoftHSM via PKCS#11 interface with a Hyperledger Fabric SDK for Node.js as of 1.4.

For more information please refer to [SoftHSM](https://www.opendnssec.org/softhsm/).

## Overview

The SDK has support for PKCS#11 interface in order to allow applications to make use of HSM devices for key management.

## Installation

In order to run the tests, install a software emulator of the PKCS#11 interface.

### Install using the package manager for your host system

* Ubuntu: apt-get install softhsm2
* macOS: brew install softhsm
* Windows: **unsupported**.

### Or install from source

1. install openssl 1.0.0+ or botan 1.10.0+
2. download the source code from <https://dist.opendnssec.org/source/softhsm-2.2.0.tar.gz>
3. `tar -xvf softhsm-2.2.0.tar.gz`
4. `cd softhsm-2.2.0`
5. `./configure --disable-gost` (would require additional libraries, turn it off unless you need gost algorithm support for the Russian market)
6. `make`
7. `sudo make install`

### Set environment variable "SOFTHSM2_CONF" to "./test/fixtures/softhsm2.conf"

```bash
export SOFTHSM2_CONF="./test/fixtures/softhsm2.conf"
```

### Create a token to store keys inside slot 0

```bash
softhsm2-util --init-token --slot 0 --label "My token 1"
```

Then you will be prompted two PINs: SO (Security Officer) PIN that can be used to re-initialize the token, and user PIN to be used by applications to access the token for generating and retrieving keys.

## Test

The unit tests have been tried with SoftHSM2 and assumes slot '0' and user PIN `98765432`. If your configuration is different, use these environment variables to pass in the values:

* PKCS11_LIB - path to the SoftHSM2 library, if not specified, the test case searches through a list of popular install locaions
* PKCS11_PIN
* PKCS11_SLOT

To turn these tests off, set environment variable "PKCS11_TESTS" to "false".
