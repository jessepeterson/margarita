var branches = {}
var branchct = 0;
var listing_queue = {"listing": {}, "delisting": {}};
var hideCommonlyListed = true;

function queue_count() {
    var totalCt = 0;
    
    for (var i in  listing_queue['listing']) {
	totalCt += listing_queue['listing'][i].length;
    }

    for (var i in  listing_queue['delisting']) {
	totalCt += listing_queue['delisting'][i].length;
    }

    return totalCt;
}

function reset_queue() {
    listing_queue = {"listing": {}, "delisting": {}};
    update_queue_items();
}

function update_queue_items()
{
    var totalCt = queue_count();

    $("span#queueCount").html(totalCt);

    if (totalCt > 0) {
	$("span#queueCount").attr('class', 'badge badge-info');
    } else {
	$("span#queueCount").attr('class', 'badge badge-inverse');
    }
}

function delete_branch(branchname) {
    $.post("/delete_branch/" + branchname, function() {
	    refresh_updates_table();
    }, 'json');
}

function add_all(branchname) {
    $.post("/add_all/" + branchname, function() {
	    refresh_updates_table();
    }, 'json');
}


function branch_header_cell(branchname) {
	var t = '<th class="branchcolumn">';

	t += '<div class="btn-group">';
	t += '<button class="btn dropdown-toggle" data-toggle="dropdown" href="#">';
	t += branchname + ' branch <span class="caret"></span>';
	t += '</button>';
	t += '<ul class="dropdown-menu">';
	t += '<li><a href="#" onclick="add_all(' + "'" + branchname + "'" + ');"><i class="icon icon-plus"></i> Add all products</a></li>';
	t += '<li class="divider"></li>';
	t += '<li><a style="color:#c00;" href="#" onclick="delete_branch(' + "'" + branchname + "'" + ');"><i class="icon icon-remove"></i> Delete branch</a></li>';
	t += '</ul>';
	t += '</div>';

	t += '</th>';
	
	return t;
}

function refresh_updates_table() {

    reset_queue();

    // remove existing data rows
    $("#swupdates").empty();

    // retrive list of branches
    $.post("/list_branches", function(data) {
	branches = data['result'];

	// remove existing branch table columns
	$("th.branchcolumn").remove();

	// loop through branches and create columns
	var text = '<th class="branchcolumn">Apple branch</th>'; // branch_header_cell('direct');
	$.each(branches, function(branch) {
	    text += branch_header_cell(branch);
	});
	$("#swupdatecols").append(text);

	// javascript seems to not have a standard way to count
	// dictionaries, so do it ahead of time
	branchct = 0;
	for (var k in branches)
	    branchct++;

	// we can refresh the rows now
	refresh_updates_rows();
    }, 'json');
    
}

function hover_unlisted(e, inout) {
    if (inout == 'in' && $(e).hasClass('queued')) {
	$("span", e).html('Dequeue listing');
	$("i", e).attr("class", "icon-minus icon-white");
    } else if (inout == 'in') {
	$("span", e).html('Queue listing');
	$("i", e).attr("class", "icon-plus");
    } else if (inout == 'out' && $(e).hasClass('queued')) {
	$("span", e).html('Listing queued');
	$("i", e).attr("class", "icon-plus icon-white");
    } else if (inout == 'out') {
	$("span", e).html('Unlisted');
	$("i", e).attr("class", "icon-remove");
    }
}

function hover_listed(e, inout) {
    if (inout == 'in' && $(e).hasClass('queued')) {
	$("span", e).html('Dequeue delisting');
	$("i", e).attr("class", "icon-minus icon-white");
    } else if (inout == 'in') {
	$("span", e).html('Queue delisting');
	$("i", e).attr("class", "icon-minus icon-white");
    } else if (inout == 'out' && $(e).hasClass('queued')) {
	$("span", e).html('Delisting queued');
	$("i", e).attr("class", "icon-minus icon-white");
    } else if (inout == 'out') {
	$("span", e).html('Listed');
	$("i", e).attr("class", "icon-ok icon-white");
    }
}

