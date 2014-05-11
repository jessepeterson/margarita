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

var Product = Backbone.Model.extend({
	defaults: { queued: [], },
});

var Products = Backbone.PageableCollection.extend({
	model: Product,
	url: 'products',
	state: {
		pageSize: 20,
	},
	mode: 'client',

	initialize: function(models, options) {
		this.productChanges = options.productChanges || new ProductChanges();

		this.bind("reset", this.changed, this);
	},

	parse: function(response) {
		// if we get a new set of data then we're invalidating any previous product changes
		this.productChanges.reset();

		this.allBranches = response.branches;

		return Backbone.PageableCollection.prototype.parse.apply(this, [response.products]);
	},

	changed: function() {
		// attempt to give "cleaner" access to some needed properties
		// rather than relying on this object being linked to the model all
		// the time (the collection reference seem to get messed up with
		// PageableCollection). do this after the "reset" event rather than in
		// the parse override as we need the models to exist to set the
		// prototype reference
		if (this.models.length > 0) {
			this.models[0].__proto__.allBranches = this.allBranches;
			this.models[0].__proto__.productChanges = this.productChanges;
		}
	},
});

var FilterCriteria = Backbone.Model.extend({
	defaults: {
		hideCommon: true
	},
	initialize: function(options) {
		this.products = options.products;
		this.products.bind('sync', this.updated, this);
		this.bind('change', this.doFilter, this);
	},
	updated: function() {
		console.log('FilterCriteria.updated: cloned fullCollection for filtering');
		this.shadowCollection = this.products.fullCollection.clone();

		// perform the first filter operation
		this.doFilter();
	},
	productFilter: function(product) {
		var show = false;

		if (this.get('hideCommon') == false || product.get('depr') == true) {
			// always show the update if not hiding common updates OR if the update is deprecated
			show = true;
		} else {
			var proddiff = _.difference(product.allBranches, product.get('branches'))

			// if we're not listed in all branches then show the update
			if (proddiff.length != 0)  show = true;
		}

		var filterText = this.get('filterText');
		if (filterText) {
			var title = product.get('title');
			if (title.toLowerCase().indexOf(filterText.toLowerCase()) == -1)
				show = false;
		}

		return show;
	},
	doFilter: function () {
		console.log('Performing search & filter: Hide common: ' + this.get('hideCommon').toString() + ', text: ' + this.get('filterText'));

		// change to first page of results (problems with small result sets if not done)
		this.products.getFirstPage({silent: true});

		var filterset = this.shadowCollection.filter(this.productFilter, this);

		console.log('Filter results: ' + filterset.length.toString());

		this.products.fullCollection.reset(filterset, {reindex: false});
	},
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

/* BackGrid Views */

var ProductCell = Backbone.Marionette.ItemView.extend({
	tagName: 'td',
	template: '#cell-product',
	className: "string-cell renderable",
	initialize: function (options) {
		// BackGrid cells require the column key
		_.extend(this, _.pick(options, ['column']));
	},
});

var AppleBranchCell = Backbone.Marionette.ItemView.extend({
	tagName: 'td',
	template: '#cell-apple-branch',
	className: "string-cell renderable",
	initialize: function (options) {
		// BackGrid cells require the column key
		_.extend(this, _.pick(options, ['column']));
	},
});

var BranchHeaderCell = Backbone.Marionette.ItemView.extend({
	tagName: 'th',
	template: '#cell-header-branch',
	className: 'branch-header renderable',
	events: {
		'click .addAllProductsMenuSel': 'addAllProducts',
		'click .deleteBranchMenuSel':   'deleteBranch',
		'click .duplicateAppleBranch':  'duplicateAppleBranch',
		'click .duplicateBranch':       'duplicateBranch',
	},
	initialize: function (options) {
		// BackGrid cells require the column key
		_.extend(this, _.pick(options, ['column']));
	},
	serializeData: function () {
		return {branch: this.branch, branches: this.branches};
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

var BranchCell = Backbone.Marionette.ItemView.extend({
	tagName: 'td',
	template: '#cell-branch',
	className: 'string-cell renderable',
	events: {
		'click button': 'listingButtonClick',
	},
	initialize: function (options) {
		// BackGrid cells require the column key
		_.extend(this, _.pick(options, ['column']));
		// save the branch name
		this.branch = this.column.get('name');

		this.model.bind('change:queued', this.render, this);
	},
	serializeData: function(){
		var data = this.model.toJSON();
		data.cellBranch = this.branch;
		return data;
	},
	listingButtonClick: function (ev) {
		ev.preventDefault();

		// retrive the instance of productChanges from our model prototype
		var prodChanges = this.model.productChanges;

		if (!prodChanges)
			console.warn('no productChanges');

		var prodId = this.model.get('id');
		var prodBranches = this.model.get('branches');
		var branchName = this.branch;
		var changeId = branchName + prodId;

		if (_.contains(this.model.get('queued'), branchName)) {
			prodChanges.remove({id: changeId});
			this.model.set('queued', _.without(this.model.get('queued'), branchName));
		} else {
			prodChanges.add({
				id: changeId,
				branch: branchName,
				listed: _.indexOf(prodBranches, branchName) > -1,
				productId: prodId,
			});
			this.model.set('queued', _.union(this.model.get('queued'), [branchName]));
		}
	},
	render: function (opt) {
		Backbone.Marionette.ItemView.prototype.render.apply(this, opt);
		// XXX: BackGrid requires this for some reason
		this.delegateEvents();
		return this;
	}
});

var UpdatesGridColumns = [{
	name: 'title',
	label: 'Software Update Product',
	editable: false,
	cell: ProductCell,
}, {
	name: 'version',
	label: 'Version',
	editable: false,
	cell: 'string',
}, {
	name: 'PostDate',
	label: 'Post Date',
	editable: false,
	cell: 'string',
}, {
	name: 'depr',
	label: 'Apple branch',
	editable: false,
	cell: AppleBranchCell,
}];


var UpdatesGrid = Backgrid.Grid.extend({
	className: "backgrid backgrid-striped",
	initialize: function (options) {
		// specifically assign a copy of our pre-defined grid columns
		this.options.columns = UpdatesGridColumns.slice(0);

		var that = this;

		// add a customized column for each branch
		_.each(options.collection.allBranches, function (i) {
			that.options.columns.push({
				name: i,
				label: i,
				editable: false,
				cell: BranchCell,
				/* let each header know which header it's for and
				   what other branches there are */
				headerCell: BranchHeaderCell.extend({
					branch: i,
					branches: options.collection.allBranches,
				}),
			});
		});

console.log(this.options.columns);

		Backgrid.Grid.prototype.initialize.call(this, options);
	},
});

var ProgressBarView = Backbone.Marionette.ItemView.extend({
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
	paginator: '#paginator',
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

	MargaritaApp.productChanges = new ProductChanges();
	MargaritaApp.products = new Products([], {productChanges: MargaritaApp.productChanges});
	MargaritaApp.filterCriteria = new FilterCriteria({products: MargaritaApp.products});

	MargaritaApp.products.bind('sync', function () {
		var updatesGrid = new UpdatesGrid({
			collection: MargaritaApp.products,
		});

		var paginator = new Backgrid.Extension.Paginator({
			collection: MargaritaApp.products,
		});

		MargaritaApp.updates.show(updatesGrid);
		MargaritaApp.paginator.show(paginator);
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
