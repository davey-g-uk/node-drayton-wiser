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

See the tests folder of this module for more examples including how to change room overrides.

```javascript
// Creates a singleton closure
const wiser = require('node-drayton-wiser')()

/** Listen for ping events - see the interval setting that defines the frequence of updates
 *  This happens every time the monitor function successfully gets data from the controller
 * @listens node-drayton-wiser:wiserMonitor#wiserPing
 * @param {Object} pingData Timestamp (ISO string), name and initial run flag of the ping
 */
wiser.eventEmitter.on('wiserPing', function(pingData) {
    console.log('wiserPing', pingData)
})

/** wiserChange event - fired by the monitor function on each interface IF a relavent change is seen
 * Allows you to just monitor for changes to important things.
 * Ignores, controller timestamps and changes to device signal stregth which are too common.
 * @listens node-drayton-wiser:wiserMonitor#wiserChange
 * @param {object} changes - Changes data for wiserChange event
 * @param {Date} changes.updated - JavaScript timestamp of the detection of the change
 * @param {string} changes.type - The type of change (e.g. Device, Room, etc)
 * @param {string|number} changes.idx - The index of the thing that has changed in the type array
 * @param {string|number} changes.id - The ID of the thing that has changed
 * @param {Object} changes.data - The changed data
 * @param {string} [changes.name] - Room name (only for Room changes)
 */
wiser.eventEmitter.on('wiserChange', function(changes) {
    console.log('wiserChange event:', changes )
})

/** Listen for an error event from the monitor function
 * @listens node-drayton-wiser:wiserMonitor#wiserError
 * @param {Object} error Error data object
 */
wiser.eventEmitter.on('wiserError', function(error) {
    console.log('wiserError event:', error )
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

Starts a repeating monitor that gets the full data from the controller. Since the monitor uses the asynchronous features
of JavaScript, it can be started and left running in your own script as shown in the example [above](#usage).

#### Example use

```javascript
const wiser = require('node-drayton-wiser')()

wiser.eventEmitter.on('wiserPing', function(pingData) {
    console.log('wiserPing', pingData)
})

wiser.eventEmitter.on('wiserChange', function(changes) {
    console.log('wiserChange event:', changes )
})
wiser.eventEmitter.on('wiserError', function(error) {
    console.log('wiserChange event:', error )
})

// Set configuration
wiser.setConfig({
    // Pass the IP and secret of the controller hub using environment variables
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
    // Run the getFull() every 15s (otherwise, defaults to 60s)
    interval: 15,
    // Max temp (°C) allowed for boost/manual override (defaults to max allowed temp of 30°C)
    maxBoost: 19,
})

// Start the monitor loop and event emitters
// Note that running again with the same monitor name will restart the monitor
// It takes 2 intervals before any change events are registered.
wiser.monitor(refMonitor)

