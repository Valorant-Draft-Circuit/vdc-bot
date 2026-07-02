import fs from "fs";
import path from "path";

export function cacheFilePath(fileName: string): string {
    return path.resolve(process.cwd(), "cache", fileName);
}

export function readCacheJson<T>(fileName: string): T {
    const rawContents = fs.readFileSync(cacheFilePath(fileName), "utf-8");
    return JSON.parse(rawContents) as T;
}
