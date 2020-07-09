## Hyperledger Fabric Client SDK for Node.js

[![Build Status](https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_apis/build/status/hyperledger.fabric-sdk-node?branchName=release-1.4)](https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build/latest?definitionId=47&branchName=release-1.4)


The Hyperledger Fabric Client SDK makes it possible to use APIs to interact with a Hyperledger Fabric blockchain.

As an application developer, to learn about how to install and use the Node.js SDK, please visit the [SDK documentation](https://hyperledger.github.io/fabric-sdk-node/release-1.4/).

This project publishes three separate npm packages:
* `fabric-client` - main client for the [Hyperledger Fabric](http://hyperledger-fabric.readthedocs.io/en/latest/). Applications can use this package to install and instantiate chaincodes, submit transactions and make queries against a Hyperledger Fabric-based blockchain network.
* `fabric-ca-client` - client for the optional component in Hyperledger Fabric, [fabric-ca](http://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html). The fabric-ca component allows applications to enroll Peers and application users to establish trusted identities on the blockchain network. It also provides support for pseudonymous transaction submissions with Transaction Certificates. If the target blockchain network is configured with standard Certificate Authorities for trust anchors, the application does not need to use this package.
* `fabric-network` - This package encapsulates the APIs to connect to a Fabric network, submit transactions and perform queries against the ledger at a higher level of abstraction than through the `fabric-client`.

The following section targets a current or future contributor to this project itself.

### Build and Test
To build and test, the following pre-requisites must be installed first:
* Node.js, version 10 is supported from 10.15.3 and higher
* Node.js, version 12 is supported from 12.15.0 and higher
* npm tool version 5.5.1 or higher
* docker (only required for running integration tests, see below)

Clone the project and launch the following commands to install the dependencies and perform various tasks.

In the project root folder:
* `npm install` to install dependencies
* optionally, `npm run docs` to generate API docs if you want to review the doc content
* To run the unit tests that do not require any additional set up, use `npm run testHeadless`

The following tests require setting up a local blockchain network as the target. You need to build the necessary Docker images required to run the network. Follow the steps below to set it up.
* You will need the peers, orderers and fabric-ca server (new implementation of the member service) to run the tests. The first two components are from the *fabric* repository. The fabric-ca server is from the *fabric-ca* repository.
* git clone both the *fabric* and *fabric-ca* repositories into the $GOPATH/src/github.com/hyperledger folder in your native host (MacOS, Windows or Ubuntu, etc).

You can build the docker images in your native host (Mac, Ubuntu, Windows, etc.):
* If docker is installed and it’s not ‘Docker for Mac/Windows’, uninstall and follow Docker’s clean up instructions to uninstall completely.
* Install [‘Docker for Mac’](https://docs.docker.com/docker-for-mac/install) or [`Docker for Windows`](https://docs.docker.com/docker-for-windows/install), or [`Docker on linux`](https://docs.docker.com/engine/installation/linux/ubuntu/#install-docker)
* Only for Mac, you need to install a gnu-compatible version of the `tar` utility:
  * Install Brew: http://brew.sh
  * run `brew install gnu-tar`.
  * After installing, run `export PATH="/usr/local/opt/gnu-tar/libexec/gnubin:$PATH"` in order to swap out Mac's default tar command for a gnu-compliant one needed by chaincode execution on the peers
  * optionally, you can add the environment PATH variable as above to your .bashrc or .bash_profile.

* build fabric-ca docker image (new membership service)
  * cd `$GOPATH/src/github.com/hyperledger/fabric-ca`
  * run `make docker`. For more build instructions see [fabric-ca README](https://github.com/hyperledger/fabric-ca)
* build fabric peer and orderer docker images and other ancillary images
  * `cd $GOPATH/src/github.com/hyperledger/fabric`
  * run `make docker` to build the docker images (you may need to run `make docker-clean` first if you've built before)
* Now you are ready to run the tests:
  * Clear out your previous key value stores that may have cached user enrollment certificates (`rm -rf /tmp/hfc-*`, `rm -rf ~/.hfc-key-store`)
  * run `npm test` to execute the entire test suite (800+ test cases), or you can run them individually
  * Test happy path from end to end, run `node test/integration/e2e.js`
  * Test end to end one step at a time, make sure to follow this sequence:
    * `node test/integration/e2e/create-channel.js`
    * `node test/integration/e2e/join-channel.js`
    * `node test/integration/e2e/updateAnchorPeers.js`
    * `node test/integration/e2e/install-chaincode.js`
    * `node test/integration/e2e/instantiate-chaincode.js`
    * `node test/integration/e2e/invoke-transaction.js`
    * `node test/integration/e2e/query.js`
  * Test user management by member services with the following tests that exercise the fabric-ca-client package with a KeyValueStore implementations for a file-based KeyValueStore as well as a CouchDB KeyValueStore. To successfully run this test, you must first set up a CouchDB database instance on your local machine. Please see the instructions below.
    * `test/integration/fabric-ca-services-tests.js`
    * `test/integration/couchdb-fabricca-tests.js`
    * `test/integration/cloudant-fabricca-tests.js`
  * To re-run `node test/integration/e2e.js` or `fabric-ca-services-tests.js` stop the network (ctrl-c), clean up the docker instances (`docker rm $(docker ps -aq)`) and restart the network with `docker-compose up` as described above.

### Special Tests for Hardware Security Module support via PKCS#11 interface

The SDK has support for Hardware Security Module via PKCS#11 interface. See [Testing for Hardware Security Module via PKCS#11 interface](https://hyperledger.github.io/fabric-sdk-node/release-1.4/tutorial-hsm-pkcs11.html) for configuration and tests.

### Hyperledger Fabric Client objects and reference documentation
The SDK has support for Java based Chaincode.

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

Our Continuous Integration is run using [Azure Pipelines](https://dev.azure.com/Hyperledger/Fabric-SDK-Node/_build). Builds are automatically triggered on opening pull requests.

### Contributing

Check [the documentation](./CONTRIBUTING.md) on how to contribute to this project for the full details.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
