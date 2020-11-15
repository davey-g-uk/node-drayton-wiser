/** Create class instance and try to connect
 * @see https://github.com/axios/axios#axios
 * 
 * @see https://stackabuse.com/making-asynchronous-http-requests-in-javascript-with-axios/
 * @see https://dev.to/neisha1618/staying-in-sync-with-asynchronous-request-methods-axios-2ilh
 * @see https://stackoverflow.com/questions/46347778/how-to-make-axios-synchronous/46347906
 * 
 * @see https://www.npmjs.com/package/deep-object-diff#updateddiff
 * 
 * @see https://github.com/stringbean/drayton-wiser-client/blob/master/src/WiserClient.ts
 * @see https://github.com/asantaga/wiserheatingapi
 * @see https://github.com/asantaga/wiserheatingapi/blob/master/wiserHeatingAPI/wiserHub.py
 * 
 * @see https://github.com/asantaga/wiserHomeAssistantPlatform#managing-schedules-with-home-assistant
 */

const wiser = require('../src/index')()

wiser.eventEmitter.on('wiserPing', function(ts) { // {'updated': new Date()}
    console.log('wiserPing', ts)
})

/**
 * wiserChange event.
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
wiser.eventEmitter.on('wiserError', function(error) { // {'updated': new Date(), 'error': err}
    console.log('wiserChange event:', error )
})

wiser.setConfig({
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
    interval: 60,
})
//wiser.debug()
//wiser.testConnection().then( d => {console.log('Connection OK?', d)})

wiser.monitor()
