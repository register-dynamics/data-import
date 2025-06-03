# Usage collector

The usage collector script fetches the data logs from users who have granted us permission to collect data about their usage of the plugin.

The data logs have the following format and no further information.

```
[01/Jan/2025:06:00:00 +0000] /dudk-metrics/747046f1-2e9f-430d-9173-82f1529f5358/initialised 404
[01/Jan/2025:06:00:00 +0000] /dudk-metrics/747046f1-2e9f-430d-9173-82f1529f5358/configured 404
```

After running this script, the user will be presented with a summary of the findings

## Install

Make sure you have python 3.x installed and then run the following command to install the script's dependencies.

```
make install
```

## Config

Set the following variables so that the system knows which
server to connect to.

* `DUDK_SERVER_USER` - Username on the server
* `DUDK_SERVER_KEY` - The path to a private key providing access to `DUDK_SERVER_HOST`
* `DUDK_SERVER_HOST` - The hostname of the server collecting stats
* `DUDK_SERVER_PORT` - The port that SSHD is listening on
* `DUDK_SERVER_PATH` - The remote path to the log file

## Usage

You can run the script with the default options using `make fetch`. This will show something similar to the following:

```
aw stats have been written to stats.csv

Event stats
===========

{'initialised': 3, 'configured': 1}

Client stats
============

{ '747046f1-2e9f-430d-9173-82f1529f5358': { 'total': 4,
                                            'initialised': 3,
                                            'configured': 1},
'BBCF5537-A5F3-4A56-9DC4-3A3D3207DCA9': { 'total': 2,
                                            'initialised': 1,
                                            'configured': 1}}
```

To fine tune the results, you will need to run the script directly. To do this you can run with the following command:

```
python dudk_stats
```

To apply filters to the results you can specify them with a command such as:

```
python dudk_stats start="01-01-2025" end="10-12-2025" events="initialised,configured"
```

For these filters, the values needs to be:

|Key|Value|Description|
|--|--|--|
|start|A date|The start date (inclusive) for log items to include. Items before this date will be ignored.|
|end|A date|The end date (inclusive) for log items to include. Items after this date will be ignored|
|events|A comma separated list|The events to include in the results, from the list of supported events: 'initialised' and 'configured'
|client|A UUID|A single client ID to include in the results


