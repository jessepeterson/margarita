#!/usr/bin/env python

import os
from urlparse import urlparse
from flask import flash, request, session, abort, redirect
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils


class BaseAuth(object):
    """
    This class is a base authentcation wrapper for a flask application.

    It can be used as a factory, by passing is_admin and is_auth functions at
    instatiation. You may also inherit from the class (example below).

    You must create a child class to utilize current_user().

    :param app: A flask application
    :param is_admin: A callable to be used in controller code <instance.is_admin()>
    :param is_auth: A callable to be used in controller code <instance.is_authenticated()>
    """

    def __init__(self, app, is_admin=None, is_auth=None):
        self.app = app
        self._is_admin = is_admin if callable(is_admin) else (lambda: False)
        self._is_auth = is_auth if callable(is_auth) else (lambda: True)

    def is_authenticated(self, *args, **kwargs):
        return self._is_auth(*args, **kwargs)

    def current_user(self):
        return "no.user"

    def is_admin(self, *args, **kwargs):
        return self._is_admin(*args, **kwargs)

    def in_groups(self, *args, **kwargs):
        return True


class SamlAuth(BaseAuth):
    """
    This class wraps a flask application. It adds to the application two functions,
    one for before_request and one for the preconfigured ACS route.

    app.config['SAML_PATH'] must exist for auth to work.

    :param app: A flask application
    :param auth_path: The base path for saml2 auth routes (/acs, /sso, etc).
        The user is expected to prevent route conflicts while building their app.
    :param exemptions: A list containing paths or flask url_rules which may be
        accessed without authentication.
    """

    def __init__(self, app, auth_path="saml2", exemptions=None):
        self.app = app
        self.path = "/" + auth_path.strip("/")
        self.acs_path = self.path + "/acs/"
        self.exemptions = (
            list()
            if not exemptions
            else [e for e in exemptions if not e.startswith(self.path)]
        )
        self.exemptions.append(self.acs_path)
	self.exemptions.append(self.acs_path.strip("/"))
        self.exemptions = set(self.exemptions)
        self.init_app(app)

    def init_app(self, app):

        # Every request triggers this function. If the path is not the ACS path
        # or in exempt paths, and user is not authenticated, the okta saml flow begins.
        @app.before_request
        def auth_check():
            url_rule = str(request.url_rule)
            pathrule = set([request.path, url_rule])
            if self.authenticated() or pathrule & self.exemptions:
                return
            r = self._prepare_flask_request(request)
            auth = OneLogin_Saml2_Auth(r, custom_base_path=app.config["SAML_PATH"])
            return redirect(auth.login())

        # The hardcoded ACS route. This accepts an ACS statement from okta,
        # leverages OneLogin's saml2 lib to process it.
        @app.route(self.acs_path, methods=["POST"])
        def acs_route():
            if not self.authenticated():
		print 'begining authentication....'
                r = self._prepare_flask_request(request)
                # Here we shamelessly let someone else do the hard bit of
                # decrypting, parsing, and validating the ACS statement
                auth = OneLogin_Saml2_Auth(r, custom_base_path=app.config["SAML_PATH"])
                auth.process_response()
                errs = auth.get_errors()
                session["authd"] = True
                session["samlUserdata"] = auth.get_attributes()
                session["samlNameId"] = auth.get_nameid()
                session["samlSessionIndex"] = auth.get_session_index()
                if app.config["DEBUG"] and self.is_admin():
                    flash("username: {}".format(str(session["samlNameId"])))
                    flash("userdata: {}".format(str(session["samlUserdata"])))
                    flash("Authorized as {}".format(auth.get_nameid()))
                    for e in errs:
                        flash("Error: {}".format(str(e)))
                return redirect(auth.redirect_to(url="/"))
            return redirect("/")

    # This rewrites a flask request into an object OneLogin's saml2 auth object
    # can accept.
    def _prepare_flask_request(self, req):
        """
        :param req: A flask request object.

        :returns: A request object compatible with `OneLogin_Saml2_Auth`

        """
        # TODO If server is behind proxys or balancers use the HTTP_X_FORWARDED fields
        url_data = urlparse(req.url)
        return {
            "https": "on" if req.scheme == "https" else "off",
            "http_host": req.host,
            "server_port": url_data.port,
            "script_name": req.path,
            "get_data": req.args.copy(),
            "post_data": req.form.copy(),
            # Uncomment if using ADFS as IdP, https://github.com/onelogin/python-saml/pull/144
            "lowercase_urlencoding": True,
            "query_string": req.query_string,
        }

    # This checks if an existing session is already authenticated or not. It sucks.
    def authenticated(self):
        """
        :returns: `True` if the user is authorized, or `False` otherwise.
        """
        for key in ["samlUserdata", "samlNameId", "samlSessionIndex"]:
            if key not in session.keys():
                return False
        return True

    def current_user(self):
        return session.get("samlNameId", "").replace("@gusto.com", "")

    # This checks if current session is in the passed SAML group(s)
    def in_groups(self, groups):
        return bool(
            set(session.get("samlUserdata", dict()).get("groups", list())) & set(groups)
        )

    def is_admin(self):
        return self.in_groups(self.app.config.get("SAML_ADMIN_GROUPS", list()))
