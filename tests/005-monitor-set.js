/** Start the monitor function, configure event listeners and send events */

const wiser = require('../src/index')()

wiser.eventEmitter.on('wiserPing', function(ts) {
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
wiser.eventEmitter.on('wiserChange', function(changes) {
    console.log('wiserChange event:', changes )
})
wiser.eventEmitter.on('wiserError', function(error) {
    console.log('wiserChange event:', error )
})

wiser.setConfig({
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
    interval: 15,
})

// Capture the setInterval reference from the monitor fn
// so that it can be cancelled if required
// wiser.eventEmitter.on('wiserMonitorRef', function(ref) {
//     setTimeout(() => {
//         console.warn('clearing timeout')
//         // Cancel automatically after 20s
//         clearInterval(ref)
//         // maybe restart the monitor as well?
//         // Of course, this will create an endless loop cancelling/restarting every 20s
//         //wiser.monitor()
//     }, 20000)
// })

// Run the monitor in the background - starts the event system as well
wiser.monitor('test002')

// Wait for 30 seconds so that the monitor completes a couple of rounds
// so that the change event will be correctly reported.
// You don't need to wait but if you don't, you won't see the result in the monitor
setTimeout(() => {
    wiser.eventEmitter.emit('setRoomMode',{
        roomIdOrName: 11, 
        mode: 'auto',
        //boostTemp: 19.5, 
        boostDuration: 60,
    })
}, 30000)
