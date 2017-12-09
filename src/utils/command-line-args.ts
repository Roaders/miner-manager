
import { OptionDefinition } from "command-line-args";

export interface ICommandLineValues{
    startPort: number;
    logFolder: string;
    nvidiaSmiPath: string;
    nvidiaSmiParams?: string[];
    claymorePath: string;
    claymoreParams?: string[];
    minerBaseName?: string;
    poolAddress?: string;
    walletAddress?: string;
    queryInterval: number;
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
        type: value => parseInt(value)
    }
];