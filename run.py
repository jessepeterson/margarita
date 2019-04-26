#!/usr/bin/env python

import os, sys
import margarita

def main():
    if os.environ.get('MARGARITA_ENV') == 'DEVELOPMENT' or \
    'runserver' in sys.argv:
        from flask_script import Manager, Server
        manager = Manager(margarita.app)
        manager.add_command(
        'runserver',
        Server(
            host='0.0.0.0',
            port=int(os.environ.get('MARGARITA_PORT', 80)))
            )
        manager.run()
    else:
        margarita.app.run()

if __name__ == '__main__':
    main()
