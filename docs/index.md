
The Hyperledger Fabric SDK for Node.js provides a powerful API to interact with a Hyperledger Fabric blockchain. The SDK is designed to be used in the Node.js JavaScript runtime.

### Overview
Hyperledger Fabric is the operating system of an enterprise-strength permissioned blockchain network. For a high-level overview of the fabric, visit [http://hyperledger-fabric.readthedocs.io/en/latest/](http://hyperledger-fabric.readthedocs.io/en/latest/).

Applications can be developed to interact with the blockchain network on behalf of the users. APIs are available to:
* invoke transactions by calling the chaincode
* receive events based on new blocks added to the ledger

### How Different Components of the Fabric Work Together
The [Transaction Flow](http://hyperledger-fabric.readthedocs.io/en/latest/txflow.html) document provides an excellent description of the application/SDK, peers, and orderers working together to process transactions and producing blocks.

Security on the Fabric is enforced with digital signatures. All requests made to the fabric must be signed by users with appropriate enrollment certificates. For a user's enrollment certificate to be considered valid on the Fabric, it must be signed by a trusted Certificate Authority (CA). Fabric supports any standard CAs. In addition, Fabric provides a CA server. See this [overview](http://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html#overview).

### Features of the SDK for Node.js
The Hyperledger Fabric SDK for Node.js is designed in an Object-Oriented programming style. Its modular construction enables application developers to plug in alternative implementations of  crypto suites and handling endorsements.

The SDK's list of features include:
* [**fabric-network**]{@link module:fabric-network} (the recommended API for):
  * [Submitting transactions]{@link module:fabric-network.Transaction} to a smart contract.
  * [Querying]{@link module:fabric-network.Transaction#evaluate} a smart contract for the latest application state.


* **fabric-common**:
  * submitting a transaction
  * query a chaincode for the latest application state
  * monitoring events:
    * connect to a peer's event stream
    * listen on block events
    * listen on transactions events and find out if the transaction was successfully committed to the ledger or marked invalid
    * listen on custom events produced by chaincodes
  * hierarchical configuration settings with multiple layers of overrides: files, environment variable, program arguments, in-memory settings
  * logging utility with a built-in logger (winston) and can be overriden with a number of popular loggers including log4js and bunyan
  * pluggable interface describe the cryptographic operations required for successful interactions with the Fabric. Two implementations are provided out of box:
    * [Software-based ECDSA]{@link CryptoSuite_ECDSA_AES}
    * [PKCS#11-compliant ECDSA]{@link CryptoSuite_PKCS11}


* **fabric-ca-client**:
  * [register]{@link FabricCAServices#register} a new user
  * [enroll]{@link FabricCAServices#enroll} a user to obtain the enrollment certificate signed by the Fabric CA
  * [revoke]{@link FabricCAServices#revoke} an existing user by enrollment ID or revoke a specific certificate
  * [customizable persistence store]{@link FabricCAServices}

### API Reference
The SDK is made up of modules that can be accessed through the navigation menu **Modules**:
* [**fabric-network**]{@link module:fabric-network}: Provides high level APIs for client applications to submit transactions and evaluate queries for a smart contract (chaincode).
* **api**: Pluggable APIs for application developers to supply alternative implementations of key interfaces used by the SDK. For each interface there are built-in default implementations.
* **fabric-common**: Provides APIs to interact with the core components of a Hyperledger Fabric network, namely the peers, orderers and event streams.
* **fabric-ca-client**: Provides APIs to interact with the optional component, fabric-ca, that contains services for membership management.

### Compatibility

The following tables show versions of Fabric, Node and other dependencies that are explicitly tested and that are supported for use with version 2.0 of the Fabric SDK for Node.

|     | Tested | Supported |
| --- | ------ | --------- |
| **Fabric** | 2.0 | 2.0.x |
| **Node** | 12 | 10.13+, 12.13+ |
| **Platform** | Ubuntu 18.04 | |


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
