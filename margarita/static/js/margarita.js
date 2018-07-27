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
	defaults: { queued: [], configdata: null, fetchingconfig: false },
	removeConfigData: function () {
		if (!this.get('configdata'))
		{
			console.log("no configdata to remove for " + this.get('id'));
			return;
		}

		this.set({'fetchingconfig': true});

		that = this;

		$.ajax({
			type: 'POST',
			url: 'remove_config_data/' + this.get('id'),
			success: function(result) {
				that.set({'fetchingconfig': false, 'configdata': false});
			}
		});
	}
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

		var prod_ids_to_check = [];
		_.each(this.models, function(model) {
			if (!model.get('fetchingconfig') && model.get('configdata') == null) {
				prod_ids_to_check.push(model.get('id'));
				model.set('fetchingconfig', true);
			}
		});

		if (prod_ids_to_check.length < 1)
		{
			return;
		}

		console.log('checking', prod_ids_to_check.length, 'products for config-data')

		$.ajax({
			type: 'POST',
			url: 'config_data',
			data: JSON.stringify(prod_ids_to_check),
			dataType: 'json',
			contentType: 'application/json; charset=UTF-8',
			success: function(result) {
				console.log('results for', _.keys(result).length, 'products for config-data')
				_.each(_.keys(result), function(prod_id) {
					// the filterCriteria object is the only object which has
					// the complete unfiltered set of updates from reposado
					// this model object only has the filtered and paginated
					// results
					var myModel = MargaritaApp.filterCriteria.shadowCollection.get(prod_id);
					myModel.set({'fetchingconfig': false, 'configdata': result[prod_id]});
				});
			}
		});
	},
});

var FilterCriteria = Backbone.Model.extend({
	defaults: {
		hideCommon: true
	},
	initialize: function(options) {
		this.products = options.products;
		this.products.bind('sync', this.productsUpdated, this);
		this.bind('change', this.doFilter, this);
	},
	productsUpdated: function() {
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

var UpdateModalRegion = Backbone.Marionette.Region.extend({
	el: "#rgn-modal-update",
	constructor: function() {
		Backbone.Marionette.Region.prototype.constructor.apply(this, arguments);
		this.on("show", this.showModal, this);
	},
	getEl: function(selector) {
		var $el = $(selector);
		$el.on("hidden", this.close);
		return $el;
	},
	showModal: function(view) {
		/* this catches the case where this region was closed()ed but the
		   modal was not hidden. note because close() seems to destroy the
		   window the nice slideUp effect doesn't show (div is already
		   destroyed). hence one should use hideModal() when hiding things
		   from the view. the close() will get called after it's hidden. */
		view.on("close", this.hideModal, this);
		this.$el.modal('show');
	},
	hideModal: function() {
		this.$el.modal('hide');
	}
})

/* Views */

var UpdateModalView = Backbone.Marionette.ItemView.extend({
	template: '#vw-modal-update',
	events: {
		'click .closeAction': 'closeClicked',
		'click .removeConfigDataAction': 'removeConfigData',
	},
	initialize: function() {
		this.model.bind('change', this.render, this);
	},
	closeClicked: function () {
		MargaritaApp.updateModal.hideModal();
	},
	removeConfigData: function () {
		this.model.removeConfigData();
	}
});

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
	events: {
		'click .toggle-info': 'showInfo',
	},
	initialize: function (options) {
		// BackGrid cells require the column key
		_.extend(this, _.pick(options, ['column']));
		this.model.bind('change:configdata', this.render, this);
	},
	showInfo: function (ev) {
		ev.preventDefault();
		// TODO: use a single view object? may not be an issue if memory is
		// free'd after view is closed (by region). to investigate
		var updModalView = new UpdateModalView({model: this.model});
		MargaritaApp.updateModal.show(updModalView);
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

var UpdatesGridFooter = Backbone.Marionette.ItemView.extend({
	tagName: 'tfoot',
	template: '#vw-grid-footer',

	initialize: function (options) {
		this.columns = options.columns;
		if (!(this.columns instanceof Backbone.Collection)) {
			this.columns = new Backgrid.Columns(this.columns);
		}

		// XXX: yuck! shouldn't need to appeal to the top-level MargaritaApp

		// render when different filter criteria has been selected
		MargaritaApp.filterCriteria.bind('change', this.render);
		// render when a different table page is selected
		MargaritaApp.products.bind('reset', this.render);
	},
	serializeData: function() {
		// XXX: yuck! shouldn't need to appeal to the top-level MargaritaApp

		var serData = {
			total: MargaritaApp.filterCriteria.shadowCollection.length,
			showing: MargaritaApp.filterCriteria.products.fullCollection.length,
			page: MargaritaApp.filterCriteria.products.length,
			// required to set the colspan of the td within the tfoot element
			colspan: this.columns.length,
		};
		return serData;
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

		Backgrid.Grid.prototype.initialize.call(this, options);
	},
	footer: UpdatesGridFooter,
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
	updateModal: UpdateModalRegion,
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

function datasize (bytes) {
	var units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
	if (bytes == 0) return '0 ' + units[0];
	var e = Math.floor(Math.log(bytes) / Math.log(1024));
	return (bytes / Math.pow(1024, e)).toFixed(1) + ' ' + units[e];
}

/* Init */

$(document).ready(function () {
	MargaritaApp.start();
});
