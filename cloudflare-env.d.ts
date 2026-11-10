declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    EBAY_CLIENT_ID?: string;
    EBAY_CLIENT_SECRET?: string;
    EBAY_MARKETPLACE?: string;
    EBAY_ENVIRONMENT?: string;
    EBAY_SANDBOX_CLIENT_ID?: string;
    EBAY_SANDBOX_CLIENT_SECRET?: string;
    EBAY_VERIFICATION_TOKEN?: string;
    EBAY_DELETION_ENDPOINT?: string;
    REDDIT_CLIENT_ID?: string;
    REDDIT_CLIENT_SECRET?: string;
    EBAY_DAILY_CALLS?: string;
    EBAY_BACKGROUND_CALLS?: string;
    REFRESH_BATCH?: string;
    BUCKET?: R2Bucket;
  }
}
