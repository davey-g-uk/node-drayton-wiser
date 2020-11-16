# node-drayton-wiser
A (currently experimental) Node.js module for working with the Drayton Wiser smart heating system.

**Note** that Node.js v10.9 or above is required to run this module.

## Background

The [Wiser](https://wiser.draytoncontrols.co.uk/) smart heating system from Drayton (part of Schneider Electric)
is low-cost and simple to install and use. In addition, it does not purely rely on a cloud service in order to
work. The system will work even without an Internet connection which is critical to home-automation systems.

However, there is no officially published API for interacting with the system. If you want that, you will
most likely want to use the Honeywell Evohome system instead which is more expensive but has a published API
and a more mature ecosystem.

Thankfully though, the Wiser API has been reverse engineered, largely by [Angelo Santagata](https://github.com/asantaga). 
You can find the documentation in his [wiserHeatingAPI repository on GitHub](https://github.com/asantaga/wiserheatingap).

This Node.js module is my attempt to create some simple-to-use tools for working with the system in Node.js

I also have an older write-up of [using the Wiser system on my blog](https://it.knightnet.org.uk/kb/nr-qa/drayton-wiser-heating-control). 
This tells you how to obtain the API secret that you need in order to work with the API.

There is also another Node.js Wiser client - [drayton-wiser-client](https://github.com/stringbean/drayton-wiser-client), 
though that is written using TypeScript and does not quite cover the use cases that I want.
Still, many thanks to [Michael Stringer](https://github.com/stringbean) for referencing me in his module.

## Usage

Install the usual way using npm.

Example code:

```javascript
// Creates a singleton closure
const wiser = require('node-drayton-wiser')()

/** Listen for ping events - see the interval setting that defines the frequence of updates
 *  This happens every time the monitor function successfully gets data from the controller
 */
wiser.eventEmitter.on('wiserPing', function(ts) { // {'updated': new Date()}
    console.log('wiserPing', ts)
})

/** wiserChange event - fired by the monitor function on each interface IF a relavent change is seen
 * Allows you to just monitor for changes to important things.
 * Ignores, controller timestamps and changes to device signal stregth which are too common.
 *
 * @listens node-drayton-wiser:wiserMonitor#wiserChange
 * @param {object} changes - Changes data for wiserChange event
 * @param {Date} changes.updated - JavaScript timestamp of the detection of the change
 * @param {string} changes.type - The type of change (e.g. Device, Room, etc)
 * @param {string|number} changes.idx - The index of the thing that has changed in the type array
 * @param {string|number} changes.id - The ID of the thing that has changed
 * @param {Object} changes.data - The changed data
 * @param {string} [changes.name] - Room name (only for Room changes)
 */
wiser.eventEmitter.on('wiserChange', function(changes) { // {'updated': new Date(), 'type': type, 'ID': id, 'Changes': data}
    console.log('wiserChange event:', changes )
})

/** Listen for an error event from the monitor function */
wiser.eventEmitter.on('wiserError', function(error) { // {'updated': new Date(), 'error': err}
    console.log('wiserChange event:', error )
})

/** Set the configuration `ip` and `secret` are required 
 * To obtain the secret from your controller:
 * @see https://it.knightnet.org.uk/kb/nr-qa/drayton-wiser-heating-control/
*/
wiser.setConfig({
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
    interval: 60, // Only needed for the monitor function
})

/** Trigger the monitor function, use the event listeners to get output
 * The interval config variable defines how often (in seconds), updates will be checked
 */
wiser.monitor()
```

## Functions

The module supports the following functions.

### setConfig

Sets the configuration for connecting to your controller

### monitor

Starts a repeating monitor that gets the full data from the controller.

In addition it fires one or more events as follows. Connect to `wiser.eventEmitter` to listen for the events (see [usage](#usage) above).

* `wiserPing`
* `wiserChange`
* `wiserError`

### eventEmitter

The Node.js event emmitter used for firing and listening to events from the monitor function.

### testConnection

A quick connection test. Call `setConfig` first.

### get

Return any known section of the data from the controller. 

The following data sections are understood:

* **network**: `/data/network/`, Controller's network info including curr/max/min WiFi signal strength
* **wifiRSSI**: `/data/network/Station/RSSI/`,

* **full**: `/data/domain/`,  All of: System, Cloud, HeatingChannel, Room, Device, Zigbee, UpgradeInfo, SmartValve, RoomStat, DeviceCapabilityMatrix, Schedule

* **brandName**: `/data/domain/System/BrandName/`, Used for quick check of valid connection, always returns 'WiserHeat'
* **devices**: `/data/domain/Device/`,
* **heating**: `/data/domain/HeatingChannel/`,
* **rooms**: `/data/domain/Room/`,
* **roomStats**: `/data/domain/RoomStat/`,
* **schedules**: `/data/domain/Schedule`,
* **system**: `/data/domain/System/`,
* **trvs**: `/data/domain/SmartValve/`,

### getFull

Gets the full `/data/domain/` JSON. Returns a Promise. Also updates the saved data and recreates the room to device map.

The following functions can only be used from within the `.then` function of getFull otherwise the `saved` variable 
containing the latest data from the controller is not populated.

#### getRoom
#### getRoomByName
#### getRoomStat
#### doRoomMap

### setRoomMode

Set a specified room to a particular mode ('manual', 'set', 'boost', 'auto', 'off').

* _Manual_: Turn off schedule and set to highest of boost Temperature and current scheduled setpoint
* _Set_:    Set to boost temperature but leave schedule active, will reset on next scheduled change
* _Boost_:  Boost to given temperature for given amount of time
* _Off_:    Turn off schedule and set temperature to -200
* _Auto_:   Return room to set schedule and current scheduled temperature

Default boost setPoint for Boost, Manual and Set is (20°C)

## To Do

* Add set functions
  * Started, setRoomMode is now available
  
* Add save/load schedule functions
  
  Allow save/load to/from file as well as to/from JSON

* On change limit any boost/manual overrides (from real app) to a given max (stop people setting to silly temperatures)
  
* Reset all boosts/manual overrides at given time of day (stop people turning on boost when they go to bed!)

* Output added/deleted items not just updated?