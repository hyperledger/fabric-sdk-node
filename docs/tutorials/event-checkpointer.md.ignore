# Event Checkpointing

This tutorial describes the approaches that can be selected by users of the fabric-network module for replaying missed events emitted by peers.

## Overview

Events are emitted by peers when blocks are committed. Two types of events support checkpointing:

1. Contract events (also known as chaincode events) - Defined in transactions to be emitted. E.g. an event emitted when a commercial paper is sold
2. Block Events - Emitted when a block is committed

In the case of an application crashing and events being missed, applications may still want to execute the event callback for the event it missed. Peers in a Fabric network support event replay, and to support this, the fabric-network module supports checkpointing strategies that track the last block and transactions in that block, that have been seen by the client.

### Disclaimer

Checkpointing in its current form has not been tested to deal with all recovery scenarios, so it should be used alongside existing recovery infrastructure. {@link module:fabric-network~FileSystemCheckpointer} is designed for Proof of Technology projects, so we strongly suggest implementing your own checkpointer using the {@link module:fabric-network~BaseCheckpointer} interface.

### Notes

`Block Number` = `Block Height - 1`
When using checkpointing:

- The listener will only catch up on events if the `startBlock` is less than the current `Block Number`
- If the latest block in the checkpointer is block `n` the `startBlock` will be `n + 1` (e.g. for checkpoint `blockNumber=1`,`startBlock=2`)

## Checkpointers

The `BaseCheckpoint` class is an interface that is to be used by all Checkpoint classes. fabric-network has one default class, {@link module:fabric-network~FileSystemCheckpointer} that is exported as a factory in the {@link module:fabric-network~CheckpointFactories}. The `FILE_SYSTEM_CHECKPOINTER` is the default checkpointer.

A checkpoint factory is a function that returns an instance with `BaseCheckpointer` as a parent class. These classes implement the `async save(channelName, listenerName)` and `async load()` functions.

`BaseCheckpointer.save()` is called after the async callback function given to the event listener has finished processing.

### Custom Checkpointer

Configuring a custom checkpointer requires two components to be created:

1. The Checkpointer class
2. The Factory

```javascript
const fs = require('fs-extra');
const path = require('path');
const { Gateway } = require('fabric-network');

class FileSystemCheckpointer extends BaseCheckpointer {
    constructor(channelName, listenerName, fsOptions) {
        super(channelName, listenerName);
        this.basePath = path.resolve(fsOptions.basePath);
        this.channelName = channelName;
        this.listenerName = listenerName;
    }

    /**
     * Initializes the checkpointer directory structure 
     */
    async _initialize() {
        const cpPath = this._getCheckpointFileName()
    }

    /**
     * Constructs the checkpoint files name
     */
    _getCheckpointFileName() {
        let filePath = path.join(this._basePath, this._channelName);
        if (this._chaincodeId) {
            filePath = path.join(filePath, this._chaincodeId);
        }
        return path.join(filePath, this._listenerName);
    }

    async save(transactionId, blockNumber) { 
        const cpPath = this._getCheckpointFileName()
        if (!(await fs.exists(cpPath))) {
            await this._initialize();
        }
        const latestCheckpoint = await this.load();
        if (Number(latestCheckpoint.blockNumber) === Number(blockNumber)) {
            const transactionIds = latestCheckpoint.transactionIds;
            latestCheckpoint.transactionIds = transactionIds;
        } else {
            latestCheckpoint.blockNumber = blockNumber;
            latestCheckpoint.transactionIds = [transactionIds];
        }
        await fs.writeFile(cppPath, JSON.stringify(latestCheckpoint));
    }

    async load() {
        const cpPath = this._getCheckpointFileName(this._chaincodeId);
        if (!(await fs.exists(cpPath))) {
            await this._initialize();
        }
        const chkptBuffer = await fs.readFile(cpFile);
        let checkpoint = checkpointBuffer.toString('utf8');
        if (!checkpoint) {
            checkpoint = {};
        } else {
            checkpoint = JSON.parse(checkpoint);
        }
        return checkpoint;
    }
}

function File_SYSTEM_CHECKPOINTER_FACTORY(channelName, listenerName, options) {
    return new FileSystemCheckpointer(channelName, listenerName, options);
}

const gateway = new Gateway();
await gateway.connect({
    checkpointer: {
        factory: FILE_SYSTEM_CHECKPOINTER_FACTORY,
        options: {basePath: '/home/blockchain/checkpoints'} // These options will vary depending on the checkpointer implementation
});

```

In addition to `save()` and `load()` the `BaseCheckpointer` interface also has the `loadLatestCheckpoint()` function which, in the case that `load()` returns a list of checkpoints, will return the latest incomplete checkpoint (or whichever is most relevant for the specific implementation).

`Note:` When using the filesystem checkpointer, use absolute paths rather than relative paths.

When specifying a specific type of checkpointer for a listener, the `checkpointer` option in {@link module:fabric-network.Network~EventListenerOptions`}.

