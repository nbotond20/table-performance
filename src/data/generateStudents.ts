import type { StudentRow, Grade, Status } from '../types/student';
import { EXERCISE_COUNT, GRADES, STATUSES } from '../types/student';

// Mulberry32 — simple, fast, deterministic 32-bit PRNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const FIRST_NAMES = [
  'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda',
  'David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica',
  'Thomas','Sarah','Christopher','Karen','Charles','Lisa','Daniel','Nancy',
  'Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley',
  'Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle',
  'Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa',
  'Timothy','Deborah','Ronald','Stephanie','Edward','Rebecca','Jason','Sharon',
  'Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathleen','Gary','Amy',
  'Nicholas','Angela','Eric','Shirley','Jonathan','Anna','Stephen','Brenda',
  'Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen',
  'Benjamin','Samantha','Samuel','Katherine','Raymond','Christine','Gregory','Debra',
  'Frank','Rachel','Alexander','Carolyn','Patrick','Janet','Jack','Catherine',
  'Dennis','Maria','Jerry','Heather','Tyler','Diane',
] as const;

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
  'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
  'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
  'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill',
  'Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell',
  'Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz',
  'Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales',
  'Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson',
  'Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward',
  'Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray',
  'Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel',
  'Myers','Long','Ross','Foster',
] as const;

const EMAIL_DOMAINS = [
  'school.edu', 'university.edu', 'college.edu', 'academy.org', 'institute.edu',
] as const;

const SEED = 42;

function padDate(n: number) {
  return String(n).padStart(2, '0');
}

export function computeAggregates(row: StudentRow) {
  let sum = 0;
  let min = 101;
  let max = -1;
  let passing = 0;
  for (let j = 1; j <= EXERCISE_COUNT; j++) {
    const score = (row as unknown as Record<string, number>)[`ex${j}`];
    sum += score;
    if (score < min) min = score;
    if (score > max) max = score;
    if (score >= 50) passing++;
  }
  row.avgScore = Math.round((sum / EXERCISE_COUNT) * 10) / 10;
  row.minScore = min;
  row.maxScore = max;
  row.totalPoints = sum;
  row.passRate = Math.round((passing / EXERCISE_COUNT) * 100);
}

export function generateStudents(count: number): StudentRow[] {
  const rng = mulberry32(SEED);
  const rows: StudentRow[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES, rng);
    const lastName = pick(LAST_NAMES, rng);
    const name = `${firstName} ${lastName}`;

    const year = 2019 + Math.floor(rng() * 6);
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);

    const row = {
      id: i,
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${pick(EMAIL_DOMAINS, rng)}`,
      age: 16 + Math.floor(rng() * 12),
      grade: pick(GRADES, rng) as Grade,
      status: pick(STATUSES, rng) as Status,
      enrollmentDate: `${year}-${padDate(month)}-${padDate(day)}`,
    } as StudentRow;

    for (let j = 1; j <= EXERCISE_COUNT; j++) {
      (row as unknown as Record<string, number>)[`ex${j}`] = Math.floor(rng() * 101);
    }

    computeAggregates(row);
    rows[i] = row;
  }

  return rows;
}

// Pre-generated caches keyed by row count
const cache = new Map<number, readonly StudentRow[]>();

export function getStudents(count: number): readonly StudentRow[] {
  let data = cache.get(count);
  if (!data) {
    data = Object.freeze(generateStudents(count));
    cache.set(count, data);
  }
  return data;
}

export const ROW_COUNT_OPTIONS = [1_000, 5_000, 10_000, 50_000, 100_000] as const;
