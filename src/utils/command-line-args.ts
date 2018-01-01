
import { OptionDefinition } from "command-line-args";

export interface ICommandLineValues{
    startPort: number;
    initialClock?: number;
    logFolder: string;
    nvidiaSmiPath: string;
    nvidiaSmiParams?: string[];
    nvidiaSettingsPath: string;
    nvidiaSettingsParams?: string[];
    nvidiaXConfigPath: string;
    nvidiaXConfigParams?: string[];
    claymorePath: string;
    claymoreParams?: string[];
    minerBaseName?: string;
    poolAddress?: string;
    walletAddress?: string;
    queryInterval: number;
    query: boolean;
    maxFans: boolean;
    resetFans: boolean;
    setup: boolean;
    applySettings: boolean;
    identify?: number;
}

interface OptionWithKeyOf extends OptionDefinition{
    name: keyof ICommandLineValues;
}

export const commandArgs: OptionWithKeyOf[] = [
    {
        name: "startPort",
        type: Number
    },
    {
        name: "logFolder"
    },
    {
        name: "nvidiaSmiPath"
    },
    {
        name: "nvidiaSmiParams",
        multiple: true
    },
    {
        name: "nvidiaSettingsPath"
    },
    {
        name: "nvidiaSettingsParams",
        multiple: true
    },
    {
        name: "nvidiaXConfigPath"
    },
    {
        name: "nvidiaXConfigParams",
        multiple: true
    },
    {
        name: "claymorePath"
    },
    {
        name: "claymoreParams",
        multiple: true
    },
    {
        name: "minerBaseName"
    },
    {
        name: "poolAddress"
    },
    {
        name: "walletAddress"
    },
    {
        name: "queryInterval",
        defaultValue: 60000,
        type: Number
    },
    {
        name: "identify",
        type: Number
    },
    {
        name: "query",
        type: Boolean
    },
    {
        name: "maxFans",
        type: Boolean
    },
    {
        name: "resetFans",
        type: Boolean
    },
    {
        name: "setup",
        type: Boolean
    },
    {
        name: "applySettings",
        type: Boolean
    },
    {
        name: "initialClock",
        type: Number
    }
];