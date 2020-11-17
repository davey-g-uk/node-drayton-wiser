const wiser = require('../src/index')()

wiser.setConfig({
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
})

wiser.getFull()
    .then( fullData => {
        //console.log(fullData)

        //let room = wiser.getRoom(100)  // invalid room id
        let room = wiser.getRoomByName('Office') // Get by name
        //let room = wiser.getRoom(8) // Get by room id (8=Office)
        console.log( 'ROOM by id:', room )

        // room = wiser.getRoomByName('Bathroom ')    
        // console.log( 'ROOM by name:', room )

        //wiser.doRoomMap()

    })


