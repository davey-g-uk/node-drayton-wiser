/** Create class instance and try to connect */

function runTest() {

    const wiser = require('../src/index')()

    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret:process.env.WISER_SECRET
    })
    //wiser.debug()
    //wiser.testConnection().then( d => {console.log('Connection OK?', d)})

    wiser.get('test')
        .then( res => {
            if ( res.error ) {
                console.warn('TEST 001_a - ERROR:', res.error)
                return false
            } else {
                console.log({res})
                if (res === undefined) {
                    console.warn('TEST 001_a - ERROR: No result')
                    return false
                } else {
                    console.info('TEST 001_a - SUCCESS, if you see this, it is an error!:', res)
                    return true
                }
            }
        })
        .catch( err => {
            console.warn('TEST 001_a - ERROR, Get Failed with invalid service name, this is CORRECT. ', err)
        })

    wiser.get('wifiRSSI')
        .then( res => {
            if ( res.error ) {
                console.warn('TEST 001_b - ERROR:', res.error)
                return false
            } else {
                if (res === undefined) {
                    console.warn('TEST 001_b - ERROR: No result')
                    return false
                } else {
                    console.info('TEST 001_b - SUCCESS, this is what you should see:', res)
                    return true
                }
            }
        })
        .catch( err => {
            console.warn('TEST 001_b - ERROR, if you see this, it is an error!. ', err)
        })

}

// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
