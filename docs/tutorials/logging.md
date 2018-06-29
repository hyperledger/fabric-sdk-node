This tutorial illustrates how to use the Hyperledger Fabric Node.js client logging feature.

### Overview

Hyperledger Fabric Node.js client logging uses the Node.js 'winston' package.
The logging is initialized when the Node.js application first loads the Hyperledger
Fabric package. All Hyperledger Fabric client objects will use the same settings (Peer, Orderer, ChannelEventHub).
```
const Client = require('fabric-client');
// the logging is now set
```
There are four levels of logging
- info
- warn
- error
- debug

By default `info`, `warn`, and `error` log entries will be sent to the 'console'.
`debug` will not be recorded.

### How to change logging

The Hyperledger Fabric client's logging is controlled by the configuration setting
`hfc-logging` and by the environment setting `HFC_LOGGING`.

- setting the logging settings in the `default.json` config file with an entry:
```
"hfc-logging": "{'debug':'console', 'info':'console'}"
```

- using an environment setting will override the configuration setting:
```
export HFC_LOGGING='{"debug":"console","info":"console"}'
```

The logging may use a file to write entries by specifying a file location as the
level value.
```
export HFC_LOGGING='{"debug":"/temp/debug.log","info":"console"}'
```

### Using the logging from application

When there is a need to log entries from the application code along with the
Hyperledger Fabric client entries, use the following to get access to the same
logger.

as of 1.2
```
const logger = Client.getLogger('APPLICATION');
```

prior to 1.2
```
const sdkUtils = require('fabric-client/lib/utils.js');
const logger = sdkUtils.getLogger('APPLICATION');
```

To log
```
const log_info = 'Sometext';

logger.info('%s infotext', log_info);
// will log
// info: [APPLICATION]: Sometext infotext

logger.warn('%s warntext', log_info);
// will log
// warn: [APPLICATION]: Sometext warntext

logger.error('%s errortext', log_info);
// will log
// error: [APPLICATION]: Sometext errortext

logger.debug('%s debugtext', log_info);
// will log
// debug: [APPLICATION]: Sometext debugtext

```
