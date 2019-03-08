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
