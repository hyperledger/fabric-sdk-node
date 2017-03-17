# Hyperledger Fabric SDK for Node.js

The Hyperledger Fabric SDK for Node.js provides a powerful API to interact with a Hyperledger Fabric v1.0 blockchain. The SDK is designed to be used in the Node.js JavaScript runtime.

#### Overview
Hyperledger Fabric is the operating system of an enterprise-strength permissioned blockchain network. For a high-level overview of the fabric, visit [http://hyperledger-fabric.readthedocs.io/en/latest/](http://hyperledger-fabric.readthedocs.io/en/latest/).

Applications can be developed to interact with the blockchain network on behalf of the users. APIs are available to:
* create [channels](http://hyperledger-fabric.readthedocs.io/en/latest/fabric_model.html#privacy-through-channels)
* ask [peer nodes](http://hyperledger-fabric.readthedocs.io/en/latest/arch-deep-dive.html#peer) to join the channel
* install [chaincodes](http://hyperledger-fabric.readthedocs.io/en/latest/fabric_model.html#chaincode) in peers
* instantiate chaincodes in a channel
* invoke transactions by calling the chaincode
* query the [ledger](http://hyperledger-fabric.readthedocs.io/en/latest/fabric_model.html#ledger-features) for transactions or blocks

{@tutorial app-overview} provides a topological overview of applications and a blockchain.

#### API Reference
The SDK is made up of 3 top-level modules that can be accessed through the navigation menu **Modules**:
* **api**: pluggable APIs for application developers to supply alternative implementations of key interfaces used by the SDK. For each interface there are built-in default implementations.
* **fabric-client**: this module provides APIs to interact with the core components of a Hypreledger Fabric-based blockchain network, namely the peers, orderers and event streams.
* **fabric-ca-client**: this module provides APIs to interact with the optional component, fabric-ca, that contains services for membership management.