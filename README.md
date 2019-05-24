## Hyperledger Fabric Client SDK for Node.js

The Hyperledger Fabric Client SDK makes it possible to use APIs to interact with a Hyperledger Fabric blockchain. This readme is directed towards a current or future contributor to this project, and gives an overview of setting up the project locally and running tests. For more information on the SDK, including features and an API reference, please visit the [SDK documentation](https://fabric-sdk-node.github.io/).

This project publishes the following npm packages:
* `fabric-client` - main client for the [Hyperledger Fabric](http://hyperledger-fabric.readthedocs.io/en/latest/). Applications can use this package to install and instantiate chaincodes, submit transactions and make queries against a Hyperledger Fabric-based blockchain network.
* `fabric-ca-client` - client for the optional component in Hyperledger Fabric, [fabric-ca](http://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html). The fabric-ca component allows applications to enroll Peers and application users to establish trusted identities on the blockchain network. It also provides support for pseudonymous transaction submissions with Transaction Certificates. If the target blockchain network is configured with standard Certificate Authorities for trust anchors, the application does not need to use this package.
* `fabric-common` - This package contains common codes shared by other packages
* `fabric-network` - This package encapsulates the APIs to connect to a Fabric network, submit transactions and perform queries against the ledger at a higher level of abstraction than through the `fabric-client`.
* `fabric-protos` - This package encapsulates the protobuffers that are used to communicate over gRPC

## Build and Test
To build and test, the following pre-requisites must be installed first:
* node runtime LTS version 8 or 10
* npm tool version 5.6.0 or higher
* gulp command (must be installed globally with `npm install -g gulp`)
* docker (not required if you only want to run the headless tests with `npm test`, see below)


### Run unit tests
Clone the project and launch the following commands to install the dependencies and perform various tasks.

In the project root folder:
* Install all dependancies via `npm install`
* Optionally, to generate API docs via `gulp docs` 
* To generate the required crypto material used by the tests, use one of the following patform specific commands:
  * For Linux `gulp install-and-generate-certs`
  * For mac `gulp install-and-generate-certs-mac`
  * For s390 `gulp install-and-generate-certs-s390`
* To run the headless tests that do not require any additional set up use `npm test` or `gulp test-headless` 

### Run Integration Tests
Integration tests run on the master branch require the most recent stable Fabric images, which are hosted on Nexus. A utility script is provided to retrieve non-published docker images, which may be run using the command `npm run retrieve-images`

Now you are ready to run the integration tests. It is advisable to clear out any previous key value stores that may have cached user enrollment certificates using the command (`rm -rf /tmp/hfc-*`, `rm -rf ~/.hfc-key-store`) prior to testing in isolation.

We have functional and scenario based tests that may be run via the following commands:
  * end to end (tape) tests may be run via `gulp run-test-functional`
  * scenario (cucumber) tests may be run via `gulp run-test-scenario`
  * You may run both integration test styles using `gulp run-test-fv-scenario`
  * All tests (unit and integration) may be run using the command `gulp run-test-all`
  * It is possible to run tests individually, though at the moment the functional integration tests are not isolated, meaning that there is a sequencing requirement. For instance, one of the e2e tests under `test/integration/e2e.js` may be run in the sequence
    * `node test/integration/e2e/create-channel.js`
    * `node test/integration/e2e/join-channel.js`
    * `node test/integration/e2e/updateAnchorPeers.js`
    * `node test/integration/e2e/install-chaincode.js`
    * `node test/integration/e2e/instantiate-chaincode.js`
    * `node test/integration/e2e/invoke-transaction.js`
    * `node test/integration/e2e/query.js`

### Special Tests for Hardware Security Module support via PKCS#11 interface
The SDK has support for PKCS#11 interface in order to allow applications to make use of HSM devices for key management. To turn these tests off, set environment variable "PKCS11_TESTS" to "false". In order to run the tests:

* Install a software emulator of the PKCS#11 interface. The unit tests have been tried with SoftHSM2:
  * install using the package manager for your host system:
    * Ubuntu:  apt-get install softhsm2
    * macOS: brew install softhsm
  * or install from source:
    * install openssl 1.0.0+ or botan 1.10.0+
    * download the source code from https://dist.opendnssec.org/source/softhsm-2.2.0.tar.gz
    * `tar -xvf softhsm-2.2.0.tar.gz`
    * `cd softhsm-2.2.0`
    * `./configure --disable-gost` (would require additional libraries, turn it off unless you need gost algorithm support for the Russian market)
    * `make`
    * `sudo make install`
  * set environment variable "SOFTHSM2_CONF" to "./test/fixtures/hsm/softhsm2.conf"
  * create a token to store keys inside slot 0: `softhsm2-util --init-token --slot 0 --label "My token 1"`, you will be prompted two PINs: SO (Security Officer) PIN that can be used to re-initialize the token, and user PIN to be used by applications to access the token for generating and retrieving keys

The unit test assumes slot '0' and user PIN `98765432`. If your configuration is different, use these environment variables to pass in the values:
* PKCS11_LIB - path to the SoftHSM2 library, if not specified, the test case searches through a list of popular install locaions
* PKCS11_PIN
* PKCS11_SLOT

### Hyperledger Fabric Client objects and reference documentation
The SDK has support for Java based Chaincode. To turn these tests off, set the environment variable "JAVA_TESTS" to false.

### Hyperledger Fabric Client objects 
fabric-client and fabric-ca-client are written in CommonJS modules and take advantage of ECMAScript 2015 class syntax.

* The main top-level class is **Client**. The client's view of a fabric [channel] is the class **Channel**.
The SDK allows you to interact with multiple channels. A channel object can be configured with a different ordering service or share a common ordering service, depending on how the target blockchain network is set up. A client object has a _KeyValueStore_ to store private keys and certificates for authenticated users. Through the client object the application can perform
* The **KeyValueStore** is a very simple interface which SDK uses to store and retrieve all persistent data. This data includes private keys, so it is very important to keep this storage secure. The default implementation is a simple file-based version found in the _FileKeyValueStore_ class. The SDK also provides an implementation based on CouchDB which can be configured to use a local CouchDB database or a remote deployment including a Cloudant database.
* The **User** class represents an end user who transacts on the channel. The user object must have a valid enrollment configured in order to properly sign transaction requests. The enrollment materials can either be obtained from enrolling with fabric-ca or an external Certificate Authority.
* The **FabricCAClientImpl** class provides security and identity related features such as user registration and enrollment, transaction certificate issuance. The Hyperledger Fabric has a built-in implementation that issues _ECerts_ (enrollment certificates) and _TCerts_ (transaction certificates). ECerts are for enrollment identity and TCerts are for transactions.

### Pluggability
HFC defines the following abstract classes for application developers to supply extensions or alternative implementations. For each abstract class, a built-in implementation is included with the ability to load alternative implementations via designated environment variables:

1. To replace FileKeyValueStore with a different implementation, such as one that saves data to a database, specify "KEY_VALUE_STORE" and provide the full require() path to an alternative implementation of the api.KeyValueStore abstract class.

2. The cryptography suite used by the default implementation uses ECDSA for asymmetric keys cryptography, AES for encryption and SHA2/3 for secure hashes. A different suite can be plugged in with "CRYPTO_SUITE" environment variable specifying full require() path to the alternative implementation of the api.CrytoSuite abstract class.

3. If the user application uses an alternative membership service than the one provided by the component `fabric-ca`, the client code will likely need to use an alternative client to `fabric-ca-client` to interact with that membership service.

### Continuous Integration

Please have a look at [Continuous Integration Process](docs/sdk-node-ci.md)


### Release notes

Check the `./release_notes` directory for the release notes of the specified release.

### Contributing

Check [the documentation](./CONTRIBUTING.md) on how to contribute to this project for the full details.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
