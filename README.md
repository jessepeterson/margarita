Margarita (Margasado Docker Edition)
=========

Margasado is a docker image of Margarita with optional SAML auth, combined via docker-compose in this repo with Groob's macadmins/reposado docker image. The goal of this repository is to make spinning up a new margarita + reposado instance extremely simple, while also delivering SAML auth.

[reposado](http://github.com/wdas/reposado)

[margarita upstream](http://github.com/jessepeterson/margarita)

![Screenshot](https://i.imgur.com/5dwSxwS.png)

Quick Start
------------

1. Clone this repository, enter directory
2. `docker build . -t margarita`
3. Edit the docker-compose.yml file (*required for SAML auth*):

  a. `/path/to/your/saml/:/app/saml` Path to SAML certs and configuration. See [SAML Configuration](#SAML Configuration).

  b. `/path/to/your/reposado/metadata/:/reposado/metadata/` & `/path/to/your/reposado/metadata/:/reposado/metadata/`:

  If you have preexisting volumes or host paths with this data, and would prefer not to rebuild, enter those paths here. Otherwise, leave commented.

4. `SAML_AUTH_ENABLED=True docker-compose up -d`
5. Debugging your SAML auth? `DEBUG=True SAML_AUTH_ENABLED=True docker-compose up`



SAML Configuration
----------
* Reference: https://github.com/onelogin/python-saml#how-it-works
* Obtain a certificate from your IDP (eg: Okta, OneLogin).
* Fill required fields in saml/settings.json
    - You will get the values from your IDP.
* The following the hardcoded acs path for margarita (your IDP will ask for this):
    - `<domain.where.margarita.lives>/saml2/acs`
* Place your private cert in $SAML_PATH/certs/
* Start the app with SAML_AUTH_ENABLED=True
