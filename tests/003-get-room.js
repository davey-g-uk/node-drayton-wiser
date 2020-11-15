const wiser = require('../src/index')()

wiser.setConfig({
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
})

wiser.getFull()
.then( fullData => {
    //console.log(fullData)

    // let room = wiser.getRoom(1)    
    // console.log( 'ROOM by id:', room )

    // room = wiser.getRoomByName('Bathroom ')    
    // console.log( 'ROOM by name:', room )

    wiser.doRoomMap()

})


