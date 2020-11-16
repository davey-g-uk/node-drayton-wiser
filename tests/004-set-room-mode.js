const wiser = require('../src/index')()

const wiserConfig = {
    ip: process.env.WISER_IP,
    secret: process.env.WISER_SECRET,
}
//console.log('Config:', wiserConfig)
wiser.setConfig(wiserConfig)

//console.assert( wiser.setRoomMode(999,'off'), 'This is an expected fail because room id 999 is not valid' )

//console.assert( wiser.setRoomMode('Office','off'), 'This should not have failed' )
//wiser.setRoomMode('Office','off')
//wiser.setRoomMode('Office','auto')
//wiser.setRoomMode('Office','manual')
//wiser.setRoomMode('Office','manual', 19)
wiser.setRoomMode('Office','set', 19.8)
