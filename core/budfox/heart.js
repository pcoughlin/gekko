// The heart schedules and emit ticks every 20 seconds.

var util = require(__dirname + '/../util');
var log = require(util.dirs().core + 'log');

var _ = require('lodash');
var moment = require('moment');
const EventEmitter = require('events');

if (util.getConfig().watch.tickrate)
  var TICKRATE = util.getConfig().watch.tickrate;
else if (util.getConfig().watch.exchange === 'okcoin')
  var TICKRATE = 2;
else
  var TICKRATE = 20;

// var Heart = function () {
//   this.lastTick = false;

//   _.bindAll(this);
// }

// util.makeEventEmitter(Heart);

// Heart.prototype.pump = function() {
//   log.debug('scheduling ticks');
//   this.scheduleTicks();
// }

// Heart.prototype.tick = function() {
//   if(this.lastTick) {
//     // make sure the last tick happened not to lang ago
//     // @link https://github.com/askmike/gekko/issues/514
//     if(this.lastTick < moment().unix() - TICKRATE * 3)
//       util.die('Failed to tick in time, see https://github.com/askmike/gekko/issues/514 for details', true);
//   }

//   this.lastTick = moment().unix();
//   console.log(emit);

//   this.emit('tick');
// }

// Heart.prototype.scheduleTicks = function() {
//   setInterval(
//     this.tick,
//     +moment.duration(TICKRATE, 's')
//   );

//   // start!
//   _.defer(this.tick);
// }
var self;
class Heart extends EventEmitter {

  constructor() {
    super();
    this.lastTick = false;
    self = this;
  }
  pump() {
    log.debug('scheduling ticks');
    this.scheduleTicks();
  }

  tick() {
    if (this.lastTick) {
      // make sure the last tick happened not to lang ago
      // @link https://github.com/askmike/gekko/issues/514
      if (this.lastTick < moment().unix() - TICKRATE * 3)
        util.die('Failed to tick in time, see https://github.com/askmike/gekko/issues/514 for details', true);
    }

    this.lastTick = moment().unix();
    console.log("emitterrrrrrrrrrrrrrrrrrrrrrrrr**************", self.emit);

    self.emit('tick');
  }

  scheduleTicks() {
    setInterval(
      this.tick,
      +moment.duration(TICKRATE, 's')
    );

    // start!
    this.tick();
  }
}
// util.makeEventEmitter(new Heart());
module.exports = Heart;
