import "dotenv/config";
import app from "./app.js";
import redis from "./db/redis.js";
const PORT = Number(process.env.PORT || 3000);
// Validate Supabase configuration
function validateSupabaseConfig() {
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error('\n❌ Missing required environment variables:');
        missing.forEach(v => console.error(`   - ${v}`));
        console.error('\n💡 Please check your .env file in the backend directory.');
        console.error('   See env.example for required variables.\n');
        process.exit(1);
    }
    // Validate URL format
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
        console.error('\n❌ Invalid SUPABASE_URL format.');
        console.error(`   Current value: ${supabaseUrl}`);
        console.error('   Expected format: https://[project-ref].supabase.co\n');
        process.exit(1);
    }
    console.log('✅ Supabase configuration validated');
    console.log(`   URL: ${supabaseUrl}`);
}
// Test Supabase connectivity
async function testSupabaseConnection() {
    try {
        const { supabaseAdmin } = await import('./lib/services.js');
        // Try a simple health check - list users (will fail if not connected)
        const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) {
            // If it's a network error, show helpful message
            if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
                console.error('\n❌ Cannot connect to Supabase.');
                console.error(`   URL: ${process.env.SUPABASE_URL}`);
                console.error('   Possible issues:');
                console.error('   1. Supabase project is paused or deleted');
                console.error('   2. Network connectivity issue');
                console.error('   3. Incorrect SUPABASE_URL');
                console.error('   4. Firewall blocking connection\n');
                console.error('💡 Check your Supabase project status at: https://app.supabase.com\n');
            }
            else {
                // Other errors (like auth) are OK - means we can connect
                console.log('✅ Supabase connection successful');
            }
        }
        else {
            console.log('✅ Supabase connection successful');
        }
    }
    catch (error) {
        console.error('\n❌ Failed to test Supabase connection.');
        if (error.cause?.code === 'ENOTFOUND') {
            console.error(`   Cannot resolve hostname: ${error.cause.hostname}`);
            console.error('   Check your SUPABASE_URL environment variable.\n');
        }
        else {
            console.error(`   Error: ${error.message}\n`);
        }
        // Don't exit - let the server start but warn the user
        console.warn('⚠️  Server will start but Supabase operations may fail.\n');
    }
}
// Validate and test before starting server
validateSupabaseConfig();
// Test connection asynchronously (don't block server start)
testSupabaseConnection().catch(() => {
    // Already handled in testSupabaseConnection
});
const server = app.listen(PORT, () => {
    console.log(`\n🚀 API listening on http://localhost:${PORT}\n`);
});
// Graceful shutdown handler
async function gracefulShutdown(signal) {
    console.log(`\n${signal} received, shutting down gracefully...`);
    // Close HTTP server
    server.close(async () => {
        console.log("✅ HTTP server closed");
        // Disconnect Redis
        await redis.disconnect();
        console.log("👋 Shutdown complete");
        process.exit(0);
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
    }, 10000);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
//# sourceMappingURL=server.js.map