from flask import Flask
from flask import jsonify, render_template, redirect
from flask import request, Response
app = Flask(__name__)

import os, sys
try:
	import json
except ImportError:
	# couldn't find json, try simplejson library
	import simplejson as json
import getopt
from operator import itemgetter

from reposadolib import reposadocommon

def json_response(r):
	'''Glue for wrapping raw JSON responses'''
	return Response(json.dumps(r), status=200, mimetype='application/json')

@app.route('/')
def index():
    return render_template('margarita.html')

@app.route('/branches', methods=['GET'])
def list_branches():
	'''Returns catalog branch names and associated updates'''
	catalog_branches = reposadocommon.getCatalogBranches()

	# reorganize the updates into an array of branches
	branches = []
	for branch in catalog_branches.keys():
		branches.append({'name': branch, 'products': catalog_branches[branch]})

	return json_response(branches)

def get_description_content(html):
	if len(html) == 0:
		return None

	# in the interest of (attempted) speed, try to avoid regexps
	lwrhtml = html.lower()

	celem = 'p'
	startloc = lwrhtml.find('<' + celem + '>')

	if startloc == -1:
		startloc = lwrhtml.find('<' + celem + ' ')

	if startloc == -1:
		celem = 'body'
		startloc = lwrhtml.find('<' + celem)

		if startloc != -1:
			startloc += 6 # length of <body>

	if startloc == -1:
		# no <p> nor <body> tags. bail.
		return None

	endloc = lwrhtml.rfind('</' + celem + '>')

	if endloc == -1:
		endloc = len(html)
	elif celem != 'body':
		# if the element is a body tag, then don't include it.
		# DOM parsing will just ignore it anyway
		endloc += len(celem) + 3

	return html[startloc:endloc]

@app.route('/products', methods=['GET'])
def products():
	products = reposadocommon.getProductInfo()
	prodlist = []
	for prodid in products.keys():
		if 'title' in products[prodid] and 'version' in products[prodid] and 'PostDate' in products[prodid]:
			prodlist.append({
				'title': products[prodid]['title'],
				'version': products[prodid]['version'],
				'PostDate': products[prodid]['PostDate'].strftime('%Y-%m-%d'),
				'description': get_description_content(products[prodid]['description']),
				'id': prodid,
				'depr': len(products[prodid].get('AppleCatalogs', [])) < 1,
				})
		else:
			print 'Invalid update!'

	sprodlist = sorted(prodlist, key=itemgetter('PostDate'), reverse=True)

	return json_response(sprodlist)

@app.route('/new_branch/<branchname>', methods=['POST'])
def new_branch(branchname):
    catalog_branches = reposadocommon.getCatalogBranches()
    if branchname in catalog_branches:
        reposadocommon.print_stderr('Branch %s already exists!', branchname)
        abort(401)
    catalog_branches[branchname] = []
    reposadocommon.writeCatalogBranches(catalog_branches)
    
    return jsonify(result='success')

@app.route('/delete_branch/<branchname>', methods=['POST'])
def delete_branch(branchname):
    catalog_branches = reposadocommon.getCatalogBranches()
    if not branchname in catalog_branches:
        reposadocommon.print_stderr('Branch %s does not exist!', branchname)
        return

    del catalog_branches[branchname]

    # this is not in the common library, so we have to duplicate code
    # from repoutil
    for catalog_URL in reposadocommon.pref('AppleCatalogURLs'):
        localcatalogpath = reposadocommon.getLocalPathNameFromURL(catalog_URL)
        # now strip the '.sucatalog' bit from the name
        if localcatalogpath.endswith('.sucatalog'):
            localcatalogpath = localcatalogpath[0:-10]
        branchcatalogpath = localcatalogpath + '_' + branchname + '.sucatalog'
        if os.path.exists(branchcatalogpath):
            reposadocommon.print_stdout(
                'Removing %s', os.path.basename(branchcatalogpath))
            os.remove(branchcatalogpath)

    reposadocommon.writeCatalogBranches(catalog_branches)
    
    return jsonify(result=True);

@app.route('/add_all/<branchname>', methods=['POST'])
def add_all(branchname):
	products = reposadocommon.getProductInfo()
	catalog_branches = reposadocommon.getCatalogBranches()
	
	catalog_branches[branchname] = products.keys()

	reposadocommon.writeCatalogBranches(catalog_branches)
	reposadocommon.writeAllBranchCatalogs()
	
	return jsonify(result=True)


@app.route('/process_queue', methods=['POST'])
def process_queue():
	catalog_branches = reposadocommon.getCatalogBranches()

	for change in request.json:
		prodId = change['productId']
		branch = change['branch']

		if branch not in catalog_branches.keys():
			print 'No such catalog'
			continue
		
		if change['listed']:
			# if this change /was/ listed, then unlist it
			if prodId in catalog_branches[branch]:
				print 'Removing product %s from branch %s' % (prodId, branch, )
				catalog_branches[branch].remove(prodId)
		else:
			# if this change /was not/ listed, then list it
			if prodId not in catalog_branches[branch]:
				print 'Adding product %s to branch %s' % (prodId, branch, )
				catalog_branches[branch].append(prodId)

	print 'Writing catalogs'
	reposadocommon.writeCatalogBranches(catalog_branches)
	reposadocommon.writeAllBranchCatalogs()

	return jsonify(result=True)

def main():
	optlist, args = getopt.getopt(sys.argv[1:], 'db:p:')

	flaskargs = {}
	flaskargs['host'] = '0.0.0.0'
	flaskargs['port'] = 8089
	
	for o, a in optlist:
		if o == '-d':
			flaskargs['debug'] = True
		elif o == '-b':
			flaskargs['host'] = a
		elif o == '-p':
			flaskargs['port'] = int(a)
	
	app.run(**flaskargs)

if __name__ == '__main__':
    main()
