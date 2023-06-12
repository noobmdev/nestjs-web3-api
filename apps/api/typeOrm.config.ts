import { DataSource, DataSourceOptions } from 'typeorm';
import { dbConfig } from './app.config';
import { User } from './src/db/entities';
import { CreateUserTable1677483938843 } from './src/db/migrations/1677483938843-CreateUserTable';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  ssl: true,
  entities: [User],
  migrations: [CreateUserTable1677483938843],
};

export default new DataSource(dataSourceOptions);
