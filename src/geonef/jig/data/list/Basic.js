define("geonef/jig/data/list/Basic", ["dijit/_Widget", "dijit/_Templated", "geonef/jig/data/pane/CreatorMixin", "geonef/jig/Deferred", "geonef/jig/data/model", "geonef/jig/data/list/BasicRow", "dojo", "geonef/jig/util", "geonef/jig/button/Action", "geonef/jig/button/Link"], function(_Widget, _Templated, CreatorMixin, Deferred, model, BasicRow, dojo) {

/**
 * Basic list, made from distinct row widgets
 */
dojo.declare('geonef.jig.data.list.Basic',
             [ dijit._Widget, dijit._Templated,
               geonef.jig.data.pane.CreatorMixin ],
{

  /**
   * Object to get the data from (see 'objectProp'), or null for independant query
   *
   * @type {!geonef.jig.data.model.Abstract} object
   */
  object: null,

  /**
   * Name of object property to get the data from, or null for independant query
   *
   * @type {string} objectProp
   */
  objectProperty: null,

  /**
   * @type {integer} max number of shown results
   */
  limit: null,

  /**
   * @type {string} msgMore
   */
  msgMore: "+ ${count} objets",

  /**
   * @type {geonef.jig.data.model.Abstract}
   */
  Model: null,

  /**
   * @type {dijit._Widget} Widget class to use for rows
   */
  RowClass: geonef.jig.data.list.BasicRow,

  /**
   * @type {Object} Options given to row widgets
   */
  rowOptions: {},

  /**
   * @type {geonef.jig.Deferred}
   */
  whenReady: null,


  postMixInProperties: function() {
    this.inherited(arguments);
    this.rowOptions = dojo.mixin({}, this.rowOptions);
    this.whenReady = new geonef.jig.Deferred();
    this.store = geonef.jig.data.model.getStore(this.Model);
  },

  buildRendering: function() {
    this.inherited(arguments);
    dojo.addClass(this.domNode, 'jigDataList '+
                  (this.readOnly ? 'ro' : 'rw'));
  },

  postCreate: function() {
    this.inherited(arguments);
    this.refresh();
    this.subscribe(this.store.channel, this.onChannel);
    if (this.object) {
      this.subscribe(this.object.store.channel, this.onObjectChannel);
    }
  },

  startup: function() {
    this.inherited(arguments);
    this.whenReady.callback();
  },

  destroy: function() {
    this.clear();
    this.inherited(arguments);
  },

  refresh: function() {
    this.fetchResults()
        .then(dojo.hitch(this, this.populateList))
        .then(geonef.jig.util.busy(this.domNode));
  },

  /**
   * Make a query or fetch 'many' prop, depending on this.objectProperty
   */
  fetchResults: function() {
    if (this.objectProperty) {
      return this.object.get(this.objectProperty);
    } else {
      return this.store.query(this.buildQuery());
    }
  },

  buildQuery: function() {
    return {};
  },

  populateList: function(results) {
    this.clear();
    if (this.emptyNode) {
      dojo.style(this.emptyNode, 'display', results.length > 0 ? 'none' : '');
    }
    if (this.countLink) {
      this.countLink.set('label', '('+(results.totalCount || results.length)+')');
    }
    (results.length > 0 ? dojo.removeClass : dojo.addClass)(this.domNode, 'empty');
    var over = this.limit && this.limit < results.length &&
      results.length - this.limit;
    if (over) {
      results = results.slice(0, this.limit);
    }
    this.rows = results.map(this.makeRow, this)
                       .map(this.placeRow, this);
    if (over) {
      var moreLink = new geonef.jig.button.Link(
                       { label: dojo.string.substitute(this.msgMore, { count: over }),
                         title: "Cliquer pour afficher",
                         onExecute: dojo.hitch(this, this.openList) });
      dojo.addClass(moreLink.domNode, 'jigDataRow more');
      this.placeRow(moreLink, null);
      this.rows.push(moreLink);
    }
  },

  makeRow: function(obj, key) {
    var row = new (this.RowClass)(dojo.mixin({ object: obj }, this.rowOptions));
    return row;
  },

  /**
   * @type {dijit._Widget} row widget to place
   */
  placeRow: function(row, key) {
    row.placeAt(this.listNode);
    row.startup();
    return row;
  },

  clear: function() {
    if (this.rows) {
      this.rows.forEach(function(row) { row.destroy(); });
    }
    delete this.rows;
  },


  openList: function() {
    console.warn("to overload: openList()", this);
  },

  /**
   * Model channel subscribe handler
   *
   * @param {geonef.jig.data.model.Abstract} obj model object
   * @param {string} type                        type of event
   */
  onChannel: function(obj, type) {
    if (['put', 'delete'].indexOf(type) !== -1) {
      this.refresh();
    }
  },

  /**
   * Channel subscribe handler for this.object
   *
   * @param {geonef.jig.data.model.Abstract} obj model object
   * @param {string} type                        type of event
   */
  onObjectChannel: function(obj, type) {
  }

});

return geonef.jig.data.list.Basic;
});
