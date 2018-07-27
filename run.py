#!/usr/bin/env python

import os, sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path = list(set([p for p in sys.path if p]))

from margarita.main import app
from flask_script import Manager, Server

server = Server(host='127.0.0.1', port=8000) if os.environ.get('LOCAL_DEBUG') else \
    Server('0.0.0.0', port=80)
manager = Manager(app)
manager.add_command('runserver', server)

if __name__ == '__main__':
    manager.run()
