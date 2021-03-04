const receiver = require('@amperka/ir-receiver').connect(P2);

// power switches
const openGateKeyPin = P0;
const closeGateKeyPin = P1;

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

const ButtonController = function (isButtonClicked) {
  this._isButtonClicked = isButtonClicked;
  this._holdTimeoutId = null;
  receiver.on('receive', this._onButtonAction.bind(this));
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

function isGateLocked() {
  return lockLeftBarrier.read() === 1 || lockRightBarrier.read() === 1;
}

function openGatePowerSwitch(keyPin) {
  if (isGateLocked()) {
    return;
  }
  digitalWrite(keyPin, HIGH);
}

function closeGatePowerSwitch(keyPin) {
  if (isGateLocked()) {
    return;
  }
  digitalWrite(keyPin, LOW);
}

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

  switchGateStateButtonController.on('press', function () {
    print('The gate is opening');
  });
}

startPowerOffHandler();
startGateUpHandler();
startGateDownHandler();
startSwitchGateStateHandler();

