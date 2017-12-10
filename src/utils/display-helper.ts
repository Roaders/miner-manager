
import { HorizontalTable } from "cli-table2";
import { IMinerStatus } from "../miner/claymoreMiner";
import { Maybe } from "maybe-monad";

import formatDuration = require("format-duration");

import * as Table from "cli-table2";
import { start } from "repl";
import { stat } from "fs";

export function displayMiners(statuses: IMinerStatus[]) {
    const cardTable = new Table({
        head: ["Id", "Status", "Power", "%", "Temp", "Time", "Rate", "Shares", "Hash/Watt"]
    }) as HorizontalTable;

    statuses.forEach(status => cardTable.push(buildColumns(status)));

    cardTable.push(constructTotalsRow(statuses))

    console.log(cardTable.toString());
}

function buildColumns(status: IMinerStatus): string[] {
    const cardMaybe = Maybe.nullToMaybe(status.cardDetails);
    const claymoreMaybe = Maybe.nullToMaybe(status.claymoreDetails);
    const mineMaybe = claymoreMaybe.map(x => x.ethHashes);

    return [
        status.cardDetails.index.toString(),
        status.status,
        displayPower(status),
        cardMaybe.map(details => details.utilization_gpu).map(x => x.toString()).defaultTo("-"),
        cardMaybe.map(details => details.temperature_gpu)
            .combine(cardMaybe.map(details => details.fan_speed))
            .map(([temp,fan]) => `${temp} (${fan}%)`)
            .defaultTo("-"),
        claymoreMaybe.map(details => details.runningTimeMs).map(x => formatDuration(x)).defaultTo("-"),
        mineMaybe.map(details => details.rate).map(x => x.toString()).defaultTo("-"),
        mineMaybe.map(details => details.shares)
            .combine(mineMaybe.map(d => d.rejected), mineMaybe.map(d => d.invalid))
            .map(([shares, rejected, invalid]) => `${shares} (${rejected}/${invalid})`)
            .defaultTo("-"),
        Maybe.nullToMaybe(status.hashEfficiency).map(eff => eff.toFixed(3)).defaultTo("-")
    ];
}

function displayPower(status: IMinerStatus): string {
    const powerDraw = Maybe.nullToMaybe(status.cardDetails.power_draw).map(p => p.toFixed());
    const powerLimit = Maybe.nullToMaybe(status.cardDetails.power_limit).map(p => p.toFixed());

    return powerDraw
        .combine(powerLimit)
        .map(([draw, limit]) => `${draw}/${limit}`)
        .or(powerDraw)
        .defaultTo(`-`);
}

function constructTotalsRow(statuses: IMinerStatus[]): string[] {
    let totalPower = 0;
    let totalRate = 0;
    let totalShares = 0;
    let totalRejected = 0;
    let totalInvalid = 0;

    statuses.forEach(status => {
        Maybe.nullToMaybe(status.cardDetails)
            .map(d => d.power_draw)
            .filter(p => !isNaN(p))
            .do(p => totalPower += p);

        Maybe.nullToMaybe(status.claymoreDetails)
            .map(d => d.ethHashes)
            .map(eth => eth.rate)
            .filter(r => !isNaN(r))
            .do(r => totalRate += r);

        Maybe.nullToMaybe(status.claymoreDetails)
            .map(d => d.ethHashes)
            .map(eth => eth.shares)
            .filter(s => !isNaN(s))
            .do(s => totalShares += s);

        Maybe.nullToMaybe(status.claymoreDetails)
            .map(d => d.ethHashes)
            .map(eth => eth.rejected)
            .filter(s => !isNaN(s))
            .do(s => totalRejected += s);

        Maybe.nullToMaybe(status.claymoreDetails)
            .map(d => d.ethHashes)
            .map(eth => eth.invalid)
            .filter(s => !isNaN(s))
            .do(s => totalInvalid += s);
    });

    const overallEfficiency = totalRate / totalPower;

    return [
        "", //  Id
        "", //  Status
        totalPower.toFixed(0),
        "", //  Percent
        "", //  Temp
        "", //  Time
        totalRate.toFixed(3),
        `${totalShares} (${totalRejected}/${totalInvalid})`,
        overallEfficiency.toFixed(3)
    ];
}