const _ = require('lodash');
const fs = require('co-fs');
const path = require('path');

const gekkoRoot = path.resolve(__dirname, '..', '..');

module.exports = function* () {

  const strategyDir = yield fs.readdir(path.join(gekkoRoot, 'strategies'));
  console.log("******************", strategyDir);

  const strats = strategyDir
    .map((f) => { return { name: f.slice(0, -3) } });

  // .filter(f => _.last(f, 3).length > 0 && [_.last(f, 3)].join('') === '.js')
  // .map(f => {
  //   return { name: f.slice(0, -3) }
  // });

  // for every strat, check if there is a config file and add it
  const stratConfigPath = path.join(gekkoRoot, 'config/strategies');
  const strategyParamsDir = yield fs.readdir(stratConfigPath);

  for (let i = 0; i < strats.length; i++) {
    let strat = strats[i];
    if (strategyParamsDir.indexOf(strat.name + '.toml') !== -1)
      strat.params = yield fs.readFile(stratConfigPath + '/' + strat.name + '.toml', 'utf8')
    else
      strat.params = '';
  }

  this.body = strats;
}