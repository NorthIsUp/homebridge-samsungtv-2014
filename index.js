var SamsungRemote = require('samsung-remote');
var inherits = require('util').inherits;
var Service, Characteristic, Accessory, VolumeCharacteristic, ChannelCharacteristic, KeyCharacteristic;

/**
 * Just a little helper that guarantees that the callback function is only callable once.
 *
 * @param {Function} callback The actual callback.
 */
function DisposableCallback(callback) {
    var _callback = callback
    return function () {
        _callback.apply(this, arguments)
        _callback = function () {
            console.log.warn('Attempt to call disposable callback twice.')
        }
    }
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;

    // we can only do this after we receive the homebridge API object
    // makeVolumeCharacteristic();
    // makeChannelCharacteristic();
    // makeKeyCharacteristic();

    var acc = SamsungTvAccessory.prototype;
    inherits(SamsungTvAccessory, Accessory);
    SamsungTvAccessory.prototype.parent = Accessory.prototype;
    for (var mn in acc) {
        SamsungTvAccessory.prototype[mn] = acc[mn];
    }

    homebridge.registerPlatform("homebridge-samsungtv-2014", "SamsungTV2014", SamsungTvPlatform);
};

function SamsungTvPlatform(log, config) {
    this.log = log;

    this.tvAccessories = [];

    if (!config || !config.tvs) {
        this.log.info("SamsungTV2014 plugin is not configured.  Skipping.")
        return;
    }

    config.tvs.forEach(tv => {
        this.tvAccessories.push(new SamsungTvAccessory(log, tv));
    });

}

SamsungTvPlatform.prototype.accessories = function (callback) {
    callback(this.tvAccessories);
}

function SamsungTvAccessory(log, config) {
    this.log = log;
    this.config = config;
    this.name = config.name;
    this.ipAddress = config.ipAddress;
    this.sendDelay = config.sendDelay || 400;
    this.useFan = config.useFan;

    if (!this.ipAddress) {
        this.log.info("IP address was not provided.  TV will not be initialized for name: ", this.name);
        return;
    }

    this.remote = new SamsungRemote({
        ip: this.ipAddress // required: IP address of your Samsung Smart TV
    });

    this.isSendingSequence = false;

    // The channel value can not be accessed on the tv
    // if the normal remote is used to change the channel
    // the value will not be updated therefore
    this.channel = 1;

    this.service = new Service.Switch(this.name);

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this._getOn.bind(this))
        .on('set', this._setOn.bind(this));

    if (this.useFan) {
        this.service
            .addCharacteristic(new Characteristic.RotationSpeed())
            .on('get', this._getVolume.bind(this))
            .on('set', this._getVolume.bind(this));
    } else {
        this.service
            .addCharacteristic(new Characteristic.Brightness())
            .on('get', this._getVolume.bind(this))
            .on('set', this._getVolume.bind(this));
    }

    this.log.info("Created TV %s at IP address %s", this.name, this.ipAddress);

    // this.service
    //     .addCharacteristic(VolumeCharacteristic)
    //     .on('get', this._getVolume.bind(this))
    //     .on('set', this._setVolume.bind(this));
    //
    // this.service
    //     .addCharacteristic(ChannelCharacteristic)
    //     .on('get', this._getChannel.bind(this))
    //     .on('set', this._setChannel.bind(this));
    //
    // this.service
    //     .addCharacteristic(KeyCharacteristic)
    //     .on('get', this._getKey.bind(this))
    //     .on('set', this._setKey.bind(this));
}

SamsungTvAccessory.prototype.getInformationService = function () {
    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Samsung TV')
        .setCharacteristic(Characteristic.Model, '1.0.0')
        .setCharacteristic(Characteristic.SerialNumber, this.ip_address);
    return informationService;
};

SamsungTvAccessory.prototype.getServices = function () {
    return [this.service, this.getInformationService()];
};

SamsungTvAccessory.prototype._getOn = function (callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)
    this.remote.isAlive(function (err) {
        if (err) {
            accessory.log.error('TV is offline: %s', err);
            cb(null, false);
        } else {
            accessory.log.info('TV is alive.');
            cb(null, true);
        }
    });
};

SamsungTvAccessory.prototype._setOn = function (on, callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)
    if (on) {
        this.remote.send('KEY_POWERON', function (err) {
            if (err) {
                accessory.log.error('Could not turn TV on: %s', err);
                cb(new Error(err));
            } else {
                accessory.log.info('TV successfully turned on');
                cb(null);
            }
        });
    } else {
        this.remote.send('KEY_POWEROFF', function (err) {
            if (err) {
                accessory.log.error('Could not turn TV off: %s', err);
                cb(new Error(err));
            } else {
                accessory.log.info('TV successfully turned off');
                cb(null);
            }
        });
    }
};

SamsungTvAccessory.prototype._getVolume = function (callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)
    cb(null, 25);
};

