const insideReceiver = require('@amperka/ir-receiver').connect(P2);
const outsideReceiver = require('@amperka/ir-receiver').connect(P3);

// power switches
const openGateKeyPin = P0;
const closeGateKeyPin = P1;

// audio signals
const mainAudioSignalPin = P4;

// barrier indicators
const lockRightBarrier = P8;
const lockLeftBarrier = P9;
const bottomRightBarrier = P10;
const bottomLeftBarrier = P11;
const topRightBarrier = P12;
const topLeftBarrier = P13;

// control buttons
const powerButton = 0xfd00ff;
const gateUpButton = 0xfd48b7;
const gateUpDuplicateButton = 3;
const gateDownButton = 0xfd6897;
const switchGateStateButton = 0xfd40bf;

// function helpers
function beep() {
  mainAudioSignalPin.reset();
  setTimeout(() => {
    mainAudioSignalPin.set();
  }, 5000);
}

function isGateLocked() {
  return lockLeftBarrier.read() === 1 || lockRightBarrier.read() === 1;
}

function openGatePowerSwitch(keyPin) {
  if (isGateLocked()) {
    beep();
    return;
  }
  keyPin.set();
}

function closeGatePowerSwitch(keyPin) {
  if (isGateLocked()) {
    beep();
    return;
  }
  keyPin.reset();
}

// controllers
const ButtonController = function (isButtonClicked) {
  this._isButtonClicked = isButtonClicked;
  this._holdTimeoutId = null;
  insideReceiver.on('receive', this._onButtonAction.bind(this));
  outsideReceiver.on('receive', this._onButtonAction.bind(this));
};

ButtonController.prototype._onButtonAction = function (code, repeat) {
  const isButtonHolding = this._isButtonClicked(code) && repeat;
  const isButtonPressed = this._isButtonClicked(code) && !repeat;

  if (isButtonPressed) {
    this.emit('press');
    this._updateReleaseTimeout(300);
  }
  if (isButtonHolding) {
    this.emit('hold');
    this._updateReleaseTimeout(150);
  }
};

ButtonController.prototype._updateReleaseTimeout = function (timeout) {
  const self = this;
  if (this._holdTimeoutId) {
    clearTimeout(this._holdTimeoutId);
  }
  this._holdTimeoutId = setTimeout(function () {
    self.emit('release');
  }, timeout);
};

const GateStateController = function () {
  this._isClosed = true;
  this._isOpened = false;
  this._inProgress = false;
};

GateStateController.prototype.switchState = function () {
  if (this._isClosed && !this._inProgress) {
    this._openGate();
  } else if (this._isOpened && !this._inProgress) {
    this._closeGate();
  }
};

GateStateController.prototype._openGate = function () {
  this._inProgress = true;
  this._isClosed = false;
  const self = this;
  openGatePowerSwitch(openGateKeyPin);
  const idWatches = this._setWatch([topLeftBarrier, topRightBarrier], function (e) {
    closeGatePowerSwitch(openGateKeyPin);
    idWatches.forEach((idWatch) => clearWatch(idWatch));
    self._inProgress = false;
    self._isOpened = true;
  });
};

GateStateController.prototype._closeGate = function () {
  this._inProgress = true;
  this._isOpened = false;
  const self = this;
  openGatePowerSwitch(closeGateKeyPin);
  const idWatches = this._setWatch([bottomLeftBarrier, bottomRightBarrier], function (e) {
    closeGatePowerSwitch(closeGateKeyPin);
    idWatches.forEach((idWatch) => clearWatch(idWatch));
    self._inProgress = false;
    this._isClosed = true;
  });
};

GateStateController.prototype._setWatch = function (pins, cb) {
  const options = {
    repeat: true,
    edge: 'rising',
    debounce: 10,
  };
  return pins.map((pin) => {
    return setWatch(cb, pin, options);
  });
};

// Handlers
function startGateUpHandler() {
  const gateUpButtonController = new ButtonController((code) => code === gateUpButton || code === gateUpDuplicateButton);

  gateUpButtonController.on('press', function () {
    openGatePowerSwitch(openGateKeyPin);
  });
  gateUpButtonController.on('release', function () {
    closeGatePowerSwitch(openGateKeyPin);
  });
}

function startGateDownHandler() {
  const gateDownButtonController = new ButtonController((code) => code === gateDownButton);

  gateDownButtonController.on('press', function () {
    openGatePowerSwitch(closeGateKeyPin);
  });
  gateDownButtonController.on('release', function () {
    closeGatePowerSwitch(closeGateKeyPin);
  });
}

function startPowerOffHandler() {
  const powerButtonController = new ButtonController((code) => code === powerButton);

  powerButtonController.on('press', function () {
    closeGatePowerSwitch(openGateKeyPin);
    closeGatePowerSwitch(closeGateKeyPin);
  });

  powerButtonController.on('hold', function () {
    closeGatePowerSwitch(openGateKeyPin);
    closeGatePowerSwitch(closeGateKeyPin);
  });
}

function startSwitchGateStateHandler() {
  const switchGateStateButtonController = new ButtonController((code) => code === switchGateStateButton);
  const gateStateController = new GateStateController();

  switchGateStateButtonController.on('press', function () {
    gateStateController.switchState();
  });
}

startPowerOffHandler();
startGateUpHandler();
startGateDownHandler();
startSwitchGateStateHandler();
