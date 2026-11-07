declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    EBAY_CLIENT_ID?: string;
    EBAY_CLIENT_SECRET?: string;
    REDDIT_CLIENT_ID?: string;
    REDDIT_CLIENT_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
