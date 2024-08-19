# data-import

This repository contains code to aid in the user testing of the data import process, composed of

* A library (lib/importer) providing functions to work with spreadsheets 

* A makefile providing an action to create a new prototype

* A skeleton prototype (prototypes/basic) used to implement and test the functionality in lib/importer.

* A doc folder which documents the current workflow

## Requirements

This project requires nodejs version 20 or higher.

## Setup

After cloning this repository, you should perform the following steps to ensure the local libraries dependencies are installed (when referenced from prototypes).

```shell
$ cd lib/importer
$ npm install
```

This step should be repeated each time a new dependency is added to lib/importer.  Once the lib/importer package is published this step will no longer be required.

Once the dependencies are installed, you can create a new prototype to work on the importer library with the following command where [abc] should be the name of the new prototype created in ./prototypes

```
make prototype NAME=[abc]
```

Once you have performed this step you can start the new prototype with:

```
$ cd prototypes/[abc]
$ npm run dev
```

Changes to the prototype files in `prototypes/[abc]` and `lib/importer` will force the prototype to reload.