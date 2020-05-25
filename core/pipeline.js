/*

  A pipeline implements a full Gekko Flow based on a config and 
  a mode. The mode is an abstraction that tells Gekko what market
  to load (realtime, backtesting or importing) while making sure
  all enabled plugins are actually supported by that market.

  Read more here:
  https://gekko.wizb.it/docs/internals/architecture.html

*/


var util = require('./util');
var dirs = util.dirs();

var _ = require('lodash');
var async = require('async');
const bluebird = require('bluebird');
var log = require('./log');

var pipeline = (settings) => {

  var mode = settings.mode;
  var config = settings.config;

  // prepare a GekkoStream
  var GekkoStream = require('./gekkoStream');

  // all plugins
  var plugins = [];
  // all emitting plugins
  var emitters = {};
  // all plugins interested in candles
  var candleConsumers = [];

  // utility to check and load plugins.
  var pluginHelper = require('./pluginUtil');

  // meta information about every plugin that tells Gekko
  // something about every available plugin
  var pluginParameters = require(dirs.gekko + 'plugins');
  // meta information about the events plugins can broadcast
  // and how they should hooked up to consumers.
  var subscriptions = require(dirs.gekko + 'subscriptions');

  var market;

  // Instantiate each enabled plugin
  function loadPlugins(next) {
    console.log("Load plugins");

    // load all plugins
    // async.series(
    //   pluginParameters,
    //   pluginHelper.load,
    //   function(error, _plugins) {
    //     if(error)
    //       return util.die(error, true);

    //     plugins = _.compact(_plugins);
    //     next();
    //   }
    // );

    for (let plugin of pluginParameters) {

      pluginHelper.load(plugin, (error) => {
        if (error) {
          console.error("Failed to load plugin", plugin, error);
        } else {
          console.log("Loaded successfully");
        }
      });
    }
    next();
  };

  // Some plugins emit their own events, store
  // a reference to those plugins.
  function referenceEmitters(next) {
    console.log("at 2nd function==========================");

    _.each(plugins, function (plugin) {
      if (plugin.meta.emits)
        emitters[plugin.meta.slug] = plugin;
    });
    next();

  }

  // Subscribe all plugins to other emitting plugins
  function subscribePlugins(next) {
    console.log("at subscribePlugins ======================3rd");

    // events broadcasted by plugins
    var pluginSubscriptions = _.filter(
      subscriptions,
      sub => sub.emitter !== 'market'
    );

    // some events can be broadcasted by different
    // plugins, however the pipeline only allows a single
    // emitting plugin for each event to be enabled.
    _.each(
      pluginSubscriptions.filter(s => _.isArray(s.emitter)),
      subscription => {
        // cache full list
        subscription.emitters = subscription.emitter;
        var singleEventEmitters = subscription.emitter
          .filter(
            s => _.size(plugins.filter(p => p.meta.slug === s))
          );

        if (_.size(singleEventEmitters) > 1) {
          var error = `Multiple plugins are broadcasting`;
          error += ` the event "${subscription.event}" (${singleEventEmitters.join(',')}).`;
          error += 'This is unsupported.'
          util.die(error);
        } else {
          subscription.emitter = _.head(singleEventEmitters);
        }
      }
    );

    // subscribe interested plugins to
    // emitting plugins
    _.each(plugins, function (plugin) {
      _.each(pluginSubscriptions, function (sub) {

        if (plugin[sub.handler]) {
          // if a plugin wants to listen
          // to something disabled
          if (!emitters[sub.emitter]) {
            if (!plugin.meta.greedy) {

              let emitterMessage;
              if (sub.emitters) {
                emitterMessage = 'all of the emitting plugins [ ';
                emitterMessage += sub.emitters.join(', ');
                emitterMessage += ' ] are disabled.';
              } else {
                emitterMessage += 'the emitting plugin (' + sub.emitter;
                emitterMessage += ')is disabled.'
              }

              log.error([
                plugin.meta.name,
                'wanted to listen to event',
                sub.event + ',',
                'however',
                emitterMessage,
                plugin.meta.name + ' might malfunction because of it.'
              ].join(' '));
            }
            return;
          }

          // attach handler
          emitters[sub.emitter]
            .on(sub.event,
              plugin[
              sub.handler
              ])
        }

      });
    });

    // events broadcasted by the market
    var marketSubscriptions = _.filter(
      subscriptions,
      { emitter: 'market' }
    );

    // subscribe plugins to the market
    _.each(plugins, function (plugin) {
      _.each(marketSubscriptions, function (sub) {

        if (plugin[sub.handler]) {
          if (sub.event === 'candle')
            candleConsumers.push(plugin);
        }

      });
    });

    next();
  }

  function prepareMarket(next) {
    console.log("at prepareMarket =========================4th");

    if (mode === 'backtest' && config.backtest.daterange === 'scan')
      require(dirs.core + 'prepareDateRange')(next);
    else
      next();
  }

  function setupMarket(next) {
    console.log("at setupMarket =======================5th");

    // load a market based on the config (or fallback to mode)
    let marketType;
    if (config.market)
      marketType = config.market.type;
    else
      marketType = mode;

    var Market = require(dirs.markets + marketType);

    market = new Market(config);

    next();
  }

  function subscribePluginsToMarket(next) {
    console.log("at subscribePluginsToMarket =========================6th");

    // events broadcasted by the market
    var marketSubscriptions = _.filter(
      subscriptions,
      { emitter: 'market' }
    );

    _.each(plugins, function (plugin) {
      _.each(marketSubscriptions, function (sub) {

        if (sub.event === 'candle')
          // these are handled via the market stream
          return;

        if (plugin[sub.handler]) {
          market.on(sub.event, plugin[sub.handler]);
        }

      });
    });

    next();

  }

  console.log('Setting up Gekko in', mode, 'mode');
  async.series(
    [
      loadPlugins,
      referenceEmitters,
      subscribePlugins,
      prepareMarket,
      setupMarket,
      subscribePluginsToMarket
    ],
    function () {
      console.log("at setup done ====================== final");

      var gekkoStream = new GekkoStream(plugins);

      market
        .pipe(gekkoStream)

      // convert JS objects to JSON string
      // .pipe(new require('stringify-stream')())
      // output to standard out
      // .pipe(process.stdout);

      market.on('end', gekkoStream.finalize);
    }
  );

}

module.exports = pipeline;