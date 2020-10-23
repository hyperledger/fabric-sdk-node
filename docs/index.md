
The Hyperledger Fabric SDK for Node.js provides a powerful API to interact with a Hyperledger Fabric blockchain. The SDK is designed to be used in the Node.js JavaScript runtime.


### Overview

Hyperledger Fabric is the operating system of an enterprise-strength permissioned blockchain network. For a high-level overview of the fabric, visit [http://hyperledger-fabric.readthedocs.io/en/latest/](http://hyperledger-fabric.readthedocs.io/en/latest/).

Applications can be developed to interact with the blockchain network on behalf of the users. APIs are available to:
* invoke transactions by calling the chaincode.
* receive events based on new blocks added to the ledger.


### How different components of Hyperledger Fabric work together

The [Transaction Flow](http://hyperledger-fabric.readthedocs.io/en/latest/txflow.html) document provides an excellent description of the application/SDK, peers, and orderers working together to process transactions and produce blocks.

Security is enforced with digital signatures. All requests must be signed by users with appropriate enrollment certificates. For a user's enrollment certificate to be considered valid, it must be signed by a trusted Certificate Authority (CA). Fabric supports any standard CAs. In addition, Fabric provides a CA server. See this [overview](http://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html#overview).


### Features of the SDK for Node.js

The Hyperledger Fabric SDK for Node.js is designed in an Object-Oriented programming style. Its modular construction enables application developers to plug in alternative implementations for handling transaction commit events, transaction evaluation (query), and other behaviors.

The SDK is composed of several modules:
* [**fabric-network**]{@link module:fabric-network}: Provides high level APIs for client applications to interact with smart contracts (chaincode), and is the recommended API for building client applications.
* **fabric-ca-client**: Provides APIs to interact with the optional Certificate Authority component, fabric-ca, that contains services for membership management.
* **fabric-common**: A low-level API, used to implement _fabric-network_ capability, that provides APIs to interact with the core components of a Hyperledger Fabric network, namely the peers, orderers and event streams.


### Compatibility

The following tables show versions of Fabric, Node and other dependencies that are explicitly tested and that are supported for use with version 2.x of the Fabric SDK for Node.

|     | Tested | Supported |
| --- | ------ | --------- |
| **Fabric** | 2.2 | 2.2 |
| **Node** | 10, 12, 14 | 10 LTS, 12 LTS, 14 LTS |
| **Platform** | Ubuntu 20.04 | |


### API reference

This section provides more detail on the capabilities provided by each of the modules that make up the Hyperledger Fabric SDK for Node.js.

#### fabric-network

This is the recommended API for client application to use for:
  * [Submitting transactions]{@link module:fabric-network.Contract} to a smart contract.
  * [Querying]{@link module:fabric-network.Contract#evaluateTransaction} a smart contract for the latest application state.
  * Listening for and replay of both [smart contract events]{@link module:fabric-network.Contract} and [block events]{@link module:fabric-network.Network}, with easy access to related transaction information.

 #### fabric-ca-client

Provides the following capabilities for interacting with the Certificate Authority to manage user identities:
  * [register]{@link FabricCAServices#register} a new user.
  * [enroll]{@link FabricCAServices#enroll} a user to obtain the enrollment certificate signed by the Fabric CA.
  * [revoke]{@link FabricCAServices#revoke} an existing user by enrollment ID or revoke a specific certificate
  * [customizable persistence store]{@link FabricCAServices}.

 #### fabric-common

 Provides the following capabilities and for use in the implementation of the _fabric-network_ API:
  * Submitting transactions.
  * querying chaincode for the latest application state.
  * monitoring events:
    * connect to a peer's event stream
    * listen on block events
    * listen on transactions events and find out if the transaction was successfully committed to the ledger or marked invalid.
    * listen on custom events produced by chaincodes.
  * hierarchical configuration settings with multiple layers of overrides: files, environment variable, program arguments, in-memory settings
  * logging utility with a built-in logger (winston) and can be overridden with a number of popular loggers including log4js and bunyan
  * pluggable interface describe the cryptographic operations required for successful interactions with the Fabric. Two implementations are provided out of box:
    * [Software-based ECDSA]{@link CryptoSuite_ECDSA_AES}
    * [PKCS#11-compliant ECDSA]{@link CryptoSuite_PKCS11}


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
