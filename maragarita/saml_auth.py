# -*- coding: utf-8 -*-
'''
SAML logins
'''

import logging

import requests

import flask_login

# Need to expose these downstream
# pylint: disable=unused-import
from flask_login import (current_user,
                         logout_user,
                         login_required,
                         login_user)
# pylint: enable=unused-import

from flask import url_for, redirect, request

from saml2 import (
    BINDING_HTTP_POST,
    BINDING_HTTP_REDIRECT,
    entity,
)
from saml2.client import Saml2Client
from saml2.config import Config as Saml2Config

_log = logging.getLogger(__name__)


class SamlUser(models.User):

    def __init__(self, user):
        self.user = user

    def is_active(self):
        '''Required by flask_login'''
        return True

    def is_authenticated(self):
        '''Required by flask_login'''
        return True

    def is_anonymous(self):
        '''Required by flask_login'''
        return False

    def get_id(self):
        '''Returns the current user id as required by flask_login'''
        return self.user.get_id()

    def create_branch(self):
        '''Provides access to create a new branch'''
        return True

    def is_superuser(self):
        '''Access all the things'''
        return True


class AuthenticationError(Exception):
    pass


class SamlAuthBackend(object):

    def __init__(self):
        self.login_manager = flask_login.LoginManager()
        self.login_manager.login_view = 'margarita.login'
        self.flask_app = None
        self.ghe_oauth = None
        self.api_rev = None

    def ghe_api_route(self, leaf):
        if not self.api_rev:
            self.api_rev = get_config_param('api_rev')

        return '/'.join(['https:/',
                         self.ghe_host,
                         'api',
                         self.api_rev,
                         leaf.strip('/')])

    def init_app(self, flask_app):
        self.flask_app = flask_app

        self.login_manager.init_app(self.flask_app)
        self.login_manager.user_loader(self.load_user)
        self.flask_app.add_url_rule(get_config_param('saml_callback_route'),
                                    endpoint='saml_callback',
                                    view_func=self.saml_callback,
                                    methods=['POST'])

    def saml_client(self):
        acs_url = url_for(
            "saml_callback",
            _external=True)
        https_acs_url = url_for(
            "saml_callback",
            _external=True,
            _scheme='https')

        #   SAML metadata changes very rarely. On a production system,
        #   this data should be cached as approprate for your production system.
        rv = requests.get(get_config_param('metadata_url'))

        settings = {
            'metadata': {
                'inline': [rv.text],
                },
            'service': {
                'sp': {
                    'endpoints': {
                        'assertion_consumer_service': [
                            (acs_url, BINDING_HTTP_REDIRECT),
                            (acs_url, BINDING_HTTP_POST),
                            (https_acs_url, BINDING_HTTP_REDIRECT),
                            (https_acs_url, BINDING_HTTP_POST)
                        ],
                    },
                    # Don't verify that the incoming requests originate from us via
                    # the built-in cache for authn request ids in pysaml2
                    'allow_unsolicited': True,
                    # Don't sign authn requests, since signed requests only make
                    # sense in a situation where you control both the SP and IdP
                    'authn_requests_signed': False,
                    'logout_requests_signed': True,
                    'want_assertions_signed': True,
                    'want_response_signed': False,
                },
            },
        }
        spConfig = Saml2Config()
        spConfig.load(settings)
        spConfig.allow_unknown_attributes = True
        saml_client = Saml2Client(config=spConfig)
        return saml_client


    def login(self, request):
        _log.debug('Redirecting user to SAML login')

        reqid, info = self.saml_client().prepare_for_authenticate()

        redirect_url = None
        # Select the IdP URL to send the AuthN request to
        for key, value in info['headers']:
            if key is 'Location':
                redirect_url = value
        response = redirect(redirect_url, code=302)
        # NOTE:
        #   I realize I _technically_ don't need to set Cache-Control or Pragma:
        #     http://stackoverflow.com/a/5494469
        #   However, Section 3.2.3.2 of the SAML spec suggests they are set:
        #     http://docs.oasis-open.org/security/saml/v2.0/saml-bindings-2.0-os.pdf
        #   We set those headers here as a "belt and suspenders" approach,
        #   since enterprise environments don't always conform to RFCs
        response.headers['Cache-Control'] = 'no-cache, no-store'
        response.headers['Pragma'] = 'no-cache'
        return response

    def load_user(self, userid):
        if not userid or userid == 'None':
            return None

        session = settings.Session()
        user = session.query(models.User).filter(
            models.User.id == int(userid)).first()
        session.expunge_all()
        session.commit()
        session.close()
        return SamlUser(user)

    @csrf.exempt
    def saml_callback(self):
        _log.debug('Saml OAuth callback called')

        next_url = request.args.get('next') or url_for('index')

        authn_response = self.saml_client().parse_authn_request_response(request.form['SAMLResponse'], entity.BINDING_HTTP_POST)
        if authn_response is None:
            raise AuthenticationError(
                'Null response from SAML provider, denying access.'
            )

        authn_response.get_identity()
        user_info = authn_response.get_subject()
        email = user_info.text

        session = settings.Session()

        user = session.query(models.User).filter(
            models.User.username == email).first()

        if not user:
            user = models.User(
                username=email,
                email=email,
                is_superuser=False)

        session.merge(user)
        session.commit()
        login_user(SamlUser(user))
        session.commit()
        session.close()

        return redirect(next_url)

login_manager = SamlAuthBackend()

def login(self, request):
    return login_manager.login(request)
