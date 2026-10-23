# Security Policy

## Supported versions

This project is in initial development; no production-ready releases are available yet.

## Reporting vulnerabilities

Please do not disclose vulnerabilities in public issues. Use GitHub's private vulnerability reporting feature when available, or contact the maintainer privately.

## Deployment

Never expose the application directly to the Internet without a trusted authenticating reverse proxy. Identity headers must be stripped from untrusted requests and set only by the trusted proxy. Do not enable the development authentication bypass in production.
