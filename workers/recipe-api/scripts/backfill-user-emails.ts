import { createDb, schema } from "recipe-db";
import { syncCanonicalUserEmail } from "../src/user-emails";

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) throw new Error("DATABASE_URL is required");

const { db, client } = createDb(databaseURL);

try {
  const users = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      emailVerified: schema.user.emailVerified,
    })
    .from(schema.user);

  for (const user of users) {
    await syncCanonicalUserEmail(db, user);
  }

  console.log(`Registered canonical emails for ${users.length} users.`);
} finally {
  await client.end({ timeout: 5 });
}
