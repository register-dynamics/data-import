
# Data Upload Design Kit

## Description

The Data Upload Design Kit makes it easier for users to upload data about many things
at once by uploading a file without the need for hard-coded Excel spreadsheets. Designed to work with the [GOV.UK Prototype Kit](https://prototype-kit.service.gov.uk/), it makes it easier for service designers and developers to test.

The kit achieves this by empowering the user to choose which sheet and data to use, and which columns to map to the required output data in an easy to use and configurable way. The kit currently supports the upload of:

* CSV files,
* Excel files (.xls, and .xlsx), and
* OpenDocument spreadsheets (.ods)

You can learn more about the problems that inspired this package at in our blog posts about our presentation at [Services Week 2025](https://services.blog.gov.uk/2025/01/30/get-involved-with-services-week-2025/)

* [Why services suck at spreadsheets](https://www.register-dynamics.co.uk/blog/why-services-suck-at-spreadsheets),
* [How to design better spreadsheet templates](https://www.register-dynamics.co.uk/blog/how-to-design-better-spreadsheet-templates).



## Install

To install the package, you should run the following command from the directory containing your gov.uk prototype. It will install and configure itself into your prototype.

```
npm install @register-dynamics/importer
```

## Help

Once you have installed the plugin, and launched your prototype with `npm run dev` you can find the most recent documentation about the plugin you have installed [within the prototype](http://127.0.0.1:3000/plugin-assets/%40register-dynamics%2Fimporter/assets/docs/). The documentation for the most recent released version is also [available online](https://data-importer.register-dynamics.co.uk/plugin-assets/%40register-dynamics%2Fimporter/assets/docs/).

## Contact us

To discuss this package, obtain help, or request features, please feel free to reach out to us by email via `hello [at] register-dynamics.co.uk`.
