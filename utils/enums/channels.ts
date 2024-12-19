export const CHANNELS = process.env.ENVIRONMENT == "DEV" ?
    /** @development */
    {
        TRANSACTIONS: "1057088094312091678",
        ACCEPTED_MEMBERS: "1057088139711234078",
        MEMBER_LOGS: "1057088287719817256",
        FRANCHISES: "1250480424031879188",
        DRAFT_BOARD: "1300688313988022272",

        DRAFT_CHANNEL: {
            MYTHIC: `1059244366671118487`,
            EXPERT: `1059244366671118487`,
            APPRENTICE: `1059244366671118487`,
            PROSPECT: `1059244366671118487`
        },

        CATEGORIES: {
            MAPBANS: `1318651615699402802`,
        }
    } :
    /** @production */
    {
        TRANSACTIONS: "963553611051319316",
        ACCEPTED_MEMBERS: "1049259805379924058",
        MEMBER_LOGS: "966986710204428291",
        FRANCHISES: "1047026056126812212",
        DRAFT_BOARD: "1311521719932157993",

        DRAFT_CHANNEL: {
            MYTHIC: `1173394756680822854`,
            EXPERT: `1173394810170790019`,
            APPRENTICE: `1173394850905853952`,
            PROSPECT: `1173394893297696788`
        },

        CATEGORIES: {
            // PRODUCTION IS CURRENTLY MISSING THE MAPBANS SECTION IN THE MAIN VDC SERVER
        }
    };