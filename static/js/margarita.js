/* Models */

var ProductChanges = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'process_queue',

	save: function() {
		var that = this;

		$.ajax({
			type: 'POST',
			url: this.url,
			data: this.toJSON(),
			dataType: 'json',
			success: function() {
			}
		});
	}
});

var Branches = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'branches'
});

var Products = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'products',

	initialize: function(models, productChanges) {
		this.productChanges = productChanges || new ProductChanges();

		this.bind('reset', this.fetchBranches);
	},

	fetchBranches: function() {
		console.log('Products: ' + this.length.toString());

		var this_products = this;

		$.ajax({ url: 'branches', dataType: 'json',	success: function(branches) {
			var allbranches = []

			for (var bIdx = 0; bIdx < branches.length; bIdx++)
				allbranches.push(branches[bIdx].name);

			this_products.branches = allbranches;

			console.log('Branches: ' + branches.length.toString() + ' (' + allbranches.toString() + ')');

			this_products.each(function (prod) {
				var prodid = prod.get('id');
				var prodbranches = [];

				for (var bIdx = 0; bIdx < branches.length; bIdx++) {
					if (_.indexOf(branches[bIdx].products, prodid) != -1)
						prodbranches.push(branches[bIdx].name);
					else
						/* TODO: this is bad hack to distinguish table
						   columns in the templates. would be better to
						   be able to access the parent collection from
						   the individual models to see how many branches
						   we have. */
						prodbranches.push(null);
				}

				prod.set('branches', prodbranches);
				prod.set('allbranches', allbranches);
			});

			this_products.trigger("branchesLoaded");
		}});
	},

	parse: function(response) {
		_.each(response, function (r) {
			r.queued = false;
		});
		return response;
	}
});

var FilterCriteria = Backbone.Model.extend({
	defaults: {
		hideCommon: true
	}
});

/* Views */

var QueuedChangesButtonView = Backbone.Marionette.ItemView.extend({
	tagName: 'a',
	attributes: { 'href': '#' },
	template: "#queuedChangesBtnViewTpl",
	events: {
		'click': 'applyQueuedChanges'
	},
	initialize: function() {
		this.collection.bind('add', this.render, this);
		this.collection.bind('remove', this.render, this);
	},
	applyQueuedChanges: function()
	{
		if (this.collection.length < 1) {
			alert('No products in the queue yet. Make some changes first.');
			return;
		}

		this.collection.save();
	}
});

var ToggleHideCommonButtonView = Backbone.Marionette.ItemView.extend({
	tagName: 'a',
	attributes: { 'href': '#' },
	events: { 'click': 'click' },
	template: '#toggleHideCommonBtnViewTpl',
	initialize: function() {
		this.model.bind('change', this.render, this);
	},
	click: function() {
		// toggle the hideCommon flag
		this.model.set('hideCommon', !this.model.get('hideCommon'));
	},
});

var NavbarLayout = Backbone.Marionette.Layout.extend({
	template: "#navbarLayout",

	regions: {
		queuedChangesButton:    "#queuedChangesButtonViewRegion",
		toggleHideCommonButton: "#toggleHideCommonButtonViewRegion"
	}
});

var UpdateView = Backbone.Marionette.ItemView.extend({
	tagName: 'tr',
	template: '#update-row',
	events: {
		'click .button-listed':   'productBranchButtonClick',
		'click .button-unlisted': 'productBranchButtonClick'
	},
	initialize: function() {
		this.model.bind('change', this.render, this);
	},
	productBranchButtonClick: function (ev) {
		var productId = this.model.get('id')
		var branchName = $(ev.currentTarget).data('branch');
		var prodChanges = this.model.collection.productChanges;
		var changeId = productId + branchName;
		var queued = this.model.get('queued');

		if ($(ev.currentTarget).data('listed') == "yes")
			var listed = true;
		else
			var listed = false;

		if (queued) {
			prodChanges.remove({id: changeId});
			this.model.set('queued', false);
		} else {
			prodChanges.add({
				id: changeId,
				listed: listed,
				productId: productId,
				branch: branchName
			});
			this.model.set('queued', true);
		}
	},
});

var UpdatesTableView = Backbone.Marionette.CompositeView.extend({
	tagName: 'table',
	className: 'table table-striped',
	template: '#update-table',
	itemView: UpdateView,
	initialize: function() {
		this.options.filterCriteria.bind('change', this.render, this);
	},
	serializeData: function() {
		// TODO: this is entirely dependent on Products::fetchBranches at the moment
		var data = { branches: this.collection.branches };

		return data;
	},
	appendHtml: function(collectionView, itemView) {
		// yuck.. this function smells bad. perhaps refactor with _.reduce

		var show = false;
		var depr = itemView.model.get('depr');

		if (this.options.filterCriteria.get('hideCommon') == false || depr == true) {
			// always show the update if not hiding common updates OR
			// if the update is deprecated
			show = true;
		} else {
			var itemBranches = itemView.model.get('branches');

			/* loop through list of branches. try to show those updates
			   that are not commonly listed. that is: show all updates that
			   are not listed in at least one branch, including apple's
			   "branch" (e.g. not deprecated) */
			var bTrack = (depr == false);
			for (var bIdx=0; bIdx < itemBranches.length; bIdx++) {
				if (bTrack != (itemBranches[bIdx] != null)) {
					show = true;
					break;
				}
				bTrack = itemBranches[bIdx] != null;
			}
		}

		if (show == true) {
			collectionView.$("tbody").append(itemView.el);
		}
	}
});

var ProgressBarView = Backbone.Marionette.ItemView.extend({
	// className: 'span4 offset4', // smaller progress bar
	template: '#span12-progress-bar',
});

/* Application */

MargaritaApp = new Backbone.Marionette.Application();

MargaritaApp.addRegions({
	navbarRegion: "#navbarRegion",
	updates: '#updates',
});

MargaritaApp.addInitializer(function () {
	console.log('Starting Margarita Marionette webapp');

	var filterCriteria = new FilterCriteria();
	var navbar = new NavbarLayout();

	var pc = new ProductChanges();

	MargaritaApp.navbarRegion.show(navbar);

	// XXX: maybe defer until updates loaded (to prevent modifications)?
	navbar.queuedChangesButton.show(new QueuedChangesButtonView({collection: pc}));
	navbar.toggleHideCommonButton.show(new ToggleHideCommonButtonView({model: filterCriteria}));

	MargaritaApp.updates.show(new ProgressBarView());

	var products = new Products([], pc);

	products.bind('branchesLoaded', function () {
		var updateTableView = new UpdatesTableView({
			collection: products,
			filterCriteria: filterCriteria,
		});
		MargaritaApp.updates.show(updateTableView);
	});

	products.fetch();

});

/* Init */

$(document).ready(function () {
	MargaritaApp.start();
});
