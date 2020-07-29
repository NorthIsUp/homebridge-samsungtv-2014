#homebridge-samsungtv-2014

Samsung TV plugin for [Homebridge](https://github.com/nfarina/homebridge)

This plugin allows you to control your Samsung TV (models until 2014) with HomeKit and Siri.

## Installation
1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-samsungtv-control`
3. Update your configuration file. See the sample below.

## Configuration
Example config.json:

```js
    "accessories": [
		{
			"accessory": "SamsungTV",
			"name": "TV Living room",
			"ip_address": "192.168.1.2",
            "send_delay": 400
		}
	],
```

### Explanation:

Field           | Description
----------------|------------
**accessory**   | Must always be "SamsungTV2014". (required)
**name**        | The name you want to use to control the TV.
**ip_address**  | The internal ip address of your samsung TV.  Sould be static or DHCP reserved
**send_delay**  | When switching to another channel the individual keys will be send with a short delay (in ms) between them. (default 400)
**use_fan**     | Use fan accessory type for volume control.  (Prevents setting light brightness from increasing volume).

## Installation

Example config is below.
```
{
	"bridge": {
		"name": "Homebridge",
		"username": "CD:21:3D:E3:CE:38",
		"port": 51826,
		"pin": "031-45-154"
	},
	"description": "This is an example configuration for the Samsung TV 2014 homebridge plugin",

	"accessories": [
		{
			"accessory": "SamsungTV",
			"name": "TV living room",
			"ip_address": "192.168.1.2"
		}
	],
	"platforms": [

	]
}
```
## Usage

The first numeric characteristic represents the volume. When changing the volume characteristic the number represents the count of times the volume up or down key will be triggered. In other words to increase the volume by 3 units, the characteristic should be set to 3, to decrease the volume by 2 units e.g. the value would be -2. By setting volume to 0 the mute key will be triggered.

The next characteristic represents the channel. To set a channel just set up a scene with the numeric value of the channel.

The last characteristic allows sending any key from [this list](https://github.com/natalan/samsung-remote#remote-keys) without the `KEY_` at the beginning. To send the pre-channel key e.g. set up a scene where this characteristic will be set to `PRECH`.

## Limitations

The volume, channel and key characteristics send single keys with a short delay between them to accomplish their task. Therefore to set these characteristics values you should set up a scene with the desired value in the corresponding characteristics so that not every single change will be send before you've finished typing.  
Since some Samsung TV's will disconnect from the network when turned off it is not possible to turn them back on again over network.
Furthermore it is not possible to observe current values such as the volume or the channel. Therefore only channel changes that where made through this plugin will be tracked (channel changes with the regular remote for example can not be tracked).

### Newer Samsung TV's (from 2014)
Only Samsung TV's until 2014 are supported by this plugin because Samsung dropped the old remote control protocol from their newer tv series.  For newer TV support, other plugins are readily available.

### Credits
This plugin was resurrected/updated from the original [Samsung TV Control plugin](https://github.com/mmende/homebridge-samsungtv-control) because I still like my old Samsung TV.
  