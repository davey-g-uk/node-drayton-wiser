/** Create class instance and try to connect */

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
            console.log('ERROR:', res.error)
        } else {
            console.log('RESULT:', res)
        }
    })
    // wiser.get does not return a promise fail so no catch is required