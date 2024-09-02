# Documentation

See [the documentation site](https://register-dynamics.github.io/data-import)
for the most up to date information.

## Building the documentation

The code in this folder generates static documentation from the files found in
[the Prototype Kit plugin](../lib/importer/assets/docs/).

To do this, we run the Prototype Kit with the plugin loaded, get the
documentation pages that we know exist, work out what assets they all need, and
then request those too. We do it this way because the documentation can reuse
assets from the Prototype Kit which are not necessarily even on disk (e.g. some
CSS is rendered from Sass) so the cleanest way to get those assets is just to
download them.

There are also some patches that remove the assumptions that the pages are being
loaded as part of a running Prototype Kit.

The documentation pages contain some HTML elements with `data-plugin-only`
attributes which are intended to only be seen when the page is running as part
of the Prototype Kit. This elements are removed as part of this build process.

This requires a copy of [`hq`](https://github.com/ludovicianul/hq/releases)
which allows us to both remove the plugin only elements and also get the assets
we need from HTML attributes.
