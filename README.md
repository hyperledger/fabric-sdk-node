## Hyperledger Fabric Client SDK for Node.js

The Hyperledger Fabric Client SDK (HFC) provides a powerful and easy to use API to interact with a Hyperledger Fabric blockchain.

As an application developer, to learn about how to install and use the Node.js SDK, please visit the [fabric documentation](http://hyperledger-fabric.readthedocs.io/en/latest/Setup/NodeSDK-setup).

The following section targets a current or future contributor to this project itself. It describes the main object hierarchy, plus HFC's pluggability and extensibility design.

### Build and Test
To build and test, the following pre-requisites must be installed first:
* node runtime version 4.3 or later (which also installs the npm tool)
* gulp command
* docker (not required if you only want to run the headless tests with `npm test`, see below)

Clone the project and launch the following commands in the project root folder to install the dependencies and perform various tasks:
* `npm install` to install all dependencies
* `gulp doc` to generate API docs
* `npm test` to run the headless tests that do not require any additional set up

The following tests require setting up a local blockchain network as the target.
* Test user management with a member services. Start a member service instance using the _hyperledger/fabric-membersrvc_ docker image. Then run `node test/unit/ca-tests.js`
* Test transaction proposals. Start a peer instance using the _hyperledger/fabric-peer_ docker image. Then run `node test/unit/endorser-tests.js`
* Test sending endorsed transactions for consensus. Start a peer instance using the _hyperledger/fabric-orderer_ docker image. Then run `node test/unit/orderer-tests.js`

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

3. If the user application uses an alternative membership service than the one provided by Hyperledger Fabric, the client code will likely need to use an alternative client to interact with the membership service. Use the "MEMBER_SERVICE" environment variable to specify a full require() path to the alternative implementation.
