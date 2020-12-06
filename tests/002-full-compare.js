function runTest() {
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

    /** Listen for ping events - so we know that the monitor loop is working */
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
    /** Listen for any errors in the monitor loop */
    wiser.eventEmitter.on('wiserError', function(error) { // {'updated': new Date(), 'error': err}
        console.log('wiserChange event:', error )
    })
    /** Listen for if a named monitor is removed */
    wiser.eventEmitter.on('wiserMonitorRemoved', function(ref) {
        console.log('wiserMonitorRemoved event:', ref )
    })

    /** Set things up */
    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
        interval: 15,
    })
    //wiser.debug()
    //wiser.testConnection().then( d => {console.log('Connection OK?', d)})

    /** Give the monitor a reference ID */
    let refMonitor = 'test002'

    /** Start the monitor loop, checks for changes every `interval`
     *  seconds. The `wiserChange` event is fired on every change.
     *  NB: If you run this again with the same ref ID, the monitor will restart.
     */
    wiser.monitor(refMonitor)

    /** Wait for 20 seconds and then kill the monitor */
    setTimeout(() => {
        console.warn('clearing monitors')
        wiser.removeMonitor(refMonitor)
    }, 20000)

}

// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
