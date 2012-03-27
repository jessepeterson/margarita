Margarita
=========

Margarita is a web front-end to [reposado](http://github.com/wdas/reposado) the Apple Software Update replication and catalog management tool. While the command line administration tools work great for folks who are comfortable in that environment it may not be so for others.

Margarita attempts to be an easy to use and quick interface to list or de-list update products in branch catalogs per the usual reposado catalog management concepts.

Requirements
------------

Margarita is based on reposado and [Flask](http://flask.pocoo.org/) - a Python web framework. Some of these need to be installed for Margarita to work correctly.

**reposado**

See the [reposado](http://github.com/wdas/reposado) project for how to install and prepare it. It needs to be setup and configured with at least Apple's catalogs synced.

__Note__: Reposado may either be installed via setup.py/setuptools or simply run from the code files (either by download/extracting the files or by cloning the repository, etc.). Running from the code files is the documented way to run reposado. It is important to know in which way reposado is installed as Margarita needs to reference the location of the reposado library files. See below on installation for details on setting up. Thanks to timsutton on issue #1 for pointing this out.

**Flask**

    easy_install flask

Or

    pip install flask

If you prefer to install into a Python virtualenv, that works as well.

**JSON (for Python installations older than 2.6)**

Note also that Margarita uses the json library for it's Ajax queries. If running an older version of Python (say, version 2.5 on a stock Mac OS X 10.5 computer), then one will also have to install simplejson:

    easy_install simplejson

Installation
------------

1. Get Margarita source into a directory. Clone the repository or download and extract the files.
2. Change directory into this location.
3. If reposado is running from code per the documented installation instructions (and not installed into site-packages via easy_install/setup.py) then one needs to create a symlink to the reposadolib directory in order for Margarita to find the reposado.
4. Create a symlink to the reposado configuration file. On a Mac OS X default system with reposado installed to the system root the preference file is in /usr/local/bin, but may be where reposado is executing from. This is due the the fact that the reposado libraries reference the config file from the executing script's directory.

Create symlinks:

    cd /path/to/margaraita-install

    # optional depending on reposado installation
    ln -s /path/to/reposado-git-clone/code/reposadolib .

    ln -s /usr/local/bin/preferences.plist .


Usage
-----

Once the requirements and installation are taken care of one may simply launch the margarita.py:

    python margarita.py

**Note:** Margarita must have permission to the reposado repository in order to effect any changes. This may mean you need to run margarita as a different user:

    sudo -u _www python margarita.py

This will launch a Flask web server hosting the project. Visit the web page at the listened address, by default the host's IP address on port 8089. To change those defaults:

    python margarita.py -p 5000 -b 192.168.1.2 -d

Which would listen on port 5000, bind to IP 192.168.1.2 (by default it listens on all interfaces and IP addresses), and enable debug mode.

Automatic Startup
-----------------

**launchd**

Margarita can be started automatically as part of launchd. Included is a launchd.plist file (originally supllied by stazeii in issue #2 - thanks!). It may need to be modified to fit your environment, installation locations, user specifications, etc.

1. Copy plist file to ```/Library/LaunchDaemons/```
2. Modify the plist to specify installation directory (namely the second item of the ProgramArguments key) and any other locations or modifications.
3. Start up the plist file ```sudo launchctl load -w /Library/LaunchDaemons/com.github.jessepeterson.margarita.plist```
