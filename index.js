const insideReceiver = require('@amperka/ir-receiver').connect(P0);
const outsideReceiver = require('@amperka/ir-receiver').connect(P1);

// power switches
const openGateKeyPin = P10;
const closeGateKeyPin = P8;

// audio signals
const mainAudioSignalPin = P5;

/*
* Pins to related numbers
* P0 = 11
* P1 = 10
* P2 = 6
* P3 = 7
* P4 = 3
* P5 = 1
* P6 = 0
* P7 = 2
* P8 = 6
* P9 = 7
* P10 = 8
* P11 = 9
* P12 = 8
* P13 = 10
*
* Grouped pins that relates to the same number
* P0, (P1-P13), (P2-P8), (P3-P9), P4, P5, P6, P7, (P10-P12), P11
* */

// barrier indicators
const lockRightBarrier = P2;
const lockLeftBarrier = P3;
const topRightBarrier = P6;
const topLeftBarrier = P7;
const bottomLeftBarrier = P11;
const bottomRightBarrier = P12;

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
  }, 1000);
}

function isGateLocked() {
  return !lockLeftBarrier.read() || !lockRightBarrier.read();
}

function openGatePowerSwitch(keyPin) {
  if (isGateLocked()) {
    beep();
    return false;
  }
  keyPin.set();
  return true;
}

function closeGatePowerSwitch(keyPin) {
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
  this.reset();
  const self = this;
  this._setWatch([topRightBarrier, topLeftBarrier], function () {
    if (!self._isOpening) {
      return;
    }
    closeGatePowerSwitch(openGateKeyPin);
    self._isOpened = true;
    self._isOpening = false;
  });
  this._setWatch([bottomRightBarrier, bottomLeftBarrier], function () {
    if (!self._isClosing) {
      return;
    }
    closeGatePowerSwitch(closeGateKeyPin);
    self._isClosed = true;
    self._isClosing = false;
  });
};

GateStateController.prototype.switchState = function () {
  const inProgress = this._isClosing || this._isOpening;
  if (this._isClosed && !inProgress) {
    this._openGate();
  } else if (this._isOpened && !inProgress) {
    this._closeGate();
  }
};

GateStateController.prototype.reset = function () {
  this._isClosed = true;
  this._isClosing = false;
  this._isOpened = false;
  this._isOpening = false;
};

GateStateController.prototype._openGate = function () {
  const result = openGatePowerSwitch(openGateKeyPin);
  if (result) {
    this._isOpening = true;
    this._isClosed = false;
    setTimeout(() => {
      closeGatePowerSwitch(openGateKeyPin);
    }, 1000);
    setTimeout(() => {
      openGatePowerSwitch(openGateKeyPin);
    }, 1500);
    setTimeout(() => {
      closeGatePowerSwitch(openGateKeyPin);
    }, 2500);
    setTimeout(() => {
      openGatePowerSwitch(openGateKeyPin);
    }, 3000);
  }
};

GateStateController.prototype._closeGate = function () {
  const result = openGatePowerSwitch(closeGateKeyPin);
  if (result) {
    this._isClosing = true;
    this._isOpened = false;
  }
};

GateStateController.prototype._setWatch = function (pins, cb) {
  pins.forEach(
    (pin) => setWatch(cb, pin, {
      repeat: true,
      edge: 'falling',
      debounce: 10
    })
  );
};

const gateStateController = new GateStateController();

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
    gateStateController.reset();
    mainAudioSignalPin.set();
  });
}

function startSwitchGateStateHandler() {
  const switchGateStateButtonController = new ButtonController((code) => code === switchGateStateButton);

  switchGateStateButtonController.on('press', function () {
    gateStateController.switchState();
  });
}

startPowerOffHandler();
startGateUpHandler();
startGateDownHandler();
startSwitchGateStateHandler();
