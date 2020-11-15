/*
  Copyright (c) 2020 Julian Knight (Totally Information)

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
'use strict'

const http = require('http')
const axios = require('axios').default /** @see https://github.com/axios/axios */
//const { diff, addedDiff, deletedDiff, detailedDiff, updatedDiff } = require('deep-object-diff')
const { updatedDiff } = require('deep-object-diff') /** @see https://www.npmjs.com/package/deep-object-diff#updateddiff */
const { EventEmitter } = require('events')

/** Closure to access a Drayton Wiser controller API
 * Use as `const Wiser = require('node-drayton-wiser'); const wiser = new Wiser({ip:process.env.WISER_IP,secret:process.env.WISER_SECRET})`
 * @return {Object} Public interfaces
 */
const Wiser = function() {
    //#region ---- Private Variables ---- //

    /** URL paths to specific controller data */
    const servicePaths = {
        network: '/data/network/', // Controller's network info including curr/max/min WiFi signal strength
        wifiRSSI: '/data/network/Station/RSSI/',

        full: '/data/domain/',  // System, Cloud, HeatingChannel, Room, Device, Zigbee, UpgradeInfo, SmartValve, RoomStat, DeviceCapabilityMatrix, Schedule

        brandName: '/data/domain/System/BrandName/', // Used for quick check of valid connection, always returns 'WiserHeat'
        devices: '/data/domain/Device/',
        heating: '/data/domain/HeatingChannel/',
        rooms: '/data/domain/Room/',
        roomStats: '/data/domain/RoomStat/',
        schedules: '/data/domain/Schedule',
        system: '/data/domain/System/',
        trvs: '/data/domain/SmartValve/',
    }

    const settings = {
        /** Interval between calls to get the full Controller data and calculate diffs
         * @type {number} Integer seconds
         */
        interval: 60,
    }

    /** Default configuration for Axios promised-based http request handler
     * @see https://github.com/axios/axios#request-config
     * @type {import('axios').AxiosRequestConfig}
     */
    const axiosConfig = {
        //url: undefined,
        //baseURL: undefined,
        //method: undefined,
        headers: {
            'SECRET': undefined,
            'Content-Type': 'application/json;charset=UTF-8',
        },
        httpAgent: new http.Agent({ keepAlive: true }),
    }

    /** Keep track of whether the last connection was OK 
     * @type {boolean}
     */
    let connectionOK = false

    let dataDiff = {}
    let prev = {}

    //#endregion ---- Private Variables ---- //


    //#region ---- Public Functions ---- //

    const eventEmitter = new EventEmitter()

    /** Test whether the given options are valid by making a quick connection
     * @return {Promise} Resolves to true or false
     */
    const testConnection =  () => {
        if (!axiosConfig.baseURL || !axiosConfig.headers.SECRET) {
            throw Error ('[node-drayton-wiser] both IP and SECRET must be provided before testing the connection, call setConfig first')
        }

        // Make a request
        const fin =  axios.get(servicePaths.brandName, axiosConfig)
            .then(function (response) {
                connectionOK = response.data === 'WiserHeat'
                //console.log('Valid connection? ', connectionOK);
                return connectionOK
            })
            .catch(function (error) {
                connectionOK = true
                console.error(error)
                return error
            })
                
        return fin
    }

    /** Set the configuration to be used
     * @param {Object} config IP address and API secret key of controller
     * @param {string} config.ip IP address of Wiser controller
     * @param {string} config.secret API secret key for accessing the controller
     * @param {number} [config.interval] Optional. Scan interval in seconds. Defaults to 60s
     */
    const setConfig = ({ip, secret, interval=settings.interval}) => {
        //console.log({ip, secret, interval})

        if (!ip || !secret) {
            //console.error('[node-drayton-wiser] both IP and SECRET must be provided')
            console.log({ip, secret, interval})
            throw Error ('[node-drayton-wiser] both IP and SECRET must be provided')
        }

        if (typeof interval === 'number') settings.interval = interval
        else console.warn('[node-drayton-wiser] interval config ignored, it must be a number')

        axiosConfig.baseURL = `http://${ip}`
        axiosConfig.headers.SECRET = secret

    } // --- End of setConfig --- //

    /** Output debugging info
     * @param {boolean} [doDebug] Output debugging info to console. Optional, default=false
     */
    const debug = (doDebug=false) => {
        if (doDebug) {
            console.log('CONFIGURATION:', {settings,axiosConfig,servicePaths})
        }
    }

    /** Get the current controller data for a given service */
    const get = async (service) => {
        const ServiceNames = Object.keys(servicePaths)
        let out = {}

        if ( !ServiceNames.includes(service) ) {
            console.error(`[node-drayton-wiser] Invalid service name: ${service}, must be one of: [${ServiceNames.join(', ')}]`)
            out[service] = undefined
            return out
        }

        if (!axiosConfig.baseURL || !axiosConfig.headers.SECRET) {
            throw Error ('[node-drayton-wiser] both IP and SECRET must be provided before testing the connection, call setConfig first')
        }

        // Make a request
        const fin =  axios.get(servicePaths[service], axiosConfig)
            .then(function (response) {
                connectionOK = true
                out[service] = response.data
                return out
            })
            .catch(function (error) {
                connectionOK = true
                //console.error(error)
                //console.warn(`SERVICE: ${service}, PATH: ${servicePaths[service]}`)
                //return error
                return { error: {
                    'service': service,
                    'servicePath': error.config.url, //servicePaths[service],
                    'status': error.response.status,
                    'statusText': error.response.statusText,
                    'response_data': error.response.data
                }}
            })
                
        return fin

    }

    const getFull = () => {
        return axios.get(servicePaths['full'], axiosConfig)
            .then( res => {
                return res.data
            })
            .catch(error => {
                console.error(error)
                return {'error': error}
            })
    } // ---- end of getFull ---- //

    const monitor = () => {
        /** Get initial full data from Wiser Controller */
        getFull()
        .then( res => {

            /** We are not interested in the controllers timestamp changes */
            delete res.System.UnixTime
            delete res.System.LocalDateAndTime

            /** This is first run so just save a previous entry */
            prev = res

            /** Set up repeating call to get the full data from the Wiser Controller
             * Runs every `interval` milliseconds
             */
            setInterval(() => {
                
                /** 
                 * Get full data from the Wiser Controller
                 * @fires wiserGetFull#wiserPing
                 * @fires wiserGetFull#wiserChange
                 * @fires wiserGetFull#wiserError
                */
                getFull()
                .then( res => {
                        /**
                         * wiserPing event. Emitted after getting a full update from the controller.
                         *
                         * @event wiserMonitor#wiserPing
                         * @type {object}
                         * @property {Date} updated - JavaScript timestamp of the detection of the change
                         */
                        eventEmitter.emit('wiserPing', {'updated': new Date()} )

                        /** We are not interested in the controllers timestamp changes */
                        delete res.System.UnixTime
                        delete res.System.LocalDateAndTime

                        /** If prev variable is empty, just save a previous entry and exit */
                        if ( !prev ) {
                            prev = res
                            return
                        }

                        /** What has changed?
                         * @see https://www.npmjs.com/package/deep-object-diff#updateddiff
                         */
                        dataDiff = updatedDiff(prev, res)

                        /** Deconstruct the differences and emit as individual events */
                        Object.keys(dataDiff).forEach( type => {
                            let item = dataDiff[type]
                            Object.keys(item).forEach( i => {
                                let data = item[i]

                                delete data.ReceptionOfController
                                delete data.ReceptionOfDevice
                                delete data.PendingZigbeeMessageMask

                                if (Object.values(data).length > 0 ) {
                                    /**
                                     * Data for wiserChange event.
                                     *
                                     * @type {object}
                                     * @property {Date} updated - JavaScript timestamp of the detection of the change
                                     * @property {string} type - The type of change (e.g. Device, Room, etc)
                                     * @property {string|number} idx - The index of the thing that has changed in the type array
                                     * @property {string|number} id - The ID of the thing that has changed
                                     * @property {Object} data - The changed data
                                     * @property {string} [name] - Room name (only for Room changes)
                                     */
                                    let changes = {
                                        'updated': new Date(), 
                                        'type': type, 
                                        'idx': i,
                                        'ID': res[type][i].id, 
                                        'changes': data, 
                                    }
                                    if (type === 'Room') changes.name = res[type][i].Name

                                    /**
                                     * wiserChange event. Emitted after getting a full update from the controller when something has changed from the previous update.
                                     *
                                     * @event wiserMonitor#wiserChange
                                     * @type {object}
                                     * @property {Date} updated - JavaScript timestamp of the detection of the change
                                     * @property {string} type - The type of change (e.g. Device, Room, etc)
                                     * @property {string|number} idx - The index of the thing that has changed in the type array
                                     * @property {string|number} id - The ID of the thing that has changed
                                     * @property {Object} data - The changed data
                                     * @property {string} [name] - Room name (only for Room changes)
                                     */
                                    eventEmitter.emit('wiserChange', changes)
                                }
                            })
                        })

                        prev = res
                    })
                    .catch( err => {
                        console.error(err)
                        /**
                         * wiserError event. Emitted if failed attempt at contacting the controller.
                         *
                         * @event wiserMonitor#wiserError
                         * @type {object}
                         * @property {Date} updated - JavaScript timestamp of the detection of the change
                         * @property {Object} error - The returned error object
                         */
                        eventEmitter.emit('wiserError', {'updated': new Date(), 'error': err} )
                    })

            }, settings.interval * 1000 ) // --- End of setInterval --- //

        })
        .catch( err => {
            console.error(err)
            /**
             * wiserError event. Emitted if failed attempt at contacting the controller.
             *
             * @event wiserMonitor#wiserError
             * @type {object}
             * @property {Date} updated - JavaScript timestamp of the detection of the change
             * @property {Object} error - The returned error object
             */
            eventEmitter.emit('wiserError', {'updated': new Date(), 'error': err} )
        })

    } // --- End of monitor() --- //

    //#endregion ---- Public Functions ---- //

    /** Closure pattern - only expose what we want to, uses object deconstruction */
    return ({
        // Public interfaces
        setConfig,
        debug,
        testConnection,
        get,
        getFull,
        monitor,
        eventEmitter,
    }) // --- End of closure --- //

} // ---- End of class ---- //

module.exports = Wiser

//EOF