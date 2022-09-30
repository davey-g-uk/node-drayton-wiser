function runTest() {

    const wiser = require('../src/index')()

    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret: //process.env.WISER_SECRET,
    })

    // We have to get some data before we can examine the rooms
    wiser.setSystemMode('away').then (resp => console.log(resp));
    
}

// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
