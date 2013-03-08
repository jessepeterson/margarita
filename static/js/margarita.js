/* Models */

var Branches = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'branches'
});

var Products = Backbone.Collection.extend({
	model: Backbone.Model,
	url: 'products',

	initialize: function() {
		this.bind('reset', this.fetchBranches);
	},

	fetchBranches: function() {
		console.log('Products: ' + this.length.toString());

		var this_products = this;

		$.ajax({ url: 'branches', dataType: 'json',	success: function(branches) {

			console.log('Branches: ' + branches.length.toString());

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
			});

			this_products.trigger("branchesLoaded");
		}});
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
	template: "#queuedChangesBtnViewTpl"
});

var ToggleHideCommonButtonView = Backbone.Marionette.ItemView.extend({
	tagName: 'a',
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
});

var UpdatesTableView = Backbone.Marionette.CompositeView.extend({
	tagName: 'table',
	className: 'table table-striped',
	template: '#update-table',
	itemView: UpdateView,
	initialize: function() {
		this.options.filterCriteria.bind('change', this.render, this);
	},
	appendHtml: function(collectionView, itemView) {
		if (this.options.filterCriteria.get('hideCommon') == false || (this.options.filterCriteria.get('hideCommon') == true && itemView.model.get('depr') == true)) {
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

	MargaritaApp.navbarRegion.show(navbar);

	// XXX: maybe defer until updates loaded (to prevent modifications)?
	navbar.queuedChangesButton.show(new QueuedChangesButtonView());
	navbar.toggleHideCommonButton.show(new ToggleHideCommonButtonView({model: filterCriteria}));

	MargaritaApp.updates.show(new ProgressBarView());

	var products = new Products();

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
