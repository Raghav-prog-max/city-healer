/**
 * Environment loading, kept in its own module so it runs before anything reads
 * process.env.
 *
 * ES module imports are evaluated in source order, and `database.ts` resolves
 * DB_PATH at import time. Calling dotenv.config() in server.ts's module body
 * would therefore run too late — every import has already been evaluated by
 * then. Importing this file first is what guarantees the ordering.
 *
 * `.env.local` wins over `.env`: dotenv never overwrites a variable that is
 * already set, so the file loaded first takes precedence. Real environment
 * variables set by the host beat both, which is what a deployed server wants.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();
