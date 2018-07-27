#!/usr/bin/env python

import os, sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path = list(set([p for p in sys.path if p]))
from margarita.main import app

if __name__ == '__main__':
    app.run()
