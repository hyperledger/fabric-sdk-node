This tutorial describes potentially breaking changes between the the v1.4 and v2.1 Hyperledger Fabric SDK for Node.js that may affect the migration of existing blockchain client applications.

## Overview

The key differences between the API and behavior provided by the v1.4 and v2.1 Hyperledger Fabric SDK for Node.js are:
* **fabric-client** module has been removed.
* **Wallets**, used for storing identity implementation, have been redesigned.
* API and behavior of **event listeners** has been redesigned.

The sections below provide more detail on these changes and recommended approaches for application migration.

## fabric-client

The v1.4 SDK provides both the **fabric-network** and **fabric-client** APIs for developing client applications that interact with Smart Contracts deployed to a Hyperledger Fabric blockchain. **fabric-network** implements the Fabric programming model, which provides consistency across programming languages, and is the preferred API. **fabric-client** is a lower-level, legacy API that is significantly more complex to use. In v2.1, **fabric-network** is the only recommended API for developing client applications.

Client applications developed using v1.4 **fabric-client** may continue to work with a v2.x Fabric but will not be able to exploit new v2.0 capabilities. It is recommended to refactor applications to use v2.1 **fabric-network**.

Client applications developed using v1.4 **fabric-network** should be able to use v2.1 **fabric-network** with only minimal changes, described in other sections of this document.

Note that the SDK no longer aims to provide administrative and management capability. The {@link https://hyperledger-fabric.readthedocs.io/en/release-2.0/command_ref.html|command-line interface} should be used for these operations.

## Wallets

The client API and usage of wallets remains broadly similar with the following key differences that require changes as part of client application migration:
* Default wallet types are obtained using static factory functions on the {@link module:fabric-network.Wallets|Wallets} class rather than by directly creating instances of implementation classes.
* Functions to {@link module:fabric-network.Wallet#put|put}, {@link module:fabric-network.Wallet#get|get}, {@link module:fabric-network.Wallet#remove|remove} and {@link module:fabric-network.Wallet#list|list} wallet identities are renamed for consistency across different language SDKs.
* The persistent data format used to store wallet identities is redesigned. Identity information must be extracted from v1.4 wallets and added to new v2.1 wallets for use with the v2.1 SDK.

A thorough description of the wallet API and usage is provided in the [wallet tutorial]{@tutorial wallet}.

The {@link https://www.npmjs.com/package/fabric-wallet-migration|fabric-wallet-migration} npm package can be used to:
* Present a v1.4 file system wallet directly as a v2.1 wallet.
* Easily migrate identities from a v1.4 file system wallet to any v2.1 wallet type.

## Event listeners

The event listening API has been redesigned and simplified in the v2.1 SDK. Block and contract event listeners are notified of events in block order and without duplication. Listener callback functions are now _async_ to enable them to perform blocking operations (such as I/O) asynchronously while still maintaining event ordering.

Client applications making use of event listening will need to re-implement event listeners to use the new API.

For more details and code examples, refer to:
* {@link module:fabric-network.Network#addBlockListener|Network.addBlockListener()}
* {@link module:fabric-network.Contract#addContractListener|Contract.addContractListener()}

Commit event listening is intended for use only by implementers of custom transaction event handlers. Refer to the [transaction commit event handler tutorial]{@tutorial transaction-commit-events} for more information and sample code.
