# Data Design Kit

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

## Release Process

To release a new version of the Data Upload Design Kit, resulting in the package being available at <https://www.npmjs.com/package/@register-dynamics/importer>,  you should follow these steps:

### Update the package version

Update the version field in the [package.json](./lib/importer/package.json).
The major/minor/patch version should be updated as appropriate.  You should submit this change as a pull request.

Make sure you also run the demo prototype so that it discovers the new local version, otherwise the demo will update in the next PR and you may end up with several developers trying to submit the same change. You can do this using `npm i` to update the prototype's dependency on the package.

### Merge into main

Following the usual process, and once approval is obtained for the change, merge the pull request into the `main` branch. This will result in the usual CI steps and followed by a deployment of the demo prototype.

### Create a new github release

Create a new github release, making sure to:

* Create a new tag, beginning with v matching the current version, e.g. v1.2.0
* Ensure the desciption contains a high level overview of the changes and a changelog based on the commits in this release (github will help with this stage).
* Publish the release.

The final stage of this process will result in github actions publishing this package to npm.

