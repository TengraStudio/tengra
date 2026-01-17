const { PGlite } = require('@electric-sql/pglite');
const path = require('path');
const fs = require('fs');

async function run() {
    // Hardcoded path based on analysis
    const dbPath = 'C:\\Users\\agnes\\AppData\\Roaming\\Orbit\\runtime\\db\\pg_data';

    console.log('Target Database Path:', dbPath);

    if (!fs.existsSync(dbPath)) {
        console.error('Database path does not exist!');
        process.exit(1);
    }

    // Check for lock file
    const lockFile = path.join(dbPath, 'postmaster.pid');
    if (fs.existsSync(lockFile)) {
        console.error('ERROR: Database is locked by a running process (postmaster.pid exists).');
        console.error('Please CLOSE the Orbit application and stop any "start" scripts before running this cleanup.');
        process.exit(1);
    }

    console.log('Opening database...');
    // We need to use the vector extension if it was used, but for deletion we might get away without it
    // unless the table uses vector types and PGlite enforces loading the extension to read the schema.
    // The package includes vector, let's try to load it if possible, or just open plain.
    // Migration 5 uses vectors. We should probably load it to be safe.

    const { vector } = require('@electric-sql/pglite/vector');

    const db = new PGlite(dbPath, {
        extensions: { vector }
    });

    await db.waitReady;
    console.log('Database opened successfully.');

    // Transaction for safety
    await db.transaction(async (tx) => {
        // 1. Delete from linked_accounts
        try {
            const res = await tx.query("SELECT count(*) as c FROM linked_accounts");
            console.log(`Found ${res.rows[0].c} accounts in linked_accounts.`);

            await tx.query("DELETE FROM linked_accounts");
            console.log('Deleted all rows from linked_accounts.');
        } catch (e) {
            console.log('linked_accounts table issue (maybe does not exist):', e.message);
        }

        // 2. Delete from auth_tokens (legacy)
        try {
            // Check existence first
            try {
                const res = await tx.query("SELECT count(*) as c FROM auth_tokens");
                console.log(`Found ${res.rows[0].c} tokens in auth_tokens.`);
                await tx.query("DELETE FROM auth_tokens");
                console.log('Deleted all rows from auth_tokens.');
            } catch (e) {
                // Table might not exist
                console.log('auth_tokens table does not exist or invalid.');
            }
        } catch (e) {
            console.log('Error cleaning auth_tokens:', e.message);
        }

        // 3. Delete from memories where key like '%token%'? 
        // No, let's stick to known auth tables.
    });

    console.log('Cleanup completed successfully.');
    // Close isn't strictly necessary for PGlite node script as exit handles it, but good practice.
    // db.close() if available? PGlite doesn't expose explicit close in all versions, process exit is fine.
}

run().catch(e => {
    console.error('Script failed:', e);
    process.exit(1);
});
