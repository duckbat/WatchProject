import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(), owner: text("owner").notNull(), kind: text("kind").notNull(), payload: text("payload").notNull(),
  },
  // Every personal and market query filters by owner (and usually kind); without it each query scans the table.
  (t) => [index("records_owner_kind").on(t.owner, t.kind)],
);
