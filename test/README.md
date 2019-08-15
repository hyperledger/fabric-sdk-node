# Fabric-SDK-Node Tests

Welcome to the Fabric-SDK-Node test readme. 

There are three types of testing that are used to support Fabric-SDK-Node:
 - Unit
 - Functional
 - Scenario

Unit tests are located in a `package/test` directory that mirrors the `package/lib` directory and are Mocha based. Unit tests that are located here, and that are tape based, are in the process of being ported to Mocha; CRs to extend these tape unit tests will not be accepted. 

The functional tests are currently written in [Tape](https://github.com/substack/tape), with the intention of testing the Fabric-SDK-Node package capabilities from a user perspective against a live Hyperledger Fabric Network.

The scenario tests are written in [Cucumber](https://github.com/cucumber/cucumber-js), with the intention of providing high level test coverage from a scenario perspective. For more information, please refer to the [README](./scenario/README.md) within the scenario directory.

Test certificates are set to expire a year after generation. Due to this the test suite generates new certificates as part of the build process, and is a manual requirement prior to running the tests locally. This process is orchestrated using gulp files that:
 - Download, install and export the path to the 1.4 Hyperledger Fabric binaries used for generating crypto material
 - Generate the crypto-material, matching channel blocks and fabric-ca certificates required by the docker-compose files and test suites

Use the gulp task `gulp install-and-generate-certs` to perform the above on a linux x64 machine, or `gulp install-and-generate-certs-mac` for a mac. This is only required to be performed upon initial project clone, and then yearly afterwards.

## Structure

The folder structure is the following:

```
test
│   README.md
│
└───fixtures
└───integration
└───scenario
└───typescript
└───unit
```

- `fixtures` holds all the configuration files used by the integration and scenario tests
- `integration` contains the interation test suite
- `scenario` contains the sceanrio test suite
- `typescript` contains the typescript test suite
- `unit` contains the deprecated unit test suite

## Configuring and running Hardware Security Module tests

Below are the steps required to run Hardware Security Module (HSM) tests locally.

### Install SoftHSM

In order to run the tests in the absence of a real HSM, a software emulator of the PKCS#11 interface is required.
For more information please refer to [SoftHSM](https://www.opendnssec.org/softhsm/).

SoftHSM can either be installed using the package manager for your host system:

* Ubuntu: `apt-get install softhsm2`
* macOS: `brew install softhsm`
* Windows: **unsupported**

Or compiled and installed from source:

1. install openssl 1.0.0+ or botan 1.10.0+
2. download the source code from <https://dist.opendnssec.org/source/softhsm-2.2.0.tar.gz>
3. `tar -xvf softhsm-2.2.0.tar.gz`
4. `cd softhsm-2.2.0`
5. `./configure --disable-gost` (would require additional libraries, turn it off unless you need gost algorithm support
   for the Russian market)
6. `make`
7. `sudo make install`

### Specify the SoftHSM configuration file

```bash
export SOFTHSM2_CONF="./test/fixtures/hsm/softhsm2.conf"
```

### Create a token to store keys in the HSM

```bash
softhsm2-util --init-token --slot 0 --label "My token 1"
```

Then you will be prompted two PINs: SO (Security Officer) PIN that can be used to re-initialize the token, and user PIN
(see below) to be used by applications to access the token for generating and retrieving keys.

### Configure tests

By default the tests run with SoftHSM using slot `0` and user PIN `98765432`. If your configuration is different, use
these environment variables to pass in the values:

* PKCS11_LIB - path to the SoftHSM2 library; if not specified, the tests search a list of common install locations
* PKCS11_PIN
* PKCS11_SLOT

To turn these tests off, set environment variable `PKCS11_TESTS` to `false`:
```bash
export PKCS11_TESTS=false
```
