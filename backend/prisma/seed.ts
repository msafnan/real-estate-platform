/**
 * Seed script — generates 50,000+ fake properties for realistic performance
 * testing (Session 2). Run with `npm run seed` (or `npx prisma db seed`).
 *
 * Design notes:
 * - IDs are generated in JS (randomUUID) so images can reference their parent
 *   property without a round-trip after insert.
 * - Rows are inserted with `createMany` in batches to keep network round-trips
 *   to Neon low.
 * - `createdAt` is spread across the last ~2 years so "newest first" sorting
 *   and keyset pagination (Session 5) have meaningful ordering.
 * - Cities/types come from fixed pools so filters and "similar properties"
 *   (Session 6) return non-trivial groupings.
 */
import { faker } from '@faker-js/faker';
import { PrismaClient, PropertyType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const TARGET = Number(process.env.SEED_COUNT ?? 50_000);
const BATCH = 5_000;
const DEMO_PASSWORD = 'Password123';

const CITIES = [
  'Austin', 'Dallas', 'Houston', 'Seattle', 'Portland', 'Denver', 'Phoenix',
  'San Diego', 'Miami', 'Orlando', 'Atlanta', 'Chicago', 'Boston', 'Nashville',
  'Charlotte', 'Raleigh', 'Columbus', 'Minneapolis', 'Sacramento', 'Tampa',
];

const TYPES: PropertyType[] = [
  'apartment', 'house', 'condo', 'townhouse', 'land', 'commercial',
];

/** Base price by type (whole USD); actual price jitters around this. */
const BASE_PRICE: Record<PropertyType, number> = {
  apartment: 320_000,
  house: 520_000,
  condo: 400_000,
  townhouse: 460_000,
  land: 180_000,
  commercial: 900_000,
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildProperty(ownerIds: string[]) {
  const id = randomUUID();
  const type = pick(TYPES);
  const city = pick(CITIES);
  const hasRooms = type !== 'land' && type !== 'commercial';
  const bedrooms = hasRooms ? faker.number.int({ min: 1, max: 6 }) : 0;
  const bathrooms = hasRooms ? faker.number.int({ min: 1, max: 5 }) : 0;
  // ±35% jitter around the type's base price, rounded to the nearest $1k.
  const price =
    Math.round((BASE_PRICE[type] * faker.number.float({ min: 0.65, max: 1.35 })) / 1000) *
    1000;

  const property = {
    id,
    ownerId: pick(ownerIds),
    title: `${bedrooms ? `${bedrooms}-bed ` : ''}${type} in ${city}`,
    description: faker.lorem.sentences({ min: 2, max: 4 }),
    price,
    city,
    propertyType: type,
    bedrooms,
    bathrooms,
    createdAt: faker.date.past({ years: 2 }),
  };

  const image = {
    id: randomUUID(),
    propertyId: id,
    url: `https://picsum.photos/seed/${id}/800/600`,
    position: 0,
  };

  return { property, image };
}

async function ensureDemoUsers(): Promise<string[]> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const emails = ['owner1', 'owner2', 'owner3', 'owner4', 'owner5'].map(
    (u) => `${u}@example.com`,
  );

  const ids: string[] = [];
  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: faker.person.fullName(), passwordHash },
    });
    ids.push(user.id);
  }
  return ids;
}

async function main() {
  const start = Date.now();
  console.log(`Seeding ${TARGET.toLocaleString()} properties...`);

  const ownerIds = await ensureDemoUsers();
  console.log(`Demo owners ready (login: ownerN@example.com / ${DEMO_PASSWORD})`);

  // Clean slate for repeatable runs (cascades to images + inquiries).
  console.log('Clearing existing properties...');
  await prisma.property.deleteMany({});

  let inserted = 0;
  while (inserted < TARGET) {
    const size = Math.min(BATCH, TARGET - inserted);
    const properties = [];
    const images = [];
    for (let i = 0; i < size; i++) {
      const { property, image } = buildProperty(ownerIds);
      properties.push(property);
      images.push(image);
    }
    await prisma.property.createMany({ data: properties });
    await prisma.propertyImage.createMany({ data: images });
    inserted += size;
    process.stdout.write(`  inserted ${inserted.toLocaleString()} / ${TARGET.toLocaleString()}\r`);
  }

  const total = await prisma.property.count();
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone. ${total.toLocaleString()} properties in DB (${secs}s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