// Example of stopping the monitor after 60 seconds
setTimeout(() => {
    console.warn('clearing monitors')

    // Cancel automatically after 20s
    wiser.removeMonitor(refMonitor)
}, 60000)
```

### removeMonitor('monitorName')

Remove (cancel) the specified monitor.

### eventEmitter

The Node.js event emmitter used for firing and listening to events from the module.

See the examples given above in the [monitor](#monitor) section for details.
Also see the `tests` folder.

#### Output Events - monitor

The events are only output by the monitor function. They should not be output by anything else.

When a change is detected by the monitor it fires one or more events as follows. Connect to `wiser.eventEmitter` to listen for the events (see [usage](#usage) above).

* `wiserPing` - Always emitted whenever the controller hub is successfully queried.
* `wiserChange` - Emitted when a change is detected. May be emitted multiple times for each pass.
* `wiserError` - Emitted when a connection to the controller fails or when the query fails.
* `wiserMonitorRef` - Emitted when the monitor() function creates its setTimeout loop.

#### Output Events - other

* `wiserMonitorRemoved` - Output if a monitor is restarted or if the `[removeMonitor](#removemonitor)` function is called.
#### Input Events

The module also automatically listens for the following events:

* `setRoomMode` - Sets/cancels schedule overrides for the specified room.
  
  Must provide a data object that matches the parameter object of the `[setRoomMode](#setroommode)` function.

  Example use:

  ```javascript
    const wiser = require('node-drayton-wiser')()

    const wiserConfig = {
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
        maxBoost: 22,
    }
    wiser.setConfig(wiserConfig)

    /** Change room settings via emitter - you would need a running monitor (or the phone app) 
     *  to see the change take place. See test 005 for another example.
     *  Boost Office temperature for 60 minutes.
     */
    wiser.eventEmitter.emit('setRoomMode',{
        roomIdOrName: 'Office',
        mode: 'boost',
        boostTemp: 21.5, // optional for 'boost'
        boostDuration: 60,
    })
  ```

* `wiserMonitorRef` - Tracks running monitors to allow them to be
  cancelled using the `[removeMonitor](removemonitor)` function.

  You can add other event listeners of your own against this event.

  The event returns a reference to the setTimeout (loop) of the monitor
  so it really isn't that useful.

### setRoomMode

Set a specified room to a particular mode ('manual', 'set', 'boost', 'auto', 'off').

* _Manual_: Turn off schedule and set to highest of boost Temperature and current scheduled setpoint
* _Set_:    Set to boost temperature but leave schedule active, will reset on next scheduled change
* _Boost_:  Boost to given temperature for given amount of time
* _Off_:    Turn off schedule and set temperature to -200
* _Auto_:   Return room to set schedule and current scheduled temperature

Default boost setPoint for Boost, Manual and Set is (20°C). Set the maxBoost setting if you want
to limit the maximum temperature (if not set, defaults to the system max. of 30°C).

You can either use a single parameter object with the structure:

```jsonc
{
    "roomIdOrName": "Office",
    "mode": "boost",
    "boostTemp": 19.5, // optional for 'boost'
    "boostDuration": 60,
}
```

Or call with positional parameters:

```javascript
wiser.setBoostMode(roomIdOrName, mode, boostTemp, boostDuration)
```

The function returns a Promise.

The room mode can also be set by emitting the `setRoomMode` event with the same parameter object as above
(that event actually calls this function).

Example use:

```javascript
const wiser = require('node-drayton-wiser')()

const wiserConfig = {
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
    maxBoost: 22,
}
wiser.setConfig(wiserConfig)
// Manual override, attempt 22.8, will auto-reset to 22 (see settings above)
wiser.setRoomMode('Office','set', 22.8).then( data => {
    console.info('Office, 22.8 - WORKED, this is correct BUT max temp should be 22.0 (should also see a warning msg):', data)
}).catch( err => {
    console.error('Test 004c - Office, 22.8 - FAILED, it should have worked:', err)
})

```


### setMaxBoost

Sets the maximum temperature (in °C) allowed for any manual, boost, or scheduled temperature.

When temperature is set from this module, the input is changed to this maximum if needed.

The following is not yet completed: When set from a schedule or the mobile app, the next iteration of the monitor (if running) will reset the max. temperature.

### setBoostCancelTime

Not yet completed.

### setFolder

Not yet completed.

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

Gets the latest data about the given room ID (numeric).

#### getRoomByName

Gets the latest data about the given room name (string).
#### getRoomStat

Not yet completed.

## To Do

* Add set functions
  * [x] `setRoomMode` - set/reset room temperature/boost overrides
  * [x] `setMaxBoost` - Set max boost level (will auto-change boosts to max if set higher)
  * [x] `setBoostCancelTime` - Set auto-cancel overrides - set a time that will reset all rooms back to current schedule
  * [x] `setFolder` - set the folder to use for schedule files
  * [x] `removeMonitor` - Remove a monitor function by given monitor name, fires `wiserMonitorRemoved` event
  * [ ] Cancel all boost/reset all rooms to current schedule
  * [ ] Upload/change schedule, apply schedule id to room
  
* Add save/load schedule functions
  Allow save/load to/from file as well as to/from JSON
  * [ ] `saveAllSchedules`
  * [ ] `saveSchedule`
  
* Reset all boosts/manual overrides at given time of day (stop people turning on boost when they go to bed!)

* Monitor function:
  * [x] Add default ref name to monitor function
  * [x] Allow cancellation/removal of a monitor
  * [x] If trying to create an existing monitor name, cancel and re-create
  * [ ] Output added/deleted items not just updated?
  * [ ] On change, limit any boost/manual overrides (from real app) to a given max (stop people setting to silly temperatures) - currently only implemented for this modules set functions.

* Additional general settings
  * [x] default file location (for schedule files) `{string}`
  * [x] max boost temperature `{number}`
  * [x] Boost cancel time `{String|null}`