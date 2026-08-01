import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const owners = await sql`SELECT id, name FROM "user" WHERE role = 'owner' LIMIT 1`
if (owners.length === 0) {
  console.error('No owner account yet — create it via /sign-in first.')
  process.exit(1)
}
const owner = owners[0]
const cats = await sql`UPDATE categories SET user_id = ${owner.id} WHERE user_id IS NULL RETURNING id`
const subs = await sql`UPDATE push_subscriptions SET user_id = ${owner.id} WHERE user_id IS NULL RETURNING id`
console.log(`attached to owner "${owner.name}": ${cats.length} categories, ${subs.length} push subscriptions`)