SamsungTvAccessory.prototype._setVolume = function (volume, callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)

    // Dismiss the request when another key sequence sending
    if (this.isSendingSequence) {
        cb(null);
        this.log.error('Cannot send volume change by %s while sending other key sequence.', volume);
        return;
    }
    this.isSendingSequence = true;

    // When volume is 0, mute will be toggled
    if (volume === 0) {
        accessory.remote.send('KEY_MUTE', function (err) {
            if (err) {
                accessory.isSendingSequence = false;
                cb(new Error(err));
                accessory.log.error('Could not send mute key: %s', err);
                return;
            }
            accessory.log.info('Finished sending mute key.');
            accessory.isSendingSequence = false;
            cb(null);
        });
        return;
    }

    this.log.info('Changing volume by %s.', volume);

    var volumeKey = volume > 0 ? 'KEY_VOLUP' : 'KEY_VOLDOWN';
    var absVolume = Math.abs(volume);

    function sendKey(index) {
        if (index > 0) {
            accessory.remote.send(volumeKey, function (err) {
                if (err) {
                    accessory.isSendingSequence = false;
                    callback(new Error(err));
                    accessory.log.error('Could not send volume key %s: %s', volumeKey, err);
                    return;
                }
                // Send the next key after the specified delay
                setTimeout(function () {
                    sendKey(--index)
                }, accessory.sendDelay);
            });
            return;
        }
        accessory.log.info('Finished changing volume by %s.', volume);
        accessory.isSendingSequence = false;
        cb(null);
    }

    sendKey(absVolume);
};


SamsungTvAccessory.prototype._getChannel = function (callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)

    cb(null, accessory.channel);
};

SamsungTvAccessory.prototype._setChannel = function (channel, callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)

    // Dismiss the request when another key sequence sending
    if (this.isSendingSequence) {
        cb(null);
        this.log.error('Cannot send channel %s while sending other key sequence.', channel);
        return;
    }
    this.isSendingSequence = true;
    this.log.info('Sending channel %s.', channel);

    var channelInt = parseInt(channel, 10);
    if (isNaN(channelInt) || channelInt < 1 || channelInt > 9999) {
        cb(new Error('Invalid channel "' + channel + '"'));
        this.log.error('Invalid channel "%s".', channel);
        return;
    }

    var chStr = channelInt.toString(),
        keys = [];
    for (var i = 0, j = chStr.length; i < j; ++i) {
        keys.push('KEY_' + chStr[i]);
    }
    // Add the enter key to the end
    keys.push('KEY_ENTER');

    function sendKey(index) {
        if (index < keys.length) {
            accessory.log.info('Sending channel key %s.', keys[index]);
            accessory.remote.send(keys[index], function (err) {
                if (err) {
                    accessory.isSendingSequence = false;
                    cb(new Error(err));
                    accessory.log.error('Could not send channel key %s: %s', keys[index], err);
                    return;
                }

                // Send the next key after the specified delay
                setTimeout(function () {
                    sendKey(++index)
                }, accessory.sendDelay);
            });
            return;
        }
        accessory.log.info('Finished sending channel %s.', channel);
        accessory.isSendingSequence = false;
        accessory.channel = channel;
        cb(null);
    }

    sendKey(0)
};

SamsungTvAccessory.prototype._getKey = function (callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)

    cb(null, accessory.key);
};

SamsungTvAccessory.prototype._setKey = function (key, callback) {
    var accessory = this;
    var cb = DisposableCallback(callback)

    // Dismiss the request when a key sequence is sending
    if (this.isSendingSequence) {
        cb(null);
        this.log.error('Cannot send key %s while sending a key sequence.', key);
        return;
    }
    this.isSendingSequence = true;
    this.log.info('Sending key %s.', key);

    accessory.remote.send('KEY_' + key.toUpperCase(), function (err) {
        if (err) {
            accessory.isSendingSequence = false;
            cb(new Error(err));
            accessory.log.error('Could not send key %s: %s', key, err);
            return;
        }
        accessory.log.info('Finished sending key %s.', key);
        accessory.isSendingSequence = false;
        accessory.key = key;
        cb(null);
    });
};

/**
 * Custom characteristic for volume
 *
 * @return {Characteristic} The volume characteristic
 */
function makeVolumeCharacteristic() {

    VolumeCharacteristic = function () {
        Characteristic.call(this, 'Volume', '91288267-5678-49B2-8D22-F57BE995AA00');
        this.setProps({
            format: Characteristic.Formats.INT,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 10,
            minValue: -10,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        //this.value = this.getDefaultValue();
        this.value = 1;
    };

    inherits(VolumeCharacteristic, Characteristic);
}

/**
 * Custom characteristic for channel
 *
 * @return {Characteristic} The channel characteristic
 */
function makeChannelCharacteristic() {

    ChannelCharacteristic = function () {
        Characteristic.call(this, 'Channel', '212131F4-2E14-4FF4-AE13-C97C3232499D');
        this.setProps({
            format: Characteristic.Formats.STRING,
            unit: Characteristic.Units.NONE,
            //maxValue: 9999,
            //minValue: 1,
            //minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        //this.value = this.getDefaultValue();
        this.value = "1";
    };

    inherits(ChannelCharacteristic, Characteristic);
}

/**
 * Custom characteristic for any key
 * @see(https://github.com/natalan/samsung-remote) The key can be any remote key without the KEY_ at the beginning (e.g. MENU)
 *
 * @return {Characteristic} The key characteristic
 */
function makeKeyCharacteristic() {

    KeyCharacteristic = function () {
        Characteristic.call(this, 'Key', '2A6FD4DE-8103-4E58-BDAC-25835CD006BD');
        this.setProps({
            format: Characteristic.Formats.STRING,
            unit: Characteristic.Units.NONE,
            //maxValue: 10,
            //minValue: -10,
            //minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        //this.value = this.getDefaultValue();
        this.value = "TV";
    };

    inherits(KeyCharacteristic, Characteristic);
}