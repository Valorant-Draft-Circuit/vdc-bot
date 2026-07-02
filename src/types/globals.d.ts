import type { Client, Collection } from "discord.js";

interface BotLogger {
    log(level: string, ...data: unknown[]): unknown;
}

interface BotClientGlobals extends Client {
    config: Record<string, unknown>;
    environment: string | undefined;
    slashCommands: Collection<string, unknown>;
    selectMenus: Collection<string, unknown>;
    buttons: Collection<string, unknown>;
    modals: Collection<string, unknown>;
    autocompletes: Collection<string, unknown>;
    loadEvents(directory: string): void;
    loadSlashCommands(directory: string): void;
    registerSlashCommands(readyClient: Client, directory: string): void;
    loadButtons(directory: string): void;
    loadSelectMenus(directory: string): void;
    loadAutocomplete(directory: string): void;
}

declare global {
    var logger: BotLogger;
    var client: BotClientGlobals;
    var mmrCache: Record<string, unknown>;
    var mmrTierLinesCache: Record<string, unknown>;
    var combineCountCache: unknown[];
}

export {};
