from flask import Flask
from flask import jsonify, render_template, redirect
from flask import request
app = Flask(__name__)

import os, sys
import json
import getopt


from reposadolib import reposadocommon

@app.route('/')
def index():
    return render_template('margarita.html')

@app.route('/list_branches', methods=['POST'])
def list_branches():
    '''Returns catalog branch names'''
    catalog_branches = reposadocommon.getCatalogBranches()
    return jsonify(result=catalog_branches)

@app.route('/products', methods=['POST'])
def products():
    products = reposadocommon.getProductInfo()
    prodlist = []
    for prodid in products.keys():
	prodlist.append({
	    'title':    products[prodid]['title'],
	    'version':  products[prodid]['version'],
	    'PostDate': products[prodid]['PostDate'].strftime('%Y-%m-%d'),
	    'id':       prodid,
	    })
    
    from operator import itemgetter
    sprodlist = sorted(prodlist, key=itemgetter('PostDate'), reverse=True)

    return jsonify(result=sprodlist)

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
    queue = json.loads(request.form['queue'])

    catalog_branches = reposadocommon.getCatalogBranches()
    
    for cat in queue['listing']:
	if cat not in catalog_branches.keys():
	    print 'No such catalog'
	    continue
	    
	for prodid in queue['listing'][cat]:
	    if prodid not in catalog_branches[cat]:
		# TODO: check for actual prodid?
		print 'Adding product',prodid,'to cat',cat
		catalog_branches[cat].append(prodid)

    for cat in queue['delisting']:
	if cat not in catalog_branches.keys():
	    print 'No such catalog'
	    continue
	    
	for prodid in queue['delisting'][cat]:
	    if prodid in catalog_branches[cat]:
		print 'Removing product',prodid,'from cat',cat
		catalog_branches[cat].remove(prodid)

    reposadocommon.writeCatalogBranches(catalog_branches)
    reposadocommon.writeAllBranchCatalogs()

    
    return jsonify(result=True);

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
