## Hyperledger Fabric Client SDK for Node.js

The Hyperledger Fabric Client SDK (HFC) provides a powerful and easy to use API to interact with a Hyperledger Fabric blockchain.

As an application developer, to learn about how to install and use the Node.js SDK, please visit the [fabric documentation](http://hyperledger-fabric.readthedocs.io/en/latest/Setup/NodeSDK-setup).

The following section targets a current or future contributor to this project itself. It describes the main object hierarchy, plus HFC's pluggability and extensibility design.

#### HFC objects and reference documentation
For a high-level design specificiation for Fabric SDKs of all languages, visit [this google doc](https://docs.google.com/document/d/1R5RtIBMW9fZpli37E5Li5_Q9ve3BnQ4q3gWmGZj6Sv4/edit?usp=sharing) (Work-In-Progress).

HFC is written in CommonJS modules and is object-oriented. The api.js file provides the abstract definitions of all pluggable APIs. All the main API classes extend from the abstract classes defined here.

* The main top-level class is *Chain*. It is the client's view of a blockchain network. HFC allows you to interact with multiple chains. The chain objects can be configured with different member services or share a common member service, depending on how the target blockchain networks are set up. Each chain object has a *KeyValueStore* to store private keys and certificates for authenticated users. For each chain, you add one or more *Peer* objects which represents the endpoint(s) to which HFC connects to transact on the chain.

* The *KeyValueStore is a very simple interface which HFC uses to store and retrieve all persistent data. This data includes private keys, so it is very important to keep this storage secure. The default implementation is a simple file-based version found in the *FileKeyValueStore class.

* The *MemberServices* interface provides security and identity related features such as privacy, unlinkability, and confidentiality. This implementation issues *ECerts* (enrollment certificates) and *TCerts* (transaction certificates). ECerts are for enrollment identity and TCerts are for transactions.

* The *Member* class most often represents an end user who transacts on the chain, but it may also represent other types of members such as peers. From the Member class, you can *register* and *enroll* members or users. This interacts with the MemberServices object. You can also deploy, query, and invoke chaincode directly, which interacts with the Peer objects. The implementation for deploy, query and invoke simply creates a temporary TransactionContext object and delegates the work to it.

* The *TransactionContext* class implements the bulk of the deploy, invoke, and query logic. It interacts with MemberServices to get a TCert to perform these operations. Note that there is a one-to-one relationship between TCert and TransactionContext; in other words, a single TransactionContext will always use the same TCert. If you want to issue multiple transactions with the same TCert, then you can get a TransactionContext object from a Member object directly and issue multiple deploy, invoke, or query operations on it. Note however that if you do this, these transactions are linkable, which means someone could tell that they came from the same user, though not know which user. For this reason, you will typically just call deploy, invoke, and query on the User or Member object.

#### Pluggability
All HFC classes are designed to be extensible, and a number of classes are easily pluggable out-of-box using an environment variable:

1. To replace FileKeyValueStore with a different implementation, such as one that saves data to a database, specify "KEY_VALUE_STORE" and provide the full require() path to an alternative implementation of the api.KeyValueStore abstract class.

2. (To be done) The cryptography suite used by the default implementation uses ECDSA for asymmetric keys and SHA2/3 for secure hashes. A different suite can be plugged in with "CRYPTO_SUITE" environment variable specifying full require() path to the alternative implementation of the api.CrytoSuite abstract class.

3. (To be done) Pluggable member service which is used to register and enroll members. Member services enables hyperledger to be a permissioned blockchain, providing security services such as anonymity, unlinkability of transactions, and confidentiality
