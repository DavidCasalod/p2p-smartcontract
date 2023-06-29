/*
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

const { Contract } = require("fabric-contract-api");
const crypto = require("crypto");

const stringify = require('json-stringify-deterministic')

const cecPrivateContractCollectionName = "cecPrivateContractCollection";
const cecTradingCollectionName = "cecTradingCollection";

async function getCollectionName(ctx) {
    const mspid = ctx.clientIdentity.getMSPID();
    const collectionName = `_implicit_org_${mspid}`;
    return collectionName;
}
/**
 * Clean the string removing escape sequences
 * @param {String} string to clean
 * @returns {String} string cleaned
 */
async function cleanString(string) {
    string.replace("\\n", "");
    string.replace("\\r", "");
    string.replace("\\t", "");
    string.replace("\\", "");
    return string;
}

/**
    * Automatic cooperative equality trading algorithm hour by hour
    * @param {Object} smartmeter smartmetter daily reading of the previous 24 hours
    * @returns {[Number]}  array with the trading data of the 24 hours period
*/
async function equalityalg(smartmeter) {

    //initialize "t" array
    for (let i = 0; i < smartmeter.length; i++) {
        smartmeter[i].t = [];
    }

    // check every hour in the 24-hour period if the smartmeter is a producer or a consumer
    for (let hour = 0; hour < 24; hour++) {
        let CEC_Consumers = [];
        let CEC_Producers = [];
        let CEC_Zero = [];

        // check every smartmeter
        for (let i = 0; i < smartmeter.length; i++) {


            // check if the smartmeter is a producer
            if (smartmeter[i].p[hour] > smartmeter[i].c[hour]) {
                let producer = {
                    Household: smartmeter[i].smartmeterId,
                    Energy_Produced: smartmeter[i].p[hour],
                    Energy_Consumed: smartmeter[i].c[hour],
                    name: smartmeter[i].smartmeterId,
                    energy_traded: 0,
                };
                CEC_Producers.push(producer);
            }
            // check if the smartmeter is a consumer
            else if (smartmeter[i].p[hour] < smartmeter[i].c[hour]) {
                let consumer = {
                    Household: smartmeter[i].smartmeterId,
                    Energy_Produced: smartmeter[i].p[hour],
                    Energy_Consumed: smartmeter[i].c[hour],
                    name: smartmeter[i].smartmeterId,
                    energy_traded: 0,
                };
                CEC_Consumers.push(consumer);
            }
            // check if the smartmeter is a zero
            else if (smartmeter[i].p[hour] === smartmeter[i].c[hour]) {
                let zero = {
                    Household: smartmeter[i].smartmeterId,
                    Energy_Produced: smartmeter[i].p[hour],
                    Energy_Consumed: smartmeter[i].c[hour],
                    name: smartmeter[i].smartmeterId,
                    energy_traded: 0,
                };
                CEC_Zero.push(zero);
            }
        }


        // apply the algorithm to the producers and consumers
        let totalProducers = 0;
        let totalConsumers = 0;
        let lowest_producer_balance = Infinity;
        let lowest_consumer_balance = -Infinity;

        // Calculate Producer-related Values
        CEC_Producers.forEach(producer => {
            const excess_energy = producer.Energy_Produced - producer.Energy_Consumed;
            producer.initial_energy_balance = excess_energy;
            producer.excess_energy = excess_energy;
            totalProducers++;
            producer.energy_traded = 0;
            producer.energy_balance = excess_energy;
            lowest_producer_balance = Math.min(lowest_producer_balance, producer.energy_balance);
        });

        // Calculate Consumer-related Values
        CEC_Consumers.forEach(consumer => {
            const energy_balance = consumer.Energy_Produced - consumer.Energy_Consumed;
            consumer.initial_energy_balance = energy_balance;
            consumer.energy_balance = energy_balance;
            consumer.energy_traded = 0;
            totalConsumers++;
            lowest_consumer_balance = Math.max(lowest_consumer_balance, consumer.energy_balance);
        });

        let CEC_Producer_Pool = CEC_Producers.reduce((sum, producer) => sum + producer.excess_energy, 0);
        let CEC_Consumer_Pool = CEC_Consumers.reduce((sum, consumer) => sum + consumer.energy_balance, 0);
        let Total_CEC_Energy_Traded = 0;

        // Distribute energy from CEC Producer Pool to CEC Consumers
        while (CEC_Producer_Pool > 0 && CEC_Consumer_Pool < 0) {
            const energy_to_distribute = Math.min(CEC_Producer_Pool, Math.abs(CEC_Consumer_Pool));
            const consumers_to_receive = CEC_Consumers.filter(consumer => consumer.energy_balance < 0);
            const energy_per_consumer = energy_to_distribute / consumers_to_receive.length;

            consumers_to_receive.forEach(consumer => {
                const energy_received = Math.min(energy_per_consumer, Math.abs(lowest_consumer_balance), lowest_producer_balance);
                consumer.energy_balance += energy_received;
                CEC_Producer_Pool -= energy_received;
                CEC_Consumer_Pool += energy_received;
                Total_CEC_Energy_Traded += energy_received;
                consumer.energy_traded -= energy_received;
            });

            lowest_consumer_balance = Math.min(...CEC_Consumers.filter(consumer => consumer.energy_balance < 0).map(consumer => consumer.energy_balance));
        }

        let tradingBalanceoShare = Total_CEC_Energy_Traded;
        while (tradingBalanceoShare > 0) {
            const producers_to_receive = CEC_Producers.filter(producer => producer.energy_balance > 0);
            const energy_per_producer = tradingBalanceoShare / producers_to_receive.length;
            const energy_shared = Math.min(energy_per_producer, Math.abs(lowest_producer_balance));

            producers_to_receive.forEach(producer => {
                producer.energy_traded += energy_shared;
                producer.energy_balance -= energy_shared;
                tradingBalanceoShare -= energy_shared;
            });

            lowest_producer_balance = Math.max(...CEC_Producers.filter(producer => producer.energy_balance > 0).map(producer => producer.energy_balance));
        }

        // update with the new values of energy_traded
        for (let i = 0; i < smartmeter.length; i++) {
            const smartmeterId = smartmeter[i].smartmeterId;

            const producer = CEC_Producers.find(producer => producer.Household === smartmeterId);
            if (producer) {
                smartmeter[i].t[hour] = producer.energy_traded;
                continue;
            }

            const consumer = CEC_Consumers.find(consumer => consumer.Household === smartmeterId);
            if (consumer) {
                smartmeter[i].t[hour] = consumer.energy_traded;
                continue;
            }

            const zero = CEC_Zero.find(zero => zero.Household === smartmeterId);
            if (zero) {
                smartmeter[i].t[hour] = zero.energy_traded;
            }
        }
    }
    
    return smartmeter;
}
/**
 * Initialize setting data of each smartmeter to the cecTradingMonth
 * @param {[Object]} cecTradingMonths array of cecTradingMonth
 * @param {Object} smartmeterdataJson object with the readings of the smartmeter
 * @returns {[Object]} array of cecTradingMonth
 */
