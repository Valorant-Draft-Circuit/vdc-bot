export enum Channel {
}

export const CHANNELS = process.env.ENVIRONMENT == "DEV" ?
    /** @development */
    {
        TRANSACTIONS: "1057088094312091678",
        ACCEPTED_MEMBERS: "1057088139711234078",
    } :
    /** @production */
    {
        TRANSACTIONS: "963553611051319316",
        ACCEPTED_MEMBERS: "1049259805379924058",
    };