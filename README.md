Margarita
=========

Margarita is a web interface to [reposado](http://github.com/wdas/reposado) the Apple Software Update replication and catalog management tool. While the reposado command line administration tools work great for folks who are comfortable in that environment something a little more accesible might be desired.

Margarita attempts to be an easy to use and quick interface to list or delist update products in branch catalogs per the usual reposado catalog management concepts.

![Screenshot](https://i.imgur.com/5dwSxwS.png)

Requirements
------------

Margarita is based on reposado and [Flask](http://flask.pocoo.org/). Flask is a Python web framework. These need to be installed for Margarita to work correctly.

**reposado**

See the [reposado](http://github.com/wdas/reposado) project for how to install and configure it. It needs to be setup and configured with at least Apple's software update catalogs initially synced.

__Note__: Reposado may be installed either via setup.py/setuptools or simply run from the code files (either by downloading and extracting the files or by cloning the repository, etc.). Running from the code files is the documented way to run reposado. It is important to know in which way reposado is installed as Margarita needs to reference the location of the reposado library files which are located wherever reposado is installed. See below on installation for details on setup. Thanks to [timsutton](https://github.com/timsutton) on [issue #1](https://github.com/jessepeterson/margarita/issues/1) for clarifying this.

**Flask**

    easy_install flask

Or

    pip install flask

If you prefer to install into a Python [virtualenv](http://www.virtualenv.org/) that works as well.

**JSON (for Python installations older than 2.6)**

Note also that Margarita uses the simplejson/json Python modules for it's Ajax calls. If running an older version of Python (say, version 2.5 on a stock Mac OS X 10.5 computer), then one will also have to install simplejson:

    easy_install simplejson

Or

    pip install simplejson

Installation
------------

1. Get Margarita source into a directory. Clone the repository or download and extract the files.
2. Change directory into this location.
3. If reposado is running from code per the documented installation instructions (and not installed into site-packages via easy_install/setup.py) then one needs to create a symlink to the reposadolib directory in order for Margarita to find the reposado common libraries.
4. Create a symlink to the reposado configuration file. This is needed because the reposado libraries reference the config file from the executing script's directory. In Margarita's case this is Margarita's source directory.

Create symlinks:

    cd /path/to/margarita-install

    # may be optional depending on reposado installation
    ln -s /path/to/reposado-git-clone/code/reposadolib .

    ln -s /path/to/reposado-git-clone/code/preferences.plist .


Usage
-----

Once the requirements and installation are taken care of one may simply launch the margarita.py script:

    python margarita.py

This will launch a Flask web server hosting the project. Visit the web page at the listened address, by default the host's IP address on port 8089. To change those defaults:

    python margarita.py -p 5000 -b 192.168.1.2 -d

Which would listen on port 5000, bind to IP 192.168.1.2 (by default it listens on all interfaces and IP addresses), and enable debug mode.

**Note:** Margarita must have permission to the reposado repository in order to effect any changes. This may mean you need to run margarita as a different user:

    sudo -u _www python margarita.py

Automatic Startup
-----------------

**launchd**

Margarita can be started automatically as part of launchd. Included is a launchd.plist file (originally supplied by [stazeii](https://github.com/stazeii) in [issue #2](https://github.com/jessepeterson/margarita/issues/2) - thanks!). It may need to be modified to fit your environment, installation locations, user specifications, etc.

1. Copy plist file to ```/Library/LaunchDaemons/```
2. Modify the plist to specify installation directory (namely the second item of the ProgramArguments key) and any other locations or modifications.
3. Start up the plist file ```sudo launchctl load -w /Library/LaunchDaemons/com.github.jessepeterson.margarita.plist```

**Linux sysv startup**

- [Linux/Mac – Have Margarita Startup Automatically On Boot](http://rileyshott.wordpress.com/2012/09/17/linuxmac-have-margarita-startup-automatically-on-boot/)

Other web servers
-----------------

In the documentation above Margarita runs in the "development" web server built into Flask. This may not be ideal in some situations and there are some alternatives for running in a more "production"-ready webservers. Joe Wollard has an excellent article describing how to setup Margarita using mod_wsgi on Linux using WSGI:

- [Running Margarita in Apache](http://denisonmac.wordpress.com/2013/02/28/running-margarita-in-apache)

Setting up on Linux
-------------------

Helpful guides written by others:

- [Setting up Reposado and Margarita on Linux – Part 1](http://macadmincorner.com/setting-up-reposado-and-margarita-on-linux-part-1/)
- [Install Reposado with Margarita on CentOS / Red Hat Enterprise Linux](http://www.adminsys.ch/2012/09/23/install-reposado-margarita-centos-red-hat-enterprise-linux/)
