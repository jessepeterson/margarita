Margarita
=========

Margarita is web front-end to [reposado](http://github.com/wdas/reposado) the Apple Software Update replication and catalog management tool. While the command line administration tools work great for folks who are comfortable in that environment it may not be so for others.

Margarita attempts to be an easy to use and quick interface to list or de-list update products in branch catalogs per the usual reposado catalog management concepts.

Requirements
------------

Margarita is based on reposado and [Flask](http://flask.pocoo.org/). Some of these need to be installed for Margarita to work correctly.

**reposado**

See the [reposado](http://github.com/wdas/reposado) project for how to install and prepare it. It needs to be setup and configured with at least Apple's catalogs synced.

**Flask**

    easy_install flask

Or

    pip install flask

If you prefer to install into a Python virtualenv, that works as well.

Installation
------------

1. Get Margarita source into a directory. Clone the repository or download and extract the files.
2. Change directory into this location.
3. Create a symlink to the reposado configuration file. On a Mac OS X system this would look like this:


    ln -s /usr/local/bin/preferences.plist .

This is due the the fact that the reposado libraries reference the config file from the executing script's directory.

Usage
-----

Once the requirements and installation are taken care of one may simply launch the margarita.py:

    python margarita.py

This will launch a Flask web server hosting the project. Visit the web page at the listened address, by default the host's IP address on port 8089. To change those defaults:

    python margarita.py -p 5000 -b 192.168.1.2 -d

Which would listen on port 5000, bind to IP 192.168.1.2, and enable debug mode.