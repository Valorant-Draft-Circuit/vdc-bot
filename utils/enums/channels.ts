export const CHANNELS = !Boolean(Number(process.env.PROD)) ?
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

        VC: {
            // LOBBY: `1027754353970389067`,
            COMBINES: {
                SORT_CHANNEL: `1360365081325600849`,
                // LOBBY_CHANNEL: `1360365391121223882`,
                // NEW_TEAM_CHANNEL: `1360365436839133251`,

                /** WAITING ROOMS */
                WAITING_ROOM: {
                    MYTHIC: `1360365299672682496`,
                    EXPERT: `1360365247843532841`,
                    APPRENTICE: `1360365176347557898`,
                    PROSPECT: `1360365121154842774`,
                },

                /** COMBINE CATEGORIES */
                COMBINE_CATEGORY: {
                    MYTHIC: `1360365496276353105`,
                    EXPERT: `1360365547581079582`,
                    APPRENTICE: `1360365624743821352`,
                    PROSPECT: `1360365712828535085`,
                }
            },
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

        VC: {
            LOBBY: `963274331864047619`,
            COMBINES: {
                SORT_CHANNEL: `1361090565223088269`,
                // LOBBY_CHANNEL: `1360365391121223882`,
                // NEW_TEAM_CHANNEL: `1360365436839133251`,

                /** WAITING ROOMS */
                WAITING_ROOM: {
                    MYTHIC: `1052005788765401169`,
                    EXPERT: `1052005068746006598`,
                    APPRENTICE: `1165389054938980394`,
                    PROSPECT: `1052002652688486554`,
                },

                /** COMBINE CATEGORIES */
                COMBINE_CATEGORY: {
                    MYTHIC: `1052001654569975888`,
                    EXPERT: `1052001614157856798`,
                    APPRENTICE: `1052001489964515459`,
                    PROSPECT: `1052001442979905586`,
                }
            },
        }
    };