function toggle_queue_listing(e, prodid, branch) {

    if ($(e).hasClass('listed')) {
	var listing = 'delisting';
    } else {
	var listing = 'listing';
    }

    if (branch in listing_queue[listing]) {
	// branch exists, let's toggle the prodid

	var idx = listing_queue[listing][branch].indexOf(prodid);
	if (idx != -1 ) {
	    listing_queue[listing][branch].splice(idx, 1);

	    $(e).removeClass('queued');

	    if (listing == 'listing') {
		$(e).removeClass('btn-info');
		hover_unlisted(e, 'in');
	    } else {
		$(e).removeClass('btn-info');
		$(e).addClass('btn-success');
		hover_listed(e, 'in');
	    }
	} else {
	    listing_queue[listing][branch].push(prodid);

	    $(e).addClass('queued');
	    if (listing == 'listing') {
		$(e).addClass('btn-info');
		hover_unlisted(e, 'in');
	    } else {
		$(e).removeClass('btn-success');
		$(e).addClass('btn-info');
		hover_listed(e, 'in');
	    }
	}

    } else {
	// branch does not exist, create it with initial prodid
	listing_queue[listing][branch] = [prodid];

	$(e).addClass('queued');
	if (listing == 'listing') {
	    $(e).addClass('btn-info');
	    hover_unlisted(e, 'in');
	} else {
	    $(e).removeClass('btn-success');
	    $(e).addClass('btn-info');
	    hover_listed(e, 'in');
	}
    }

    update_queue_items();
}

function refresh_updates_rows() {
    // existing rows should not exist

    $.post("/products", function(products) {

	var allrowtext = '';

	// loop through products and create rows
	$.each(products['result'], function(row, product) {

	    var unlistedProducts = false;
	    
	    var text = '<tr><td>';

	    // main informational columns
	    text += product['title'];

	    if (product['depr'] == true) {
	        text += ' <span class="label label-warning">Deprecated</span>';
	    }

	    text += '</td><td>' +
		product['version'] + '</td><td>' +
		product['PostDate'] + '</td>';

	    /* create the disabled indicator for the 'raw' catalogs
	     * this is just for show as we cannot unlist raw catalog
	     * updates.
	     */
	    if (product['depr'] == true) {
	    text += '<td><button disabled class="btn btn-mini disabled">' +
		'<i class="icon-remove icon-white"></i> Unlisted</button></td>';
	    } else {
	    text += '<td><button disabled class="btn btn-mini btn-primary disabled">' +
		'<i class="icon-ok icon-white"></i> Listed</button></td>';
	    }

	    // loop through branches
	    $.each(branches, function(branch) {
		text += '<td>' +
		    '<button class="btn btn-mini ';

		// search for prodid in catalog product index
		if (branches[branch].indexOf(product['id']) != -1) {
		    text += 'listed btn-success" onClick="toggle_queue_listing(this,' + "'" +
			product['id'] + "','" + 
			branch + "'" + ');"' +
			'><i class="icon-ok icon-white"></i> <span>Listed</span></button>';
			'</td>';
		} else {
		    unlistedProducts = true;
		    text += 'unlisted" onClick="toggle_queue_listing(this,' + "'" +
			product['id'] + "','" + 
			branch + "'" + ');"' +
			'><i class="icon-remove"></i> <span>Unlisted</span></button>';
			'</td>';
		}
		
	    });

	    text += '</td></tr>';
	    
	    // hide commonly listed items to save space
	    if (unlistedProducts || (hideCommonlyListed == false) || (product['depr'] == true)) {
		allrowtext += text;
	    }
	});
	$("#swupdates").append(allrowtext);

	// assign hover events for the new buttons
	$('button.unlisted').hover(
	    function(e) { hover_unlisted(this, 'in'); },
	    function(e) { hover_unlisted(this, 'out'); }
	);
	$('button.listed').hover(
	    function(e) { hover_listed(this, 'in'); },
	    function(e) { hover_listed(this, 'out'); }
	);

    }, 'json');
}

function submit_queue() {
    if ($.active == 0 && queue_count() > 0) {
		var cached_queue = listing_queue;
		reset_queue();
		$.post("/process_queue", {'queue': JSON.stringify(cached_queue)}, function(data) {
		    refresh_updates_table();
		});
    }
}
