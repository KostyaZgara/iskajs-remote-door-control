const receiver = require('@amperka/ir-receiver').connect(P2);

// power switches
const openDoorKeyPin = P0;
const closeDoorKeyPin = P1;

// barrier indicators
const lockBarrier = P9;
const bottomRightBarrier = P10;
const bottomLeftBarrier = P11;
const topLeftBarrier = P13;
const topRightBarrier = P12;

// control buttons
const powerButton = 0xfd00ff;
const doorUpButton = 0xfd48b7;
const doorUpDuplicateButton = 3;
const doorDownButton = 0xfd6897;
const switchDoorStateButton = 0xfd40bf;

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

function openDoorPowerSwitch(keyPin) {
  if (lockBarrier.read() === 1) {
    return;
  }
  digitalWrite(keyPin, HIGH);
}

function closeDoorPowerSwitch(keyPin) {
  if (lockBarrier.read() === 1) {
    return;
  }
  digitalWrite(keyPin, LOW);
}

function startDoorUpHandler() {
  const doorUpButtonController = new ButtonController((code) => code === doorUpButton || code === doorUpDuplicateButton);

  doorUpButtonController.on('press', function () {
    openDoorPowerSwitch(openDoorKeyPin);
  });
  doorUpButtonController.on('release', function () {
    closeDoorPowerSwitch(openDoorKeyPin);
  });
}

function startDoorDownHandler() {
  const doorDownButtonController = new ButtonController((code) => code === doorDownButton);

  doorDownButtonController.on('press', function () {
    openDoorPowerSwitch(closeDoorKeyPin);
  });
  doorDownButtonController.on('release', function () {
    closeDoorPowerSwitch(closeDoorKeyPin);
  });
}

function startPowerOffHandler() {
  const powerButtonController = new ButtonController((code) => code === powerButton);

  powerButtonController.on('press', function () {
    closeDoorPowerSwitch(openDoorKeyPin);
    closeDoorPowerSwitch(closeDoorKeyPin);
  });

  powerButtonController.on('hold', function () {
    closeDoorPowerSwitch(openDoorKeyPin);
    closeDoorPowerSwitch(closeDoorKeyPin);
  });
}

function startSwitchDoorStateHandler() {
  const switchDoorStateButtonController = new ButtonController((code) => code === switchDoorStateButton);

  switchDoorStateButtonController.on('press', function () {
    print('The gate is opening');
  });
}

startPowerOffHandler();
startDoorUpHandler();
startDoorDownHandler();
startSwitchDoorStateHandler();

