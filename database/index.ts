import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schemas';
import { ENV } from '@/lib/config/env';

export const db = drizzle(ENV.DB_FILE_NAME || process.env.DB_FILE_NAME!, {schema});
