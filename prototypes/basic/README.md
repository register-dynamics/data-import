# Basic Prototype

This basic prototype exists for development purposes, and to run playwright tests against the implementation.

## Setting up tests

playwright requires specific browser instances to be installed, and these can be installed with

```
npx playwright install
```

## Running tests

You can run the UI tests with

```
npm test
```

To test a specific file, you can use a partial filename after --, such as

```
npm test -- tribble
```