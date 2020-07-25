const Promise = require('bluebird');
const si = require('./serialInterface');
const _ = require("underscore");
const simpleMqtt = require("./simpleMqtt");
const config = require("./config.js")
const logger = require('./logger')
let polycrc = require('polycrc')
let initialized = false;
si.begin(config.usbPort);
si.receiveCallback(async (replyId, data, err) => {
  if (err === "REBOOT") {
    if (initialized) {
      await setup();
    }
    return;
  }
  logger.debug(`Received: ${data}`);
  simpleMqtt.parse(replyId, data);
});
let rtcInterval = false;
const setup = async () => {
  initialized = false;

  if (rtcInterval === false) {
    setInterval(function () {
      const epoch = (new Date).getTime() / 1000;
      si.setRTC(epoch);
    }, 5 * 60 * 1000);
    rtcInterval = true;
  }

  try {
    await Promise.delay(1000)
    await si.reboot().delay(3000);
    await si.role("master");
    const mac = await si.getMAC();
    const crc24 = parseInt(polycrc.crc24(new Buffer.from(mac))) & 0xffffff;
    if (config.mesh.bsid !== crc24 && config.mesh.bsid === 0x112233) {
      logger.info(`(HOX!!! SET THIS VALUE TO ALL YOUR NODES --> \"const int bsid = 0x${crc24.toString(16)};\"). Update also config.js!!!`);
      logger.info("Default Bsid is used!!!");
    }
    await si.setBSID(config.mesh.bsid);
    await si.setInitializationVector(config.mesh.initializationVector);
    await si.setKey(config.mesh.secredKey);
    await si.setChannel(config.mesh.channel);
    await si.init();
    initialized = true;
    await si.setRTC((new Date).getTime() / 1000).delay(3000);
  } catch (ex) {
    console.log('HERE')
    console.log(ex)
    logger.error(ex)
  }
}

setup();
