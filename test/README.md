# Fabric-SDK-Node Tests

Welcome to the Fabric-SDK-Node test readme.

There are two types of testing that are used to support Fabric-SDK-Node:
 - Unit
 - Scenario

Unit tests are located in a `package/test` directory that mirrors the `package/lib` directory and are Mocha based.

The scenario tests are written in typescript and use [Cucumber](https://github.com/cucumber/cucumber-js), with the intention of providing high level test coverage from a scenario perspective. For more information, please refer to the [README](./ts-scenario/README.md) within the scenario directory.

Test certificates are set to expire a year after generation. Due to this the test suite generates new certificates as part of the build process, and is a manual requirement prior to running the tests locally. This process is orchestrated using test scripts that:
 - Generate the crypto-material, matching channel blocks and fabric-ca certificates required by the docker-compose files and test suites

Use the npm task `npm run installAndGenerateCerts` to perform the above on a linux x64 machine, or `npm run installAndGenerateCertsMac` for a mac. This is only required to be performed upon initial project clone, and then yearly afterwards.

## Structure

The folder structure is the following:

```
test
│   README.md
│
└───ts-fixtures
└───ts-scenario
```

- `ts-fixtures` holds all the configuration files used by the integration and scenario tests
- `ts-scenario` contains the typescripts scenario test suite

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
export SOFTHSM2_CONF="./test/ts-fixtures/hsm/softhsm2.conf"
```

### Create a token to store keys in the HSM

```bash
softhsm2-util --init-token --slot 0 --label "ForFabric" --pin 98765432 --so-pin 1234
```

The Security Officer PIN, specified with the `--so-pin` flag, can be used to re-initialize the token, 
and the user PIN (see below), specified with the `--pin` flag, is used by applications to access the token for 
generating and retrieving keys.

### Configure tests

By default the tests run with SoftHSM using slot `0` and user PIN `98765432`. If your configuration is different, use
these environment variables to pass in the values:

* PKCS11_LIB - path to the SoftHSM2 library; if not specified, the tests search a list of common install locations
* PKCS11_PIN
* PKCS11_SLOT

To not run the HSM scenario tests, the npm script `cucumberScenarioNoHSM` should be specified or use the 'testNoHSM' when running executing all tests.
