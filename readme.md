# Cookie Parser helper

This project can store Cookies from external Websites in a yaml file.

## Requirements

* Node.js
* Puppeteer
* Prompt
* js-yaml
* Inquirer

## Installation

```shell
npm install
```

## Usage

To run the script, type this in your console:

```shell
node cc -u <URL> -i <INPUT FILE> -o <OUTPUT PATH> -d <DEPTH> -m <MODE> 
```

The output will contain the yaml file path all the cookie info has been written to.