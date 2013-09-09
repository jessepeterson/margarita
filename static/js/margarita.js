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

	initialize: function(models, options) {
		if (typeof(options) == "object" && 'productChanges' in options)
			this.productChanges = options['productChanges'];
		else
			this.productChanges = new ProductChanges();

		this.bind('sync', this.fetchBranches);
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
	applyQueuedChanges: function(ev) {
		ev.preventDefault();

		if (this.collection.length < 1) {
			alert('No products in the change queue yet. Make some changes to a branch first.');
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
	click: function(ev) {
		ev.preventDefault();

		// toggle the hideCommon flag
		this.model.set('hideCommon', !this.model.get('hideCommon'));
	},
});

var SearchBoxView = Backbone.Marionette.ItemView.extend({
	template: '#vw-search',
	events: {
		'keypress input': 'keypress',
		'keyup input': 'keypress',
		'submit form': function(ev) { ev.preventDefault(); },
			// disable form submission (mostly to prevent using enter key)
	},
	keypress: function() {
		if (this.searchTimer)
			window.clearTimeout(this.searchTimer);

		that = this;

		this.searchTimer = window.setTimeout(function() {
			that.searchTimer = null;
			var filterText = that.$el.find('input').val();
			
			if (filterText)
				console.log('Filtering on "' + filterText + '"');
			else
				console.log('No text filtering');

			that.model.set('filterText', filterText);
		}, 200);
	},
});

var NavbarLayout = Backbone.Marionette.Layout.extend({
	template: "#navbarLayout",

	regions: {
		queuedChangesButton:    "#queuedChangesButtonViewRegion",
		toggleHideCommonButton: "#toggleHideCommonButtonViewRegion",
		searchBox: '#rgn-search',
	}
});

var UpdateDescriptionView = Backbone.Marionette.ItemView.extend({
	tagName: 'tr',
	template: '#vw-update-description',
})

var UpdateView = Backbone.Marionette.ItemView.extend({
	tagName: 'tr',
	template: '#update-row',
	events: {
		'click .button-listed':   'productBranchButtonClick',
		'click .button-unlisted': 'productBranchButtonClick',
		'click .info-toggle-button': 'toggleInfo',
		'click .info-toggle': 'toggleInfo',
	},
	initialize: function() {
		this.model.bind('change', this.render, this);
		this.showInfo = false;
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
	toggleInfo: function(ev) {
		this.showInfo = !this.showInfo;
		var updateTr = $(ev.currentTarget).closest('tr');
		var toggleBtn = $(updateTr).find('.info-toggle-button');

		if (!this.updView) {
			this.updView = new UpdateDescriptionView({model: this.model});
			this.updView.render();
		}

		if (this.showInfo) {
			toggleBtn.addClass('active');
			updateTr.after(this.updView.el);
		} else {
			toggleBtn.removeClass('active');
			updateTr.next().remove();
		}
	}
});

var UpdatesTableView = Backbone.Marionette.CompositeView.extend({
	tagName: 'table',
	className: 'table',
	template: '#update-table',
	itemView: UpdateView,
	events: {
		'click .addAllProductsMenuSel': 'addAllProducts',
		'click .deleteBranchMenuSel':   'deleteBranch',
		'click .duplicateAppleBranch':  'duplicateAppleBranch',
		'click .duplicateBranch':       'duplicateBranch',
	},
	initialize: function() {
		this.options.filterCriteria.bind('change', this.render, this);
	},
	serializeData: function() {
		// TODO: this is entirely dependent on Products::fetchBranches at the moment
		var data = { branches: this.collection.branches };

		return data;
	},
	appendHtml: function(collectionView, itemView) {
		var show = false;
		var depr = itemView.model.get('depr');

		if (this.options.filterCriteria.get('hideCommon') == false || depr == true) {
			// always show the update if not hiding common updates OR
			// if the update is deprecated
			show = true;
		} else {
			var prodBranches = itemView.model.get('branches');

			// this is a little hackish: create an array out of the
			// "listed" status of each branch, including the "deprecated"
			// status (on the Apple branch) as one of those statuses
			var listedArr = _.pluck(prodBranches, 'listed');
			listedArr.push(!depr);

			if (_.contains(listedArr, false) == true)
				// show if any branch is unlisted, including
				// being deprecated (not in "Apple" branch)
				show = true;
		}

		var filterText = this.options.filterCriteria.get('filterText');
		if (filterText) {
			var title = itemView.model.get('title');
			if (title.toLowerCase().indexOf(filterText.toLowerCase()) == -1)
				show = false;
		}

		if (show == true) {
			collectionView.$("tbody").append(itemView.el);
		}
	},
	addAllProducts: function (ev) {
		var branch = $(ev.currentTarget).data('branch');

		MargaritaApp.trigger("catalogsChanging");

		$.post('add_all/' + encodeURIComponent(branch), {}, function () {
			MargaritaApp.trigger("catalogsChanged");
		});
	},
	deleteBranch: function (ev) {
		var branch = $(ev.currentTarget).data('branch');

		if (!confirm('Are you sure you want to delete the branch "' +
		        branch + '"? Click OK to delete, Cancel otherwise.'))
			return;

		MargaritaApp.trigger("catalogsChanging");

		$.post('delete_branch/' + encodeURIComponent(branch), {}, function () {
			MargaritaApp.trigger("catalogsChanged");
		});
	},
	duplicateAppleBranch: function(ev) {
		var branch = $(ev.currentTarget).data('branch');

		if (!confirm('Duplicating will overwrite the branch "' + branch + 
		        '". Are you sure you want to do this? Click OK' + 
		        ' to duplicate the Apple direct branch, Cancel otherwise.'))
			return;

		console.log("duplicating apple direct into " + branch);

		MargaritaApp.trigger("catalogsChanging");

		$.post('dup_apple/' + encodeURIComponent(branch), {}, function () {
			MargaritaApp.trigger("catalogsChanged");
		});

	},
	duplicateBranch: function(ev) {
		var branch = $(ev.currentTarget).data('branch');
		var dupbranch = $(ev.currentTarget).data('dupbranch');

		if (!confirm('Duplicating will overwrite the branch "' + branch + 
		        '". Are you sure you want to do this? Click OK' + 
		        ' to duplicate "' + dupbranch + '", Cancel otherwise.'))
			return;

		console.log("duplicating " + dupbranch + " into " + branch);

		MargaritaApp.trigger("catalogsChanging");

		$.post('dup/' + encodeURIComponent(dupbranch) + '/' + encodeURIComponent(branch), {}, function () {
			MargaritaApp.trigger("catalogsChanged");
		});
	},
});

var ProgressBarView = Backbone.Marionette.ItemView.extend({
	// className: 'span4 offset4', // smaller progress bar
	template: '#span12-progress-bar',
});

var NewBranchFormView = Backbone.View.extend({
	events: {
		'click button': 'newBranch'
	},
	newBranch: function () {
		var newBranchInput = $('#branchname', this.el);

		MargaritaApp.trigger("catalogsChanging");

		// TODO: consider using an actual Backbone.Model instead
		// of a direct jQuery post method
		$.post('new_branch/' + encodeURIComponent(newBranchInput.val()), {}, function () {
			newBranchInput.val('');
			MargaritaApp.trigger("catalogsChanged");
		});
	}
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
	MargaritaApp.products = new Products([], {productChanges: MargaritaApp.productChanges});

	MargaritaApp.products.bind('branchesLoaded', function () {
		var updateTableView = new UpdatesTableView({
			collection: MargaritaApp.products,
			filterCriteria: MargaritaApp.filterCriteria,
		});
		MargaritaApp.updates.show(updateTableView);
	});

	navbar.queuedChangesButton.show(new QueuedChangesButtonView({collection: MargaritaApp.productChanges}));
	navbar.toggleHideCommonButton.show(new ToggleHideCommonButtonView({model: MargaritaApp.filterCriteria}));
	navbar.searchBox.show(new SearchBoxView({model: MargaritaApp.filterCriteria}));

	MargaritaApp.trigger('catalogsChanged');

	var newBranchFormView = new NewBranchFormView({el: $('#newbranch')});
});

/* Init */

$(document).ready(function () {
	MargaritaApp.start();
});
