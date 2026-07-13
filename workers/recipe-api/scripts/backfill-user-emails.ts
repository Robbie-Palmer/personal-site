import { createDb, schema } from "recipe-db";

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

  if (users.length > 0) {
    await db
      .insert(schema.userEmail)
      .values(
        users.map((user) => ({
          email: user.email.trim().toLowerCase(),
          userId: user.id,
          verified: user.emailVerified,
          isPrimary: true,
        })),
      )
      .onConflictDoNothing({ target: schema.userEmail.email });
  }

  const registeredEmails = await db
    .select({
      email: schema.userEmail.email,
      userId: schema.userEmail.userId,
    })
    .from(schema.userEmail);
  const ownerByEmail = new Map(
    registeredEmails.map(({ email, userId }) => [email, userId]),
  );
  const conflict = users.find(
    (user) => ownerByEmail.get(user.email.trim().toLowerCase()) !== user.id,
  );
  if (conflict) {
    throw new Error("Email ownership conflict detected while backfilling");
  }

  console.log(`Registered canonical emails for ${users.length} users.`);
} finally {
  await client.end({ timeout: 5 });
}
