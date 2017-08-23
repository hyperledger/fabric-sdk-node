## Hyperledger Fabric Client SDK for Node.js

[![Build Status](https://jenkins.hyperledger.org/buildStatus/icon?job=fabric-sdk-node-merge-x86_64)](https://jenkins.hyperledger.org/view/fabric-sdk-node/job/fabric-sdk-node-merge-x86_64/)
[![Documentation Status](https://readthedocs.org/projects/fabric-sdk-node/badge/?version=master)](http://fabric-sdk-node.readthedocs.io/en/master/?badge=master)

The Hyperledger Fabric Client SDK makes it easy to use APIs to interact with a Hyperledger Fabric blockchain.

As an application developer, to learn about how to install and use the Node.js SDK, please visit the [SDK documentation](https://fabric-sdk-node.github.io/).

This project publishes two separate npm packages:
* `fabric-client` - main client for the [Hyperledger Fabric](http://hyperledger-fabric.readthedocs.io/en/latest/). Applications can use this package to install and instantiate chaincodes, submit transactions and make queries against a Hyperledger Fabric-based blockchain network.
* `fabric-ca-client` - client for the optional component in Hyperledger Fabric, [fabric-ca](http://hyperledger-fabric.readthedocs.io/en/latest/Setup/ca-setup.html). The fabric-ca component allows applications to enroll Peers and application users to establish trusted identities on the blockchain network. It also provides support for pseudonymous transaction submissions with Transaction Certificates. If the target blockchain network is configured with standard Certificate Authorities for trust anchors, the application does not need to use this package.

The following section targets a current or future contributor to this project itself.

### Build and Test
To build and test, the following pre-requisites must be installed first:
* node runtime version 6.9.x or higher, and 8.4.0 or higher ( __Node v7+ is not supported__ )
* npm tool version 3.10.x or higher
* gulp command (must be installed globaly with `npm install -g gulp`)
* docker (not required if you only want to run the headless tests with `npm test`, see below)

Clone the project and launch the following commands to install the dependencies and perform various tasks.

In the project root folder:
* `npm install` to install dependencies
* optionally, `gulp watch` to set up watch that updates fabric-ca-client's shared dependencies from fabric-client/lib and updates installed fabric-client and fabric-ca-client modules in node_modules. This command does not return, so you should keep it running in a separate command window as you work on the code and test in another command window. Note that you do NOT need to run this unless you plan to make changes in the fabric-client and fabric-ca-client packages
* optionally, `gulp doc` to generate API docs if you want to review the doc content
* `npm test` or `gulp test-headless` to run the headless tests that do not require any additional set up

The following tests require setting up a local blockchain network as the target. Because v1.0 is still in active development, you still need to build the necessary Docker images needed to run the network. Follow the steps below to set it up.
* You will need the peers, orderers and fabric-ca server (new implementation of the member service) to run the tests. The first two components are from the *fabric* repository. The fabric-ca server is from the *fabric-ca* repository.
* git clone both the *fabric* and *fabric-ca* repositories into the $GOPATH/src/github.com/hyperledger folder in your native host (MacOS, Windows or Ubuntu, etc).

You can build the docker images in your native host (Mac, Ubuntu, Windows, etc.):
* If docker is installed and it’s not ‘Docker for Mac/Windows’, uninstall and follow Docker’s clean up instructions to uninstall completely.
* Install [‘Docker for Mac’](https://docs.docker.com/docker-for-mac/install) or [`Docker for Windows`](https://docs.docker.com/docker-for-windows/install), or [`Docker on linux`](https://docs.docker.com/engine/installation/linux/ubuntu/#install-docker)
* Only for Mac, you need to install a gnu-compatible version of the `tar` utility:
  * Install Brew: http://brew.sh
  * run `brew install gnu-tar —-with-default-names` in order to swap out Mac's default tar command for a gnu-compliant one needed by chaincode execution on the peers

* build fabric-ca docker image (new membership service)
  * cd `$GOPATH/src/github.com/hyperledger/fabric-ca
  * run `make docker`. For more build instructions see [fabric-ca README](https://github.com/hyperledger/fabric-ca)
* build fabric peer and orderer docker images and other ancillary images
  * `cd $GOPATH/src/github.com/hyperledger/fabric`
  * run `make docker` to build the docker images (you may need to run `make docker-clean` first if you've built before)
* Now you are ready to run the tests:
  * Clear out your previous key value stores that may have cached user enrollment certificates (`rm -rf /tmp/hfc-*`, `rm -rf ~/.hfc-key-store`)
  * run `gulp test` to execute the entire test suite (800+ test cases), or you can run them individually
  * Test happy path from end to end, run `node test/integration/e2e.js`
  * Test end to end one step at a time, make sure to follow this sequence:
    * `node test/integration/e2e/create-channel.js`
    * `node test/integration/e2e/join-channel.js`
    * `node test/integration/e2e/install-chaincode.js`
    * `node test/integration/e2e/instantiate-chaincode.js`
    * `node test/integration/e2e/invoke-transaction.js`
    * `node test/integration/e2e/query.js`
  * Test user management by member services with the following tests that exercise the fabric-ca-client package with a KeyValueStore implementations for a file-based KeyValueStore as well as a CouchDB KeyValueStore. To successfully run this test, you must first set up a CouchDB database instance on your local machine. Please see the instructions below.
    * `test/integration/fabric-ca-services-tests.js`
    * `test/integration/couchdb-fabricca-tests.js`
    * `test/integration/cloudant-fabricca-tests.js`
  * To re-run `node test/integration/e2e.js` or `fabric-ca-services-tests.js` stop the network (ctrl-c), clean up the docker instances (`docker rm $(docker ps -aq)`) and restart the network with `docker-compose up` as described above.

### Special Tests for Hardware Security Module support (experimental) via PKCS#11 interface
The SDK has experimental support for PKCS#11 interface in order to allow applications to make use of HSM devices for key management. Unit tests for this feature are skipped by default. To run these testss:

* set environment variable "PKCS11_TESTS" to "true"
* install a software emulator of the PKCS#11 interface. The unit tests have been tried with SoftHSM2:
  * install openssl 1.0.0+ or botan 1.10.0+
  * download the source code from https://dist.opendnssec.org/source/softhsm-2.2.0.tar.gz
  * `tar -xvf softhsm-2.2.0.tar.gz`
  * `cd softhsm-2.2.0`
  * `./configure --disable-gost` (would require additional libraries, turn it off unless you need gost algorithm support for the Russian market)
  * `make`
  * `sudo make install`
  * create a token to store keys inside slot 0: `softhsm2-util --init-token --slot 0 --label "My token 1"`, you will be prompted two PINs: SO (Security Officer) PIN that can be used to re-initialize the token, and user PIN to be used by applications to access the token for generating and retrieving keys

The unit test assumes slot '0' and user PIN `98765432`. If your configuration is different, use these environment variables to pass in the values:
* PKCS11_LIB - path to the SoftHSM2 library, if not specified, the test case searches through a list of popular install locations
* PKCS11_PIN
* PKCS11_SLOT

### Contributor Check-list
The following check-list is for code contributors to make sure their changesets are compliant to the coding standards and avoid time wasted in rejected changesets:

Check the coding styles, run the following command and make sure no ESLint violations are present:
* `gulp`

Run the full unit test bucket and make sure 100% are passing.  Because v1.0 is still in active development, all tests may not pass. You can run each individually to isolate the failure(s):
* `gulp test`

The gulp test command above also generates code coverage reports. Your new code should be accompanied with unit tests and provide 80% line coverage or higher.

### Hyperledger Fabric Client objects and reference documentation
For a high-level design specificiation for Fabric SDKs of all languages, visit [this google doc](https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing) (Work-In-Progress).

fabric-client and fabric-ca-client are written in CommonJS modules and take advantage of ECMAScript 2015 class syntax.

* The main top-level class is **Channel**. It is the client's view of a fabric [channel](https://docs.google.com/document/d/1eRNxxQ0P8yp4Wh__Vi6ddaN_vhN2RQHP-IruHNUwyhc/). The SDK allows you to interact with multiple channels. A channel object can be configured with a different ordering service or share a common ordering service, depending on how the target blockchain network is set up. A channel object has a _KeyValueStore_ to store private keys and certificates for authenticated users. Through the channel object the application can perform 
* The **KeyValueStore** is a very simple interface which SDK uses to store and retrieve all persistent data. This data includes private keys, so it is very important to keep this storage secure. The default implementation is a simple file-based version found in the _FileKeyValueStore_ class. The SDK also provides an implementation based on CouchDB which can be configured to use a local CouchDB database or a remote deployment including a Cloudant database.
* The **User** class represents an end user who transacts on the channel. The user object must have a valid enrollment configured in order to properly sign transaction requests. The enrollment materials can either be obtained from enrolling with fabric-ca or an external Certificate Authority.
* The **EventHub** class encapsulates the interaction with the network peers' event streams.
* The **FabricCAClientImpl** class provides security and identity related features such as user registration and enrollment, transaction certificate issuance. The Hyperledger Fabric has a built-in implementation that issues _ECerts_ (enrollment certificates) and _TCerts_ (transaction certificates). ECerts are for enrollment identity and TCerts are for transactions.

### Pluggability
HFC defines the following abstract classes for application developers to supply extensions or alternative implementations. For each abstract class, a built-in implementation is included with the ability to load alternative implementations via designated environment variables:

1. To replace FileKeyValueStore with a different implementation, such as one that saves data to a database, specify "KEY_VALUE_STORE" and provide the full require() path to an alternative implementation of the api.KeyValueStore abstract class.

2. The cryptography suite used by the default implementation uses ECDSA for asymmetric keys cryptography, AES for encryption and SHA2/3 for secure hashes. A different suite can be plugged in with "CRYPTO_SUITE" environment variable specifying full require() path to the alternative implementation of the api.CrytoSuite abstract class.

3. If the user application uses an alternative membership service than the one provided by the component `fabric-ca`, the client code will likely need to use an alternative client to `fabric-ca-client` to interact with that membership service.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
