function runTest() {

    const wiser = require('../src/index')()

    const wiserConfig = {
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
        maxBoost: 19,
    }
    wiser.setConfig(wiserConfig)

    /** NOTE that room changes can be done in 2 ways
     *  either using the `setRoomMode` function that returns a promise
     *  or using the `setRoomMode` event.
     * 
     *  The function version takes standard parameters and returns the updated room information,
     *  the emitter version takes a single settings Object and doesn't return anything.
     */

    /** Change room settings via emitter - you would need a running monitor (or the phone app) 
     *  to see the change take place. See test 005 for another example.
     *  Boost Office temperature for 60 minutes.
     */
    wiser.eventEmitter.emit('setRoomMode',{
        roomIdOrName: 11, // Office
        mode: 'auto',
        //boostTemp: 19.5, 
        boostDuration: 60,
    })

    // This is an expected fail because room id 999 is not valid
    wiser.setRoomMode(999,'auto').then( data => {
        console.info('Test 004a - 999, auto - SHOULD NOT SEE THIS!', data)
    }).catch( err => {
        console.error('Test 004a - 999, auto - FAILED - This is correct (invalid room id):', err)
    })

    // This is an expected fail because mode of "bingo" is not valid
    wiser.setRoomMode('Office','bingo').then( data => {
        console.info('Test 004b - Office, bingo - SHOULD NOT SEE THIS!', data)
    }).catch( err => {
        console.error('Test 004b - Office, bingo - FAILED - This is correct (invalid mode):', err)
    })

    // Manual override, attempt 19.8, will auto-reset to 19 (see settings above)
    wiser.setRoomMode('Office','set', 19.8).then( data => {
        //console.assert( data.lastResult.Mode === 'Auto', `Result should be "Auto" not ${data.lastResult.Mode}` )
        console.info('Test 004c - Office, 19.8 - WORKED, this is correct BUT max temp should be 19.0 (should also see a warning msg):', data)
    }).catch( err => {
        console.error('Test 004c - Office, 19.8 - FAILED, it should have worked:', err)
    })

    // wiser.setRoomMode('Office','auto').then( data => {
    //     console.assert( data.lastResult.Mode === 'Auto', `Result should be "Auto" not ${data.lastResult.Mode}` )
    //     //console.log('auto', data)
    // }).catch( err => {
    //     console.error('Test 004 - SetRoomMode for Office to Auto failed:', err)
    // })

    //wiser.setRoomMode('Office','off')
    //wiser.setRoomMode('Office','manual')
    //wiser.setRoomMode('Office','manual', 19)
    //wiser.setRoomMode('Office','set', 19.8)
}

// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
