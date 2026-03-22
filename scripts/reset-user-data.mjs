import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const includeGameplay = args.has("--include-gameplay");

const collections = [
  "users",
  "accounts",
  "sessions",
  "verification_tokens",
  ...(includeGameplay ? ["casesessions", "emailnudgelogs"] : []),
];

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();

  const results = [];

  for (const name of collections) {
    const collection = db.collection(name);
    const exists = (await db.listCollections({ name }).toArray()).length > 0;

    if (!exists) {
      results.push({ name, exists: false, count: 0, deleted: 0 });
      continue;
    }

    const count = await collection.countDocuments();
    let deleted = 0;

    if (apply && count > 0) {
      const outcome = await collection.deleteMany({});
      deleted = outcome.deletedCount || 0;
    }

    results.push({ name, exists: true, count, deleted });
  }

  console.table(results);

  if (!apply) {
    console.log(
      "Dry run only. Re-run with --apply to delete documents."
    );
    if (!includeGameplay) {
      console.log(
        "Add --include-gameplay to also wipe case sessions and email nudge logs."
      );
    }
  }
} finally {
  await client.close();
}
