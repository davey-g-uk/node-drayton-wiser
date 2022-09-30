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

/** Minimum allowed setpoint temperature (°C) 
 * @type {number}
 */
const TEMP_MINIMUM = 5
/** Maximum allowed setpoint temperature (°C) 
 * @type {number}
 */
const TEMP_MAXIMUM = 30
/** Wiser "off" setpoint temperature (°C) 
 * @type {number}
 */
const TEMP_OFF = -20
/** Default setpoint temperature for room boost override (°C) 
 * @type {number}
 */
const BOOST_DEFAULT_TEMP = 20
/** Default duration for room boost override (minutes)
 * @type {number}
 */
const BOOST_DEFAULT_DURATION = 30
/** Default monitor loop interval (seconds)
 * @type {number}
 */
const MONITOR_LOOP_INTERVAL = 60

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

    const SystemOverrideType = {
        normal : 0,
        away: 2,
        bootAllRooms: 4,
        cancelAllOverrides: 5
    }

    const settings = {
        /** Interval between calls to get the full Controller data and calculate diffs
         * @type {number} Integer seconds
         */
        interval: MONITOR_LOOP_INTERVAL,
        /** Filing system folder to use for schedule files. Defaults to current working folder (cwd)
         * @type {string}
         */
        folder: '',
        /** Max temperature (°C) allowed for boost/manual temperatures
         * @type {number}
         */
        maxBoost: BOOST_DEFAULT_TEMP,
        /** Time at which all overrides will be cancelled (daily) "HH:mm" (24hr)
         * @type {string|null}
         */
        boostCancelTime: null,
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

    /** latest diff between new and previous full data used in monitor() */
    let dataDiff = {}
    /** current full data - set in getFull() */
    let saved = undefined
    /** previous full data - set in monitor() */
    let prev = undefined
    /** current device-to-room map - rebuilt from getFull() in doRoomMap() */
    let roomMap = {}
    /** Track started monitors */
    let wiserMonitorRefs = {}

    //#endregion ---- Private Variables ---- //

    //#region ---- Private Functions ---- //

    /** Convert from °C to wiser temperature
     * @param {number} degC Value to convert in °C
     * @return {number} °C converted to wiser temperature (x10)
     */
    const toWiserTemp = (degC) => {
        return degC*10
    }

    /** Convert from wiser temperature to °C
     * @param {number} temp Value to convert in wiser temperature (c x 10)
     * @return {number} wiser temperature converted to °C (/10, 1DP)
     */
    const fromWiserTemp = (temp) => {
        return parseFloat((temp/10).toFixed(1))
    }

    const wiserErrorResult = (error, service='') => {
        return { error: {
            'response_data': error.response.data,
            'service': service,
            'servicePath': error.config.url,
            'status': error.response.status,
            'statusText': error.response.statusText,
            'responseUrl': error.request.res.responseUrl,
            'axiosBaseUrl': axiosConfig.baseURL,
        }}
    }

    //#endregion ---- Private Functions ---- //

    const getRoom = (roomId) => {
        //console.log('SAVED:', Object.keys(saved))
        //console.log('SAVED #rooms:', saved.Room.length)
        let rooms = []
        rooms = saved.Room.filter( room => {
            return room.id === roomId
        })
        if ( rooms.length < 1 ) {
            console.warn(`[node-drayton-wiser:getRoom] Room ID ${roomId} not found.`)
            return null
        }
        if ( rooms.length > 1 ) {
            console.warn(`[node-drayton-wiser:getRoom] Room ID ${roomId} not unique! ${rooms.length} found.`)
        }
        // Only return the first entry
        return rooms[0]
    }

    const getRoomByName = (roomName) => {
        let rooms = []
        rooms = saved.Room.filter( room => {
            return room.Name === roomName
        })
        if ( rooms.length < 1 ) {
            console.warn(`[node-drayton-wiser:getRoom] Room name --${roomName}-- not found.`)
            return null
        }
        if ( rooms.length > 1 ) {
            console.warn(`[node-drayton-wiser:getRoom] Room name --${roomName}-- not unique! ${rooms.length} found.`)
        }
        // Only return the first entry
        return rooms[0]
    }

    const getRoomStat = (roomStatId) => {
        
    }

    const getTRV = (trvid) => {
        
    }

    /** Return the refs for a given monitor name or return undefined if not found
     * @param {string} refName Name of the monitor reference to search for
     * @return {Object|undefined} Either undefined or a reference to the setInterval fn
     */
    const getMonitorRef = (refName) => {
        try{
            return wiserMonitorRefs[refName]
        } catch {
            return undefined
        }
    }

    /** Rebuild the roommap (device id => room) */
    const doRoomMap = () => {
        roomMap = {}
        saved.Room.forEach( room => {

            // SmartValves
            if ( room.SmartValveIds ) {
                room.SmartValveIds.forEach( trvId => {
                    roomMap[trvId] = {'roomId': room.id, 'roomName': room.Name, 'type': 'SmartValve'}
                })
            }
            // RoomStats
            if ( room.RoomStatId ) {
                roomMap[room.RoomStatId] = {'roomId': room.id, 'roomName': room.Name, 'type': 'RoomStat'}
            }
            // plugs
            // I don't have any - so this is guesswork - let me know whether it is right or wrong
            if ( room.SmartPlugIds ) {
                room.SmartPlugIds.forEach( plugId => {
                    roomMap[plugId] = {'roomId': room.id, 'roomName': room.Name, 'type': 'SmartPlug'}
                })
            }
        })

        //console.log('roomMap: ', roomMap)
    }

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

    /** Set the initial configuration to be used
     * @param {Object} config IP address and API secret key of controller + other settings if needed
     * --- These HAVE to be set up front and cannot be changed later ---
     * @param {string} config.ip IP address of Wiser controller
     * @param {string} config.secret API secret key for accessing the controller
     * @param {number} [config.interval] Optional. Scan interval in seconds. Defaults to 60s
     * --- The remainder can be set on initial settings or subsequently (see the setXxxx functions) ---
     * @param {string} [config.folder] Optional. Filing system folder to use for schedule files. Defaults to current working folder (cwd)
     * @param {number} [config.maxBoost] Optional. Max temperature (°C) allowed for boost/manual temperatures
     * @param {string|null} [config.boostCancelTime] Optional. Time at which all overrides will be cancelled (daily) "HH:mm" (24hr)
     */
    const setConfig = ({ip, secret, interval=settings.interval, folder=undefined, maxBoost=undefined, boostCancelTime=undefined}) => {
        //console.log({ip, secret, interval})

        // must both be provided
        if (!ip || !secret) {
            //console.error('[node-drayton-wiser] both IP and SECRET must be provided')
            console.log({ip, secret, interval})
            throw Error ('[node-drayton-wiser] both IP and SECRET must be provided')
        }

        if (typeof interval === 'number' && isFinite(interval) ) settings.interval = interval
        else console.warn('[node-drayton-wiser] interval config ignored, it must be a number')

        axiosConfig.baseURL = `http://${ip}`
        axiosConfig.headers.SECRET = secret

        // Validate maxBoost & save to settings
        if ( folder ) setFolder(folder)
        if ( maxBoost ) setMaxBoost(maxBoost)
        if ( boostCancelTime ) setBoostCancelTime(boostCancelTime)

    } // --- End of setConfig --- //

    const setFolder = (folder='') => {
        //TODO check for valid folder name
        if ( folder === '' ) folder = process.cwd()
        settings.folder = folder
        return folder
    }

    const setMaxBoost = (maxBoost=TEMP_MAXIMUM) => {
        // Validate maxBoost & save to settings
        if ( typeof maxBoost === 'number' && isFinite(maxBoost) ) {
            if ( maxBoost > TEMP_MAXIMUM ) {
                maxBoost = TEMP_MAXIMUM
                console.warn(`[node-drayton-wiser:setMaxBoost] maxBoost set too high, changed to TEMP_MAX (${TEMP_MAXIMUM}°C)`)
            }
            settings.maxBoost = maxBoost
            return maxBoost
        } else {
            console.warn(`[node-drayton-wiser:setMaxBoost] maxBoost not a valid number. Ignored. --${maxBoost}--`)
            return null
        }
    }

    const setBoostCancelTime = (boostCancelTime=null) => {
        if ( boostCancelTime === null ) {
            settings.boostCancelTime = null
            return null
        }
        
        // Check that the input is a valid time
        /** @type {boolean|regex} */ 
        let result = false, m
        const re = /^\s*([01]?\d|2[0-3]):?([0-5]\d)\s*$/
        if ((m = boostCancelTime.match(re))) {
            result = (m[1].length === 2 ? '' : '0') + m[1] + ':' + m[2];
        }

        if ( result === false ) {
            console.warn(`[node-drayton-wiser:setBoostCancelTime] boostCancelTime not a valid time ("HH:mm"). Ignored. --${boostCancelTime}--`)
            return false
        } else {
            settings.boostCancelTime = result
            return result
        }
    }

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
            return Promise.reject({
                'error': `[node-drayton-wiser:get] Invalid service name: ${service}, must be one of: [${ServiceNames.join(', ')}]`
            })
        }

        if (!axiosConfig.baseURL || !axiosConfig.headers.SECRET) {
            return Promise.reject({
                'error': '[node-drayton-wiser:get] both IP and SECRET must be provided before testing the connection, call setConfig first'
            })
        }

        // Make a request
        let result = await axios.get(servicePaths[service], axiosConfig)
        out[service] = result.data
        return  out
    } // --- End of get() --- //

    /** Get the full set of data from the controller
     * @fires wiserFullUpdate - Emits a reference to the full controller data after each call
     * @return {Promise} Containing either a reference to the full data object or the error object
     */
    const getFull = async () => {
        let result

        try {
            result = await axios.get(servicePaths['full'], axiosConfig)
        } catch (error) {
            console.error(error)
            return {'error': error}
        }

        // Update the saved data and the room/device map
        saved = result.data

        doRoomMap()

        /** Emit the full data reference
         *  So it can be used in the calling function (e.g. Node-RED)
         *
         * @event #wiserFullUpdate
         * @type {object} Full data object from the controller
         */
        eventEmitter.emit('wiserFullUpdate', saved )

        return saved

    } // ---- end of getFull ---- //

    /** Set the system in to away mode
        * @return {Promise} Containing data object or the error object
    */
    const setSystemMode = async (overrideMode) => {
        let result
        let payload = {
            RequestOverride: {
                Type : SystemOverrideType[overrideMode],
            },
        };
        
        try {
            result = await axios.patch(servicePath['system'], payload, axiosConfig);
            console.dir(result);
        } catch (error) {
            console.error(error);
            return {'error' : error};
        }

        return result;
    }
    /** Remove an existing monitor if it exists (does not error if it doesn't exist)
     * @param {string} ref Unique reference string that will be returned with the wiserMonitorRef event so that a specific monitor can be cancelled
     * @fires wiserMonitorRemoved - If the referenced monitor existed and has been successfully deleted
     */
    const removeMonitor = (ref) => {
        const existRef = getMonitorRef(ref)
        if (existRef !== undefined) {
            clearInterval(existRef)
            delete wiserMonitorRefs[ref]
            eventEmitter.emit('wiserMonitorRemoved', {'monitorRef': ref} )
        }
    }

    /** Start a monitoring loop. Get a full update every `interval` seconds
     * @param {string} ref Unique reference string that will be returned with the wiserMonitorRef event so that a specific monitor can be cancelled
     * @fires wiserMonitorRef - for every call of monitor(), from the setInterval
     * @fires wiserGetFull#wiserPing - on every successful getFull()
     * @fires wiserGetFull#wiserChange - if anything changes
     * @fires wiserGetFull#wiserError - if getFull() errors
     */
    const monitor = (ref='wiser') => {
        /** Reference to the setInterval instance from monitor() so that it can be cancelled */
        let intervalFn = undefined

        // If the monitor already exists, cancel it so that it can be recreated
        removeMonitor(ref)

        /** Get initial full data from Wiser Controller */
        getFull()
            .then( res => {
                /**
                 * wiserPing event. Emit on monitor startup after getting a full update from the controller.
                 *
                 * @event wiserMonitor#wiserPing
                 * @type {object}
                 * @property {string} monitorRef - Reference to specific instance of the monitor() fn
                 * @property {Date} updated - JavaScript timestamp of the detection of the change
                 */
                eventEmitter.emit('wiserPing', {'monitorRef': ref, 'updated': new Date(), 'initialRun': true} )

                /** We are not interested in the controllers timestamp changes */
                delete res.System.UnixTime
                delete res.System.LocalDateAndTime

                /** This is first run so just save a previous & current entry */
                prev = res

                /** Set up repeating call to get the full data from the Wiser Controller
                 * Runs every `interval` seconds
                 */
                intervalFn = setInterval(() => {
                    
                    /** 
                     * Get full data from the Wiser Controller
                     * @fires wiserGetFull#wiserPing
                     * @fires wiserGetFull#wiserChange
                     * @fires wiserGetFull#wiserError
                    */
                    getFull()
                        .then( res => {
                            /**
                             * wiserPing event. Emitted on each loop after getting a full update from the controller.
                             *
                             * @event wiserMonitor#wiserPing
                             * @type {object}
                             * @property {string} monitorRef - Reference to specific instance of the monitor() fn
                             * @property {Date} updated - JavaScript timestamp of the detection of the change
                             */
                            eventEmitter.emit('wiserPing', {'monitorRef': ref, 'updated': new Date()} )

                            /** We are not interested in the controllers timestamp changes */
                            delete res.System.UnixTime
                            delete res.System.LocalDateAndTime

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
                                        /** Data for wiserChange event.
                                         * @type {object}
                                         * @property {string} monitorRef - Reference to specific instance of the monitor() fn
                                         * @property {Date} updated - JavaScript timestamp of the detection of the change
                                         * @property {string} type - The type of change (e.g. Device, Room, etc)
                                         * @property {string|number} idx - The index of the thing that has changed in the type array
                                         * @property {string|number} id - The ID of the thing that has changed
                                         * @property {Object} changes - The changed settings:values
                                         * @property {Object} prev - The previous settings:values
                                         * @property {string} [room] - Room name (only for Room changes or devices where the room is known)
                                         */
                                        let changes = {
                                            'monitorRef': ref,
                                            'updated': new Date(), 
                                            'type': type, 
                                            'idx': i,
                                            'id': res[type][i].id, 
                                            'changes': data,
                                        }

                                        /** Add in the previous matching settings */
                                        let prevData = {}
                                        Object.keys(data).forEach( chgProp => {
                                            prevData[chgProp] = prev[type][i][chgProp]
                                        })
                                        changes.prev = prevData

                                        /** Add in room name if available */
                                        if (type === 'Room') changes.room = res[type][i].Name
                                        else if ( roomMap[ res[type][i].id ] ) changes.room = roomMap[ res[type][i].id ].roomName

                                        /** wiserChange event. Emitted after getting a full update from the controller when something has changed from the previous update.
                                         * @event wiserMonitor#wiserChange
                                         * @type {object}
                                         * @property {Date} updated - JavaScript timestamp of the detection of the change
                                         * @property {string} type - The type of change (e.g. Device, Room, etc)
                                         * @property {string|number} idx - The index of the thing that has changed in the type array
                                         * @property {string|number} id - The ID of the thing that has changed
                                         * @property {Object} changes - The changed settings:values
                                         * @property {Object} prev - The previous settings:values
                                         * @property {string} [room] - Room name (only for Room changes or devices where the room is known)
                                         */
                                        eventEmitter.emit('wiserChange', changes)
                                    }
                                })
                            })

                            /** Save the data */
                            prev = res

                        }) // --- end of getFull.then --- //
                        .catch( err => {
                            console.error(err)
                            /**
                             * wiserError event. Emitted if failed attempt at contacting the controller.
                             *
                             * @event wiserMonitor#wiserError
                             * @type {object}
                             * @property {string} monitorRef - Reference to specific instance of the monitor() fn
                             * @property {Date} updated - JavaScript timestamp of the detection of the change
                             * @property {Object} error - The returned error object
                             */
                            eventEmitter.emit('wiserError', {'monitorRef': ref, 'updated': new Date(), 'error': err} )
                        }) // --- end of getFull.catch --- //

                }, settings.interval * 1000 ) // --- End of setInterval --- //

                /** Emit the setInterval reference so that the monitor can be cancelled
                 *  from the calling process
                 *
                 * @event #wiserMonitorRef
                 * @type {object}
                 * @property {string} monitorRef - Reference to specific instance of the monitor() fn
                 * @property {Timeout} timeoutRef - Reference to Timeout so that it can be cancelled
                 */
                eventEmitter.emit('wiserMonitorRef', {'monitorRef': ref, 'timeoutRef': intervalFn} )
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

    /** Set the mode for a specified room (Manual, Set, Boost, Off or Auto)
     * Manual: Turn off schedule and set to highest of boost Temperature and current scheduled setpoint
     * Set:    Set to boost temperature but leave schedule active, will reset on next scheduled change
     * Boost:  Boost to given temperature for given amount of time
     * Off:    Turn off schedule and set temperature to -200
     * Auto:   Return room to set schedule and current scheduled temperature
     * @param {Object} args Object containing the arguments - uses JS destructuring so needs node.js 10.9+
     * @param {number|string} args.roomIdOrName Room ID or Name to set
     * @param {('manual'|'set'|'boost'|'off'|'auto')} args.mode Room mode (manual|set|boost|off|auto)
     * @param {number} [args.boostTemp] Temperature SetPoint for boost mode (°C, min=5, max=30). Optional, default 20
     * @param {number} [args.boostDuration] Duration for boost mode (minutes). Optional, default 30min
     * @return {Promise} 
     */
    const setRoomMode = async (roomIdOrName, mode, boostTemp=BOOST_DEFAULT_TEMP, boostDuration=BOOST_DEFAULT_DURATION) => {

        //console.log('setRoomMode params:', {roomIdOrName, mode, boostTemp, boostDuration})

        // Allow params to be passed as settings object
        if ( roomIdOrName !== null && roomIdOrName.constructor.name === "Object" ) {
            
            if ( roomIdOrName.mode ) mode = roomIdOrName.mode
            else mode = undefined

            if ( roomIdOrName.boostTemp ) boostTemp = roomIdOrName.boostTemp
            if ( roomIdOrName.boostDuration ) boostDuration = roomIdOrName.boostDuration

            if ( roomIdOrName.roomIdOrName ) roomIdOrName = roomIdOrName.roomIdOrName
            else roomIdOrName = undefined
        }

        if ( roomIdOrName === undefined || roomIdOrName === '' || roomIdOrName === null ) {
            return Promise.reject({
                'error': `[noode-drayton-wiser:setRoomMode] Room ID or Name is invalid: --${roomIdOrName}--`
            })
        }

        if ( mode === undefined || mode === '' || mode === null ) {
            return Promise.reject({
                'error': `[noode-drayton-wiser:setRoomMode] Mode is not provided for room: ${roomIdOrName}.`
            })
        }

        try {
            let result = await getFull()
        } catch (error) {
            return Promise.reject({
                'error': `[node-drayton-wiser:setRoomMode] Get Full failed.`,
                'details': error, //wiserErrorResult(error, 'full'),
            })
        }

        
        /** Data to send to controller hub */
        const patchData = {}
        /** URLs for patches - Array since we might have 2 patches to send */
        const patches = []

        let room

        // If room name given, find the ID
        if ( Number.isNaN( Number(roomIdOrName) ) ) {
            room = getRoomByName(roomIdOrName)
        } else {
            room = getRoom(Number(roomIdOrName))
        }

        if ( room === undefined || room === null ) {
            return Promise.reject({
                'error': `[node-drayton-wiser:setRoomMode] Invalid room id or name provided (${roomIdOrName}).`
            })
        }

        let roomUrl = `${servicePaths['rooms']}${room.id}`
        
        // Limit temperature requests (must be 5-30 °C or -200=off)
        if ( boostTemp !== -20 ) {
            if ( (boostTemp < TEMP_MINIMUM) ) {
                console.info(`[node-drayton-wiser:setRoomMode] Requested temperature too low (${boostTemp}), setting to default minimum (${TEMP_MINIMUM}) for room: ${roomIdOrName}.`)
                boostTemp = TEMP_MINIMUM
            }
            if ( boostTemp > settings.maxBoost ) {
                console.info(`[node-drayton-wiser:setRoomMode] Requested temperature too high (${boostTemp}), setting to max. allowed (${settings.maxBoost}) for room: ${roomIdOrName}.`)
                boostTemp = settings.maxBoost
            }
        }

        switch (mode.toLowerCase()) {
            case 'manual': {
                // Use highest of boost temp or current sch setpoint. Sch will not reset

                // Set to manual mode first otherwise next sch chg would override
                patches.push( axios.patch(roomUrl, {'Mode': 'Manual'}, axiosConfig) )
                
                // setPoint is highest of boostTemp and the current room scheduled setpoint
                let setPoint = toWiserTemp(boostTemp)
                if ( room.ScheduledSetPoint > toWiserTemp(boostTemp) ) setPoint = room.ScheduledSetPoint

                patchData.RequestOverride = {
                    'Type': 'Manual',
                    'SetPoint': setPoint,
                }

                break
            }

            case 'set': {
                // Use boost temp and allow next schedule change to reset
                
                patchData.RequestOverride = {
                    'Type': 'Manual',
                    'SetPoint': toWiserTemp(boostTemp),
                }

                break
            }

            case 'boost': {
                patchData.RequestOverride = {
                    'Type': 'Manual',
                    'DurationMinutes': boostDuration,
                    'SetPoint': toWiserTemp(boostTemp),
                    //'SetpointOrigin': 'FromBoost',
                    'Originator': 'App',
                }

                break
            }
            
            case 'off': {
                // Set to manual mode first so as to prevent next schedule change overriding
                patches.push( axios.patch(roomUrl, {'Mode': 'Manual'}, axiosConfig) )

                patchData.RequestOverride = {
                    'Type': 'Manual',
                    'SetPoint': toWiserTemp(TEMP_OFF),
                }

                break
            }
            
            case 'auto': {
                patchData.Mode = 'Auto'

                break
            }
        
            default: {
                return Promise.reject({
                    'error': `[node-drayton-wiser:setRoomMode] Invalid mode provided (${mode}) for room: ${roomIdOrName}. Must be one of ['manual','set','boost','off','auto']`
                })
                break
            }
        }

        // If not boost mode, cancel any boost by setting override to none
        if ( mode.toLowerCase() !== 'boost' ) {
            let cancelBoostPatchData = {
                'RequestOverride': {
                    'Type': 'None',
                    'DurationMinutes': 0,
                    'SetPoint': 0,
                    'Originator': 'App',
                }
            }
            // push to patches
            patches.push( axios.patch(roomUrl, cancelBoostPatchData, axiosConfig) )
        }

        // push main request to patches
        patches.push( axios.patch(roomUrl, patchData, axiosConfig) )

        // Set mode
        try {
            let res = await axios.all(patches)
            // console.log('# Results:', res.length)
            // Only show the last result (the actual change)
            // console.log('Final Result:', res[res.length-1].data, res[res.length-1].config.data)
            return Promise.resolve({
                'numResults': res.length,
                'lastResult': res[res.length-1].data,
                'lastConfigResult': res[res.length-1].config.data,
            })
        } catch (err) {
            return Promise.reject({
                'error': `[node-drayton-wiser:setRoomMode] Send to controller failed.`,
                'details': err, //wiserErrorResult(err, 'patches'),
            })
        }

    }

    //#endregion ---- Public Functions ---- //

    //#region ---- Built-in event listeners ---- //

    /** Listen for setRoomMode event and calls setRoomMode fn on receipt */
    eventEmitter.on('setRoomMode', function(roomOpts) {
        //console.log('EVENT Listener: setRoomMode: ', roomOpts)
        setRoomMode(roomOpts)
    }) // --- End of on:setRoomMode --- //

    /** Listen for a new monitor starting and save the reference to it and its timer */
    eventEmitter.on('wiserMonitorRef', function(ref) {
        // node.log('ref', ref)
        wiserMonitorRefs[ref.monitorRef] = ref.timeoutRef
    })

    //#endregion ---- Built-in event listeners ---- //

    /** Closure pattern - only expose what we want to, uses object deconstruction */
    return ({
        // Public interfaces
        setConfig,
        debug,
        testConnection,
        get,
        getFull,
        removeMonitor,
        monitor,
        eventEmitter,
        getRoom,
        getRoomByName,
        getRoomStat,
        setRoomMode,
        setMaxBoost,
        setBoostCancelTime,
        setFolder,
        setSystemMode,
    }) // --- End of closure --- //

} // ---- End of class ---- //

module.exports = Wiser

//EOF