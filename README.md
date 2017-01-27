## Hyperledger Fabric Client SDK for Node.js

[![Build Status](https://jenkins.hyperledger.org/buildStatus/icon?job=fabric-sdk-node-merge-x86_64)](https://jenkins.hyperledger.org/view/fabric-sdk-node/job/fabric-sdk-node-merge-x86_64/)
[![Documentation Status](https://readthedocs.org/projects/fabric-sdk-node/badge/?version=master)](http://fabric-sdk-node.readthedocs.io/en/master/?badge=master)

The Hyperledger Fabric Client SDK makes it easy to use APIs to interact with a Hyperledger Fabric blockchain.

As an application developer, to learn about how to install and use the Node.js SDK, please visit the [fabric documentation](http://hyperledger-fabric.readthedocs.io/en/latest/Setup/NodeSDK-setup).

The following section targets a current or future contributor to this project itself.

### Build and Test
To build and test, the following pre-requisites must be installed first:
* node runtime version 4.5 or later (which also installs the npm tool)
* npm tool version 2.15.9 or later
* gulp command
* docker (not required if you only want to run the headless tests with `npm test`, see below)

Clone the project and launch the following commands to install the dependencies and perform various tasks.

This project publishes two separate npm packages:
* `fabric-client` - main client for the Hyperledger Fabric. Applications can use this package to deploy chaincodes, submit transactions and make queries against a Hyperledger Fabric-based blockchain network.
* `fabric-ca-client` - client for the optional component in Hyperledger Fabric, [fabric-ca](https://github.com/hyperledger/fabric-ca). The fabric-ca component allows applications to enroll Peers and application users to establish trusted identities on the blockchain network. It also provides support for pseudonymous transaction submissions with Transaction Certificates. If the target blockchain network is configured with standard Certificate Authorities for trust anchors, then the application does not need to use this package.

In the project root folder:
* `npm install` to install dependencies
* `gulp ca` to copy common dependent modules from the `fabric-client` folder to the `fabric-ca-client` folder
* `gulp watch` to set up watch that updates fabric-ca-client's shared dependencies from fabric-client/lib and updates installed fabric-client and fabric-ca-client modules in node_modules. This command does not return, so you should keep it running in a separate command window as you work on the code and test in another command window
* optionally, `gulp doc` to generate API docs if you want to review the doc content
* `npm test` to run the headless tests that do not require any additional set up

The following tests require setting up a local blockchain network as the target. Because v1.0 is still in active development, you still need the vagrant environment to build the necessary Docker images needed to run the network. Follow the steps below to set it up.
* You will need the fabric-ca server (new implementation of the member service) to run the tests. Because the fabric-ca project's build script does not yet produce a docker image, you'd need to run the fabric-ca server as a native process inside vagrant
* git clone both the *fabric* and *fabric-ca* repositories into the $GOPATH/src/github.com/hyperledger folder in your native host (MacOS, Windows or Ubuntu, etc).

If you are using a Mac and would like to build the docker images and run them natively instead of using vagrant, do the following:
* If docker is installed and it’s not ‘Docker for Mac’, uninstall and follow Docker’s clean up instructions to uninstall completely.
* Install ‘Docker for Mac’. 
* Install Brew: http://brew.sh
* run `brew install gnu-tar —-with-default-names`

* To use vagrant, do the following:
* `cd fabric/devenv`
* Open the file `Vagrantfile` and insert the following statement below the existing `config.vm.network` statements:
  * `  config.vm.network :forwarded_port, guest: 7056, host: 7056 # Openchain gRPC services`

* run `vagrant up` to launch the vagrant VM
* Once inside vagrant, follow these steps to start the fabric-ca server and the Peers network with orderer
* start fabric-ca (new membership service)
  * cd `$GOPATH/src/github.com/hyperledger/fabric-ca
  * run `make fabric-ca` to build the fabric-ca binary or follow the instructions in [fabric-ca README](https://github.com/hyperledger/fabric-ca)
  * from the `fabric-ca` folder, launch the following command to start the fabric-ca server. The ec.pem and ec-key.pem certificates sets up the fabric-ca server as the trusted root that the Peer nodes have been statically configured as a temporary measure. In other words, the Peers will be able to trust any user certificates that have been signed by the fabric-ca server. This is important because the endorser code inside the Peer will need to validate the user certificate issued by fabric-ca before using it to verify the signature of the transaction proposal.
  	* `bin/fabric-ca server start -ca testdata/ec.pem -ca-key testdata/ec-key.pem -config testdata/testconfig.json`
* start the Peer network
  * `cd $GOPATH/src/github.com/hyperledger/fabric`
  * run `make docker` to build the docker images
  * create a docker-compose.yml file in home directory (/home/vagrant), and copy [docker-compose.yml](https://raw.githubusercontent.com/hyperledger/fabric-sdk-node/master/test/fixtures/docker-compose.yml) file content into the file
  * from /home/vagrant, run `docker-compose up --force-recreate` to launch the network
* Back in your native host (MacOS, or Windows, or Ubuntu, etc), run the following tests:
  * Clear out your previous key value store if needed for fabric-sdk-node (`rm -fr /tmp/hfc-*`) and for fabric-ca (`rm <...>/fabric-ca/testdata/fabric-ca.db`)
  * Clear out your previous chaincode if needed by restarting the docker images (`docker-compose up --force-recreate`)
  * Run `gulp test` to run the entire test bucket and generate coverage reports (both in console output and HTMLs)
  * Test user management by member services with the `test/unit/ca-tests.js`. This test exercises the KeyValueStore implementations for a file-based KeyValueStore as well as a CouchDB KeyValueStore. To successfully run this test, you must first set up a CouchDB database instance on your local machine. Please see the instructions below.
  * Test happy path from end to end, run `node test/unit/end-to-end.js`
  * Test transaction proposals, run `node test/unit/endorser-tests.js`
  * Test sending endorsed transactions for consensus, run `node test/unit/orderer-tests.js`

### Set Up CouchDB Database for couchdb-fabriccop-tests.js

The KeyValueStore database implementation is done using [Apache CouchDB](http://couchdb.apache.org/). To quickly set up a database instance on your local machine, pull in the CouchDB Docker image from [Docker hub](https://hub.docker.com/_/couchdb/).

	docker pull couchdb

Start up the database instance and expose the default port 5984 on the host.

	docker run -d -p 5984:5984 --name my-couchdb couchdb

Ensure that the Docker container running CouchDB is up.

	docker ps

You will see output similar to the one below:

```
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                    NAMES
33caf5a80fca        couchdb             "tini -- /docker-entr"   47 hours ago        Up 47 hours         0.0.0.0:5984->5984/tcp   my-couchdb
```

Ensure that CouchDB instance is up and ready for requests.

	curl DOCKER_HOST_IP:5984/

For example, the default `DOCKER_HOST_IP` on Mac is `192.168.99.100` or `localhost', therefore the request becomes:

	curl 192.168.99.100:5984/
	or
	curl localhost:5984/

If the database is up and running, you will receive the following response:

	{
		"couchdb": "Welcome",
		"uuid": "01b6d4481b7ff9e6e067d90c6d20aa83",
		"version": "1.6.1",
		"vendor": {
			"name": "The Apache Software Foundation",
			"version":"1.6.1"
		}
	}

Configurable settings are encapsulated in test/fixtures/couchdb.json and can be overridden with environment variables or command parameters.

Run the associated unit test with the following command:

	node test/unit/couchdb-fabriccop-test.js

### Contributor Check-list
The following check-list is for code contributors to make sure their changesets are compliant to the coding standards and avoid time wasted in rejected changesets:

Check the coding styles, run the following command and make sure no ESLint violations are present:
* `gulp`

Run the full unit test bucket and make sure 100% are passing.  Because v1.0 is still in active development, all tests may not pass. You can run each individually to isolate the failure(s):
* `gulp test`

The gulp test command above also generates code coverage reports. Your new code should be accompanied with unit tests and pass 80% lines coverage or above.

### HFC objects and reference documentation
For a high-level design specificiation for Fabric SDKs of all languages, visit [this google doc](https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing) (Work-In-Progress).

HFC is written in CommonJS modules and is object-oriented. It's comprised of the following modules.

* index.js is the top-level module that provides the main API surface into the HFC package. It's mainly a collection of convenient methods.
* The main top-level class is **Chain**. It is the client's view of a blockchain network. HFC allows you to interact with multiple chains. Each chain object can be configured with a different member service or share a common member service, depending on how the target blockchain networks are set up. Each chain object has a _KeyValueStore_ to store private keys and certificates for authenticated users. Each chain object can be configured with an ordering service, to which HFC connects to send transactions for consensus and committing to the ledger.
* The **KeyValueStore** is a very simple interface which HFC uses to store and retrieve all persistent data. This data includes private keys, so it is very important to keep this storage secure. The default implementation is a simple file-based version found in the _FileKeyValueStore_ class.
* The **MemberServices** interface provides security and identity related features such as user registration and enrollment, transaction certificate issuance. The Hyperledger Fabric has a built-in implementation that issues _ECerts_ (enrollment certificates) and _TCerts_ (transaction certificates). ECerts are for enrollment identity and TCerts are for transactions.
* The **Member** class represents an end user who transacts on the chain. From the Member class, you can _register_ and _enroll_ users. This class interacts with the MemberServices object. You can also deploy, query, and invoke chaincode from this class, which interact with the _Peer_ objects.
* The **EventHub** class encapsulates the interaction with the network peers' event streams.

### Pluggability
HFC defines the following abstract classes for application developers to supply extensions or alternative implementations. For each abstract class, a built-in implementation is included with the ability to load alternative implementations via designated environment variables:

1. To replace FileKeyValueStore with a different implementation, such as one that saves data to a database, specify "KEY_VALUE_STORE" and provide the full require() path to an alternative implementation of the api.KeyValueStore abstract class.

2. The cryptography suite used by the default implementation uses ECDSA for asymmetric keys cryptography, AES for encryption and SHA2/3 for secure hashes. A different suite can be plugged in with "CRYPTO_SUITE" environment variable specifying full require() path to the alternative implementation of the api.CrytoSuite abstract class.

3. If the user application uses an alternative membership service than the one provided by the component `fabric-ca`, the client code will likely need to use an alternative client to `fabric-ca-client` to interact with that membership service.
