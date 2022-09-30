function runTest() {

    const wiser = require('../src/index')()

    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
    })

    // Make Call to system and set to away mode (returns system data);
    wiser.setSystemMode('away').then (resp => console.log(resp));

    // Try setting a non-existant mode (should throw error)
    wiser.setSystemMode('home').then (resp => console.log(resp));
}

// Allows us to run either directly or via another node.js script
if (require.main === module) {
    // We are running directly
    runTest()
} else {
    // We are a module in another script
    module.exports = runTest 
}
