define("geonef/jig/data/pane/CreatorMixin", ["dojo"], function(dojo) {


dojo.declare('geonef.jig.data.pane.CreatorMixin', null,
{

  /**
   * Create a new object and save it
   *
   * Warning: don't use it directly as an event handler
   *          (the event obj would be got as 'props')
   *
   * @public
   * @param {!Object} props     Properties to init the model object with
   * @param {!Object} options   Options to the store's add() operation
   * @param {string} discriminatorKey The discriminator to use, if used on that Model
   * @return {dojo.Deferred}
   */
  createNew: function(props, options, discriminatorKey) {
    var _this = this;
    var object = this.createNewObject(props, discriminatorKey)
        .then(function(obj) {
                if (!obj) { return false; }
                console.log('obj', obj);
                return _this.store.add(obj, options)
                    .then(function(obj) {
                            if (obj && obj.getId()) {
                              _this.afterCreateNew(obj);
                            }
                          });
              })
        .then(geonef.jig.util.busy(this.domNode));
  },

  /**
   * Create new object with given properties - asynchronous
   *
   * @protected
   * @param {!Object} props     Properties to init the model object with
   * @param {string} discriminatorKey The discriminator to use, if used on that Model
   * @return {geonef.jig.Deferred}
   */
  createNewObject: function(props, discriminatorKey) {
    var deferred = new geonef.jig.Deferred();
    var object = this.store.createObject(discriminatorKey);
    object.setProps(props);
    // var object = new (this.Model)(props);
    deferred.resolve(object); // unset object by default
    return deferred;
  },

  /**
   * hook - called after a new object has been saved
   *
   * @param {geonef.jig.data.model.Abstract} object object which has been created
   */
  afterCreateNew: function(object) {}

});

return geonef.jig.data.pane._CreateSupport;
});