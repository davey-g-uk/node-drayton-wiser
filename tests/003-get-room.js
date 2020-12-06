function runTest() {

    const wiser = require('../src/index')()

    wiser.setConfig({
        ip: process.env.WISER_IP,
        secret: process.env.WISER_SECRET,
    })

    // We have to get some data before we can examine the rooms
    wiser.getFull()
        .then( fullData => {
            //console.log(fullData)

            let room

            // Get a valid room by id
            room = wiser.getRoom(8) // Get by room id (8=Office)
            console.log( 'ROOM by id (8):', room )

            // Try an invalid room id
            room = wiser.getRoom(100)  // invalid room id
            console.log( 'Invalid ROOM id (100):', room )

            // Get a room by a valid name
            room = wiser.getRoomByName('Office') // Get by name
            console.log( 'ROOM by name (Office):', room )

            // Get a room by an invalid name
            room = wiser.getRoomByName('Narnia')    
            console.log( 'Invalid ROOM by name (Narnia):', room )

            //wiser.doRoomMap()

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