async function initializeCecMonth(smartmeterdataJson, date) {
    const cecTradingMonths = [];
    let completedata = [];
    completedata = await equalityalg(smartmeterdataJson, date);

    for (let i = 0; i < smartmeterdataJson.length; i++) {
        //applies the trading algorithm to the smartmeterdata

        const cecTradingMonth = {
            smartmeterId: smartmeterdataJson[i]["smartmeterId"],
            days: [
                {
                    //Day of the reading
                    day: date.getDate(),
                    //Energy consumption of the day in kWh
                    c: smartmeterdataJson[i]["c"],
                    //Energy production of the day in kWh
                    p: smartmeterdataJson[i]["p"],
                    //Energy traded in kWh
                    t: completedata[i]["t"],
                },
            ],
        };
        cecTradingMonths.push(cecTradingMonth);
    }
    return cecTradingMonths;
}

/**
 * Set data of each smartmeter to the cecTradingMonth
 * @param {[Object]} cecTradingMonths array of cecTradingMonth
 * @param {Object} smartmeterdataJson object with the readings of the smartmeter
 * @returns {[Object]} array of cecTradingMonth
 */
async function setTradingMonth(tradingMonth, smartmeterdata, date) {
    //for each smart meter insert the data to the cecTradingMonth

    let completedata = [];
    // apply equalityalg to the smartmeterdata
    completedata = await equalityalg(smartmeterdata, date);
    
    for (let i = 0; i < smartmeterdata.length; i++) {
        let days = [];

        days = tradingMonth[i]["days"];

        let day = {
            //Day of the reading
            day: date.getDate(),
            //Energy consumption of the day in kWh
            c: smartmeterdata[i]["c"],
            //Energy production of the day in kWh
            p: smartmeterdata[i]["p"],
            //Energy traded in kWh
            t: completedata[i]["t"],
        };

        days.push(day);

        tradingMonth[i]["days"] = days;
    }
    return tradingMonth;
}
/**
 * Set data of each smartmeter to the cecTradingMonth
 * @param {[Object]} cecTradingMonths array of cecTradingMonth
 * @param {Object} transientData object with the transaction transient data
 * @returns {[Object]} array of cecTradingMonth
 */
