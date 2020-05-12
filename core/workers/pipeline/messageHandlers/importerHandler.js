module.exports = cb => {

  return {
    message: message => {

      if (message.event === 'marketUpdate') {
        console.log('Market update event triggered');
        cb(null, {
          done: false,
          latest: message.payload
        });
      }
      else if (message.type === 'error') {
        console.error('Error in import', message);
        cb(message.error);

      } else if (message.type === 'log') {
        console.log("Import log", message.log);
      } else {
        console.log("Default import log", message);
      }

    },
    exit: status => {
      if (status !== 0) {
        console.log('Child process has died.');
        return cb('Child process has died.');
      } else {
        console.log("Import completed");
        cb(null, { done: true });
      }
    }
  }
}