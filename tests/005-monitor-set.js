function runTest() {

    /** Start the monitor function, configure event listeners and send events */

    const wiser = require('../src/index')()

    /** Listen for ping events from all monitors
     * @listens node-drayton-wiser:wiserMonitor#wiserPing
     * @param {number} ts Timestamp (ISO string) of the ping
     */
    wiser.eventEmitter.on('wiserPing', function(ts) {
        console.info('Test 005 - monitor - wiserPing event - timestamp:', ts)
    })

    /** Listens for change events from all monitors
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
        console.info('Test 005 - monitor - wiserChange event - changes:', changes )
    })

    /** Listens for error events from all monitors
     * @listens node-drayton-wiser:wiserMonitor#wiserError
     * @param {Object} error Error data object
     */
    wiser.eventEmitter.on('wiserError', function(error) {
        console.info('Test 005 - monitor - wiserChange event - Error data:', error )
    })

    /** Listens for monitor removal events - you probably don't need to know about these 
     *  Used internally
     * @listens node-drayton-wiser:wiserMonitor#wiserError
     * @param {string} refName Reference name of the monitor being removed
     */
    wiser.eventEmitter.on('wiserMonitorRemoved', function(refName) {
        console.info('Test 005 - monitor - wiserMonitorRemoved event - Monitor name:', refName )
    })

    /** Capture the setInterval reference from a monitor when it starts up - you are very unlikely to need this
     *  Used internally
     * @listens node-drayton-wiser:wiserMonitor#wiserMonitorRef
     * @param {Object} ref setTimeout object reference
     */
    wiser.eventEmitter.on('wiserMonitorRef', function(ref) {
        console.info('Test 005 - monitor - wiserMonitorRef event - setTimeout ref:', ref )
    })


    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
        interval: 15,
        maxBoost: 19,
    })


    // Run the monitor in the background - starts the event system as well
    wiser.monitor('test005')

    // Wait for 30 seconds so that the monitor completes a couple of rounds
    // so that the change event will be correctly reported.
    // You don't need to wait but if you don't, you won't see the result in the monitor
    setTimeout(() => {

        // Manual override, boost for 60 minutes
        wiser.eventEmitter.emit('setRoomMode',{
            roomIdOrName: 11, // Office
            mode: 'auto',
            //boostTemp: 19.5, 
            boostDuration: 60,
        })

        // NB: Could have used wiser.setRoomMode() instead of the event emitter - see test 004 for details.

    }, 30000)

}


// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
