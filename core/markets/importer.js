var _ = require('lodash');
var util = require('../util');
var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');
var moment = require('moment');
var Readable = require('stream').Readable;
var gekkoEnv = util.gekkoEnv();

var adapter = config[config.adapter];
var daterange = config.importer.daterange;

var from = moment.utc(daterange.from);

if(daterange.to) {
  var to = moment.utc(daterange.to);
} else {
  var to = moment().utc();
  log.debug(
    'No end date specified for importing, setting to',
    to.format()
  );
}
log.debug(to.format());

if(!from.isValid())
  util.die('invalid `from`');

if(!to.isValid())
  util.die('invalid `to`');

var TradeBatcher = require(dirs.budfox + 'tradeBatcher');
var CandleManager = require(dirs.budfox + 'candleManager');
var exchangeChecker = require(dirs.gekko + 'exchange/exchangeChecker');

var error = exchangeChecker.cantFetchFullHistory(config.watch);
if(error)
  util.die(error, true);

var fetcher = require(dirs.importers + config.watch.exchange);

if(to <= from)
  util.die('This daterange does not make sense.')

var tradeBatcher, candleManager, exchangeSettings, fetcher
var Market = function() {
  _.bindAll(this);
  exchangeSettings = exchangeChecker.settings(config.watch);
  tradeBatcher = new TradeBatcher(exchangeSettings.tid);
  candleManager = new CandleManager;
  fetcher = fetcher({
    to: to,
    from: from
  });

  this.done = false;

  fetcher.bus.on(
    'trades',
    this.processTrades
  );

  fetcher.bus.on(
    'done',
    function() {
      this.done = true;
    }.bind(this)
  )

  tradeBatcher.on(
    'new batch',
    candleManager.processTrades
  );

  candleManager.on(
    'candles',
    this.pushCandles
  );

  Readable.call(this, {objectMode: true});

  get();
}


Market.prototype = Object.create(Readable.prototype, {
  constructor: { value: Market }
});

Market.prototype._read = _.noop;

Market.prototype.pushCandles = function(candles) {
  _.each(candles, this.push);
}

function get() {
  fetcher.fetch();
}

Market.prototype.processTrades = function(trades) {
  console.log("Trade values received: ",trades);
  tradeBatcher.write(trades);

  if(this.done) {
    log.info('Done importing!');
    this.emit('end');
    return;
  }

  if(_.size(trades) && gekkoEnv === 'child-process') {
    let lastAtTS = _.last(trades).date;
    let lastAt = moment.unix(lastAtTS).utc().format();
    log.info('Process market update event');
    process.send({event: 'marketUpdate', payload: lastAt});
  } else {
    this.done = true;
    log.info('Done importing!');
    console.log("what is emit here",this.emit);
    
    this.emit('end');
    return;    
  }

  setTimeout(get, 1000);
}

module.exports = Market;
