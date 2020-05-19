var _ = require('lodash');
var async = require('async');
var Emitter = require('./emitter');

var util = require(__dirname + '/util');

var log = require(util.dirs().core + 'log');

var config = util.getConfig();
var pluginDir = util.dirs().plugins;
var gekkoMode = util.gekkoMode();
var inherits = require('util').inherits;

var pluginHelper = {
  // Checks whether we can load a module

  // @param Object plugin
  //    plugin config object
  // @return String
  //    error message if we can't
  //    use the module.
  cannotLoad: function (plugin) {

    // verify plugin dependencies are installed
    if (_.has(plugin, 'dependencies'))
      var error = false;

    _.each(plugin.dependencies, function (dep) {
      try {
        var a = require(dep.module);
      }
      catch (e) {
        log.error('ERROR LOADING DEPENDENCY', dep.module);

        if (!e.message) {
          log.error(e);
          util.die();
        }

        if (!e.message.startsWith('Cannot find module'))
          return util.die(e);

        error = [
          'The plugin',
          plugin.slug,
          'expects the module',
          dep.module,
          'to be installed.',
          'However it is not, install',
          'it by running: \n\n',
          '\tnpm install',
          dep.module + '@' + dep.version
        ].join(' ');
      }
    });

    return error;
  },
  // loads a plugin
  // 
  // @param Object plugin
  //    plugin config object
  // @param Function next
  //    callback
  load: function (plugin, next) {
    console.log("Loading plugin", plugin);

    plugin.config = config[plugin.slug];

    if (!plugin.config || !plugin.config.enabled)
      return next();

    if (!_.includes(plugin.modes, gekkoMode)) {
      console.log(
        'The plugin',
        plugin.name,
        'does not support the mode',
        gekkoMode + '.',
        'It has been disabled.'
      )
      return next();
    }

    console.log('Setting up:');
    console.log('\t', plugin.name);
    console.log('\t', plugin.description);

    var cannotLoad = pluginHelper.cannotLoad(plugin);
    if (cannotLoad) {
      console.log("Cannot load plugin");
      return next(cannotLoad);
    }
    var Constructor
    if (plugin.path)
      Constructor = require(pluginDir + plugin.path(config));
    else
      Constructor = require(pluginDir + plugin.slug);
  
    console.log("Constructor loaded");
    
    if (plugin.async) {
      inherits(Constructor, Emitter);
      var instance = new Constructor(util.defer(function (err) {
        next(err, instance);
      }), plugin);
      console.log("Constructor initialized");
      Emitter.call(instance);

      instance.meta = plugin;
    } else {
      inherits(Constructor, Emitter);
      var instance = new Constructor(plugin);
      Emitter.call(instance);
      console.log("Constructor initialized");

      instance.meta = plugin;
      _.defer(function () {
        next(null, instance);
      });
    }

    if (!plugin.silent)
      log.info('\n');
  }
}

module.exports = pluginHelper;