async function calculateTradingMonth(cecYearMonth, transientData) {
    const tradingPeriod = transientData.get("tradingPeriod").toString();
    //get the smart meter data from the transient data
    const smartmeterData = transientData.get('smartmeterData').toString('utf8');
    //clean smartmeterdata string
    const smartmeterDataClean = await cleanString(smartmeterData);
    //parse smartmeterdata string
    const smartmeterdataJson = JSON.parse(smartmeterDataClean);


    const date = new Date(tradingPeriod);
    //in the array the month 1 is stored in the position 0
    const month = date.getMonth();
    const cecTradingMonth = cecYearMonth[month];

    let tradingMonth = {};

    if (cecTradingMonth === null || cecTradingMonth === undefined) {
        //if the month is not initialized, initialize it
        tradingMonth = await initializeCecMonth(smartmeterdataJson, date);
    } else {
        //if the month is initialized, set the data to the cecTradingMonth
        tradingMonth = await setTradingMonth(
            cecTradingMonth,
            smartmeterdataJson,
            date
        );
    }

    const cecTradingMonths = tradingMonth;

    cecYearMonth[month] = cecTradingMonths;

    return cecYearMonth[month];
}

class CecContractContract extends Contract {
    //check if the asset exist in current collection
    async cecContractExists(ctx, cecContractId, collectionName) {
        let data = {};

        if (collectionName === undefined) {
            data = await ctx.stub.getState(cecContractId);
        } else {
            data = await ctx.stub.getPrivateDataHash(
                collectionName,
                cecContractId
            );
        }
        return !!data && data.length > 0;
    }
    /**
     * Creates a cec contract and publishes an event to notify a new cec contract has been created
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @param {String} contractedByOrgId organization id of the contract
     * @param {String} contractStart Start date of the contract
     * @param {String} contractEnd End date of the contract
     * @param {String} state State of the contract
     * @param {String} algorithm Algorithm used
     * @param {String} version Version of the contract
     */
    async startCecContract(
        ctx,
        cecContractId,
        contractedByOrgId,
        contractStart,
        contractEnd,
        state,
        algorithm,
        version
    ) {
        const exists = await this.cecContractExists(ctx, cecContractId);
        if (exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} already exists`
            );
        }

        const transientData = ctx.stub.getTransient();
        if (
            transientData.size === 0 ||
            (!transientData.has("cecTradingParams") &&
                !transientData.has("contractedByEmail"))
        ) {
            throw new Error(
                "The cecTradingParams or contractedByEmail was not specified in transient data. Please try again."
            );
        }
        //public data
        const cecContract = {
            cecContractId: cecContractId,
            contractedByOrgId: contractedByOrgId,
            contractStart: contractStart,
            contractEnd: contractEnd,
            state: state,
            algorithm: algorithm,
            version: version,
        };

        const buffer = Buffer.from(JSON.stringify(cecContract));
        await ctx.stub.putState(cecContractId, buffer);
        //private data
        const cecPrivateContract = {};
        //set contracted by email obtained from transient data
        cecPrivateContract.contractedByEmail = transientData
            .get("contractedByEmail")
            .toString();
        //obtain the cecTradingParams from transient data
        const tradingParamsString = transientData
            .get("cecTradingParams")
            .toString("utf8");
        //clean the string tradingParamsString
        const tradingParamsStringClean = await cleanString(tradingParamsString);
        //transform the string to json
        const tradingParamsJSON = JSON.parse(tradingParamsStringClean);
        //add the cecTradingParams to the cecPrivateContract
        cecPrivateContract.cecTradingParams = tradingParamsJSON;

        await ctx.stub.putPrivateData(
            cecPrivateContractCollectionName,
            cecContractId,
            Buffer.from(JSON.stringify(cecPrivateContract))
        );
        //Publishing an event to notify that a new CecContract was created
        const event = { contractId: cecContractId };
        const eventPlayload = Buffer.from(JSON.stringify(event));
        ctx.stub.setEvent("cecInitialised", eventPlayload);
    }
    /**
     * Read the public data of a cec contract
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @returns {Object} cec contract public data
     */
    async readCecContract(ctx, cecContractId) {
        const exists = await this.cecContractExists(ctx, cecContractId);
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        const buffer = await ctx.stub.getState(cecContractId);
        const cecContract = JSON.parse(buffer.toString());
        return cecContract;
    }

    /**
     * Read the private data of a cec contract
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @returns {Object} cec contract private data
     */
    async readCecPrivateContract(ctx, cecContractId) {
        const exists = await this.cecContractExists(
            ctx,
            cecContractId,
            cecPrivateContractCollectionName
        );
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        let cecPrivateContractString;
        //const collectionName = await getCollectionName(ctx);
        const cecPrivateContract = await ctx.stub.getPrivateData(
            cecPrivateContractCollectionName,
            cecContractId
        );
        cecPrivateContractString = JSON.parse(cecPrivateContract.toString());
        return cecPrivateContractString;
    }
    /**
     * Read the private data of a cec year Month
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @returns {Object} cec year Month private data
     */
    async readCecYearMonth(ctx, cecContractId) {
        const exists = await this.cecContractExists(
            ctx,
            cecContractId,
            cecTradingCollectionName
        );
        if (!exists) {
            throw new Error(
                `The asset cec Year month ${cecContractId} does not exist`
            );
        }

        let cecYearMonthString;
        const cecYearMonth = await ctx.stub.getPrivateData(
            cecTradingCollectionName,
            cecContractId
        );
        cecYearMonthString = JSON.parse(cecYearMonth.toString());
        return cecYearMonthString;
    }
    /**
     * read the trading results of the trading data
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @param {String} yearMonth year and month of the trading data or date
     * @returns {Object} with the trading results
     */
    async getCECtradingResults(ctx, cecContractId, yearMonth) {
        const exists = await this.cecContractExists(ctx, cecContractId);
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        const date = new Date(yearMonth);
        //in the array the month 1 is stored in the position 0
        const month = date.getMonth();

        const year = date.getFullYear();

        const index = cecContractId + year;

        let cecYearMonthString;

        const cecYearMonth = await ctx.stub.getPrivateData(
            cecTradingCollectionName,
            index
        );

        cecYearMonthString = JSON.parse(cecYearMonth.toString());
        // obtain the cecTradingMonth stored in cecYearMonthString[month]
        if (
            cecYearMonthString[month] === undefined ||
            cecYearMonthString[month] === null
        ) {
            throw new Error(
                `The asset tradingMonth ${cecContractId} does not exist for the month ${month+1} and year ${year}`
            );
        }
        const cecTradingMonth = cecYearMonthString[month];
        return cecTradingMonth;
    }
    /**
     * Updates the public data of a cec contract
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @param {String} contractedByOrgId organization id of the contract
     * @param {String} contractStart Start date of the contract
     * @param {String} contractEnd End date of the contract
     * @param {String} state State of the contract
     * @param {String} algorithm Algorithm used
     * @param {String} version Version of the contract
     */
    async updateCecContract(
        ctx,
        cecContractId,
        newContractStart,
        newContractEnd,
        newState,
        newAlgorithm,
        newVersion
    ) {
        const exists = await this.cecContractExists(ctx, cecContractId);
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        const cecContract = {
            contractStart: newContractStart,
            contractEnd: newContractEnd,
            state: newState,
            algorithm: newAlgorithm,
            version: newVersion,
        };
        const buffer = Buffer.from(JSON.stringify(cecContract));
        await ctx.stub.putState(cecContractId, buffer);
    }
    /**
     * Update the private data of a cec contract, private data should be transient data
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     */
    async updateCecPrivateContract(ctx, cecContractId) {
        const exists = await this.cecContractExists(
            ctx,
            cecContractId,
            cecPrivateContractCollectionName
        );
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        const cecPrivateContract = {};

        const transientData = ctx.stub.getTransient();
        if (
            transientData.size === 0 ||
            (!transientData.has("cecTradingParams") &&
                !transientData.has("contractedByEmail"))
        ) {
            throw new Error(
                "The privateValue key was not specified in transient data. Please try again."
            );
        }

        cecPrivateContract.contractedByEmail = transientData
            .get("contractedByEmail")
            .toString();
        cecPrivateContract.cecTradingParams = transientData
            .get("cecTradingParams")
            .toString("utf8");

        await ctx.stub.putPrivateData(
            cecPrivateContractCollectionName,
            cecContractId,
            Buffer.from(JSON.stringify(cecPrivateContract))
        );
    }
    /**
     * Delete a cec contract
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     */
    async deleteCecContract(ctx, cecContractId) {
        const exists = await this.cecContractExists(ctx, cecContractId);
        if (!exists) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }
        const collectionName = await getCollectionName(ctx);
        await ctx.stub.deleteState(cecContractId);
    }
    /**
     * Verify the private data of a cec contract
     * @param {Context} ctx transaction context
     * @param {String} mspid id of the Membership Service Provider
     * @param {String} cecContractId id of the cec contract
     * @param {Object} objectToVerify object with private data to verify
     * @returns {Boolean} true if the private data is correct
     */
    async verifyCecContract(ctx, mspid, cecContractId, objectToVerify) {
        // Convert provided object into a hash
        const hashToVerify = crypto
            .createHash("sha256")
            .update(objectToVerify)
            .digest("hex");
        const pdHashBytes = await ctx.stub.getPrivateDataHash(
            `_implicit_org_${mspid}`,
            cecContractId
        );
        if (pdHashBytes.length === 0) {
            throw new Error(
                "No private data hash with the key: " + cecContractId
            );
        }

        const actualHash = Buffer.from(pdHashBytes).toString("hex");

        // Compare the hash calculated (from object provided) and the hash stored on public ledger
        if (hashToVerify === actualHash) {
            return true;
        } else {
            return false;
        }
    }
    /**
     * Obtains smart meter data readings and executes the trading algorithm for the 24h period´s trading data
     * @param {Context} ctx transaction context
     * @param {String} cecContractId id of the cec contract
     * @param {Date} tradingPeriod date of the trading period
     * @param {Object} smartmeterdata  object with the readings of smart meters
     */
    async calculateCECtrading(ctx, cecContractId) {
        const existsPublic = await this.cecContractExists(ctx, cecContractId);

        if (!existsPublic) {
            throw new Error(
                `The asset cec contract ${cecContractId} does not exist`
            );
        }

        const transientData = ctx.stub.getTransient();
        if (
            transientData.size === 0 ||
            (!transientData.has("tradingPeriod") &&
                !transientData.has("smartmeterData"))
        ) {
            throw new Error(
                "The tradingPeriod or smartmeterData was not specified in transient data. Please try again."
            );
        }

        const tradingPeriod = transientData.get("tradingPeriod").toString();
        //get the smart meter data from the transient data
        const smartmeterData = transientData.get('smartmeterData').toString('utf8');
        //clean smartmeterdata string
        const smartmeterDataClean = await cleanString(smartmeterData);
        //parse smartmeterdata string
        const smartmeterdataJson = JSON.parse(smartmeterDataClean);

        const date = new Date(tradingPeriod);

        const year = date.getFullYear();

        //create index for the cecTradingMonth that will be used as key
        const index = cecContractId + year;

        const existsPrivate = await this.cecContractExists(
            ctx,
            index,
            cecTradingCollectionName
        );

        if (smartmeterdataJson.length === 0) {
            throw new Error("No smartmeterdata available");
        }
        //set data of each smartmeter to the cecTradingMonth
        let yearMonth = [];

        //if the cecTradingMonth exists, read it from the offchain ledger
        if (existsPrivate) {
            yearMonth = await this.readCecYearMonth(ctx, index);
        }

        const cecYearMonth = yearMonth;

        const cecYearMonthJson = JSON.parse(JSON.stringify(cecYearMonth));

        const tradingMonth = await calculateTradingMonth(
            cecYearMonthJson,
            transientData
        );
        //store the cecTradingMonth in the offchain ledger
        cecYearMonth[date.getMonth()] = tradingMonth;

        await ctx.stub.putPrivateData(
            cecTradingCollectionName,
            index,
            Buffer.from(JSON.stringify(cecYearMonth))
        );
    }
}

module.exports = CecContractContract;
