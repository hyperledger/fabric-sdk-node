## Hyperledger Fabric Client SDK for Node.js

<div style="float: right">
<table align="right">
  <tr><th>Branch</th><th>Build status</th></tr>
  <tr><td>master</td><td><a href="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build/latest?definitionId=47&branchName=master"><img src="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_apis/build/status/Fabric-SDK-Node?branchName=master"></a></td></tr>
  <tr><td>release-2.2</td><td><a href="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build/latest?definitionId=47&branchName=release-2.2"><img src="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_apis/build/status/Fabric-SDK-Node?branchName=release-2.2"></a></td></tr>
  <tr><td>release-1.4</td><td><a href="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build/latest?definitionId=47&branchName=release-1.4"><img src="https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_apis/build/status/Fabric-SDK-Node?branchName=release-1.4"></a></td></tr>
</table>
</div>

The Hyperledger Fabric Client SDK makes it possible to use APIs to interact with a Hyperledger Fabric blockchain. This readme is directed towards a current or future contributor to this project, and gives an overview of setting up the project locally and running tests. For more information on the SDK, including features and an API reference, please visit the [SDK documentation](https://hyperledger.github.io/fabric-sdk-node/).

This project publishes the following npm packages:
* `fabric-ca-client` - client for the optional component in Hyperledger Fabric, [fabric-ca](http://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html). The fabric-ca component allows applications to enroll Peers and application users to establish trusted identities on the blockchain network. It also provides support for pseudonymous transaction submissions with Transaction Certificates. If the target blockchain network is configured with standard Certificate Authorities for trust anchors, the application does not need to use this package.
* `fabric-common` - encapsulates the common code used by all fabric-sdk-node packages supporting fine grain interactions with the Fabric network to send transaction invocations
* `fabric-network` - This package encapsulates the APIs to connect to a Fabric network, submit transactions and perform queries against the ledger at a higher level of abstraction than through the `fabric-common`.
* `fabric-protos` - This package encapsulates the protobuffers that are used to communicate over gRPC

## Build and Test
To build and test, the following pre-requisites must be installed first:
* Node.js, version 10 is supported from 10.15.3 and higher
* Node.js, version 12 is supported from 12.13.1 and higher
* npm tool version 6 or higher
* docker (only required for running integration tests, see below)

### Run unit tests
Clone the project and launch the following commands to install the dependencies and perform various tasks.

In the project root folder:
* Install all dependencies via `npm install`
* Optionally, to generate API docs via `npm run docs`
* To generate the required crypto material used by the tests, use the npm task `npm run installAndGenerateCerts`
* To run the unit tests that do not require any additional set up, use `npm run testHeadless`

### Run Integration Tests
Integration tests run on the master branch require the most recent stable Fabric images, which are hosted on Artifactory. A utility script is provided to retrieve non-published docker images, which may be run using the command `npm run pullFabricImages`

Now you are ready to run the integration tests. It is advisable to clear out any previous key value stores that may have cached user enrollment certificates using the command (`rm -rf /tmp/hfc-*`, `rm -rf ~/.hfc-key-store`) prior to testing in isolation.

We have functional and scenario based tests that may be run via the following commands:
  * end to end (tape) tests may be run via `npm run tapeIntegration`
  * scenario (cucumber) tests may be run via `npm run cucumberScenario`
  * You may run both integration test styles using `npm run tapeAndCucumber`
  * All tests (unit and integration) may be run using the command `npm test` or `npm run testNoHSM` when not using a HSM or HSM simulator

### Special Tests for Hardware Security Module support via PKCS #11 interface

The SDK has support for Hardware Security Module (HSM) via PKCS #11 interface. See the test [README](test/README.md) for details of how to run HSM tests locally.

### Pluggability
HFC defines the following abstract classes for application developers to supply extensions or alternative implementations. For each abstract class, a built-in implementation is included with the ability to load alternative implementations via designated environment variables:

1. To replace FileKeyValueStore with a different implementation, such as one that saves data to a database, specify "KEY_VALUE_STORE" and provide the full require() path to an alternative implementation of the api.KeyValueStore abstract class.

2. The cryptography suite used by the default implementation uses ECDSA for asymmetric keys cryptography, AES for encryption and SHA2/3 for secure hashes. A different suite can be plugged in with "CRYPTO_SUITE" environment variable specifying full require() path to the alternative implementation of the api.CrytoSuite abstract class.

3. If the user application uses an alternative membership service than the one provided by the component `fabric-ca`, the client code will likely need to use an alternative client to `fabric-ca-client` to interact with that membership service.

### Continuous Integration

Our Continuous Integration is run using [Azure Pipelines](https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build). Builds are automatically triggered on opening pull requests.

### Release notes

Check the `./release_notes` directory for the release notes of the specified release.

### Contributing

Check [the documentation](./CONTRIBUTING.md) on how to contribute to this project for the full details.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
