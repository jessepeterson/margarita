/* Application */

var MargaritaApp = new Backbone.Marionette.Application();

/* Models */

var ProductChanges = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'process_queue',

	save: function(successCallback) {
		var that = this;
		var arglength = arguments.length;

		$.ajax({
			type: 'POST',
			url: this.url,
			data: JSON.stringify(this.toJSON()),
			dataType: 'json',
			contentType: 'application/json; charset=UTF-8',
			success: function() {
				if (arglength >= 1)
					successCallback(that);
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
			this_products.branches = _.pluck(branches, 'name');

			console.log('Branches: ' + branches.length.toString() +
			            ' (' + this_products.branches.toString() + ')');

			this_products.each(function (prod) {
				var prodId = prod.get('id');
				var prodBranches = [];

				_.each(branches, function (branch) {
					prodBranches.push({
						name: branch.name,
						listed: (_.indexOf(branch.products, prodId) != -1),
						queued: false,
					});
				});

				prod.set('branches', prodBranches);
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
		this.collection.bind('reset', this.render, this);
	},
	applyQueuedChanges: function()
	{
		if (this.collection.length < 1) {
			alert('No products in the queue yet. Make some changes first.');
			return;
		}

		MargaritaApp.trigger("catalogsChanging");

		this.collection.save(function() {
			MargaritaApp.trigger("catalogsChanged");
		});
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
		var prodChanges = this.model.collection.productChanges;

		// pull in a bunch of data to get our bearings.. seems like too much
		var productId = this.model.get('id')
		var branchName = $(ev.currentTarget).data('branch'); // which branch did we click on
		var prodBranches = this.model.get('branches');
		var branchArrPos = -1;
		var branch = _.find(prodBranches, function (b) { branchArrPos++; return b.name == branchName; });

		var changeId = branchName + productId;

		if (branch.queued) {
			prodBranches[branchArrPos].queued = false;
			prodChanges.remove({id: changeId});
		} else {
			prodBranches[branchArrPos].queued = true;
			prodChanges.add({
				id: changeId,
				branch: branch.name,
				listed: branch.listed,
				productId: productId
			});
		}

		// manually trigger events as we're modifying an array directly
		this.model.trigger('change');
		this.model.trigger('change:branches');
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

MargaritaApp.addRegions({
	navbarRegion: "#navbarRegion",
	updates: '#updates',
});

MargaritaApp.on("catalogsChanged", function (options) {
	MargaritaApp.productChanges.reset();
	MargaritaApp.products.fetch();
});

MargaritaApp.on("catalogsChanging", function (options) {
	MargaritaApp.updates.show(new ProgressBarView());
});

MargaritaApp.addInitializer(function () {
	var navbar = new NavbarLayout();
	MargaritaApp.navbarRegion.show(navbar);

	MargaritaApp.trigger('catalogsChanging');

	MargaritaApp.filterCriteria = new FilterCriteria();
	MargaritaApp.productChanges = new ProductChanges();
	MargaritaApp.products = new Products([], MargaritaApp.productChanges);

	MargaritaApp.products.bind('branchesLoaded', function () {
		var updateTableView = new UpdatesTableView({
			collection: MargaritaApp.products,
			filterCriteria: MargaritaApp.filterCriteria,
		});
		MargaritaApp.updates.show(updateTableView);
	});

	navbar.queuedChangesButton.show(new QueuedChangesButtonView({collection: MargaritaApp.productChanges}));
	navbar.toggleHideCommonButton.show(new ToggleHideCommonButtonView({model: MargaritaApp.filterCriteria}));

	MargaritaApp.trigger('catalogsChanged');
});

/* Init */

$(document).ready(function () {
	MargaritaApp.start();
